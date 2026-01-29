const DEFAULT_RANGE = { type: "minutes", value: 60 };
const REFRESH_MS = 15000;

// Get monitor ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const monitorId = urlParams.get('id');

// DOM elements
const monitorName = document.getElementById('monitorName');
const monitorUrl = document.getElementById('monitorUrl');
const statusBadge = document.getElementById('statusBadge');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const currentStatus = document.getElementById('currentStatus');
const uptimePercent = document.getElementById('uptimePercent');
const lastChecked = document.getElementById('lastChecked');
const avgLatency = document.getElementById('avgLatency');
const totalChecks = document.getElementById('totalChecks');
const checkInterval = document.getElementById('checkInterval');
const timelineContainer = document.getElementById('timelineContainer');
const downtimeList = document.getElementById('downtimeList');
const latencyChart = document.getElementById('latencyChart');
const rangeButtons = document.getElementById('rangeButtons');
const themeToggle = document.getElementById('themeToggle');

let currentRange = { ...DEFAULT_RANGE };
let refreshTimer = null;
let globalTooltip = null;

function createGlobalTooltip() {
    if (globalTooltip) return;
    globalTooltip = document.createElement("div");
    globalTooltip.className = "global-tooltip";
    document.body.appendChild(globalTooltip);
}

function showTooltip(e, content) {
    if (!globalTooltip) createGlobalTooltip();
    globalTooltip.innerHTML = content;
    globalTooltip.classList.add("is-visible");

    const rect = globalTooltip.getBoundingClientRect();
    let top = e.clientY - rect.height - 10;
    let left = e.clientX - rect.width / 2;

    if (top < 10) top = e.clientY + 20;
    if (left < 10) left = 10;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;

    globalTooltip.style.top = `${top}px`;
    globalTooltip.style.left = `${left}px`;
}

function hideTooltip() {
    if (globalTooltip) globalTooltip.classList.remove("is-visible");
}

function formatTime(ts) {
    return ts ? new Date(ts).toLocaleString() : "--";
}

function formatDay(ts) {
    return ts ? new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "";
}

function formatDuration(ms) {
    if (!ms || ms <= 0) return "0m";
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function rangeToDays(range) {
    if (range.type === "minutes") return range.value / 1440;
    if (range.type === "hours") return range.value / 24;
    return range.value;
}

function rangeToMs(range) {
    if (range.type === "minutes") return range.value * 60 * 1000;
    if (range.type === "hours") return range.value * 60 * 60 * 1000;
    return range.value * 24 * 60 * 60 * 1000;
}

function rangeSegments(range) {
    if (range.type === "minutes") return 60;
    if (range.type === "hours") return 24;
    return range.value;
}

function rangeLabel(range) {
    if (range.type === "minutes") return `${range.value} minutes`;
    if (range.type === "hours") return `${range.value} hours`;
    return `${range.value} days`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Request failed");
    return response.json();
}

async function loadSite(siteId) {
    const data = await fetchJson("/api/sites");
    const sites = data.sites || [];
    return sites.find(s => s.id === siteId);
}

async function loadChecks(siteId, range) {
    const days = rangeToDays(range);
    return fetchJson(`/api/sites/${siteId}/checks?days=${days}`);
}

async function loadSummary(siteId, range) {
    const days = rangeToDays(range);
    return fetchJson(`/api/sites/${siteId}/summary?days=${days}`);
}

async function loadLatest(siteId) {
    const data = await fetchJson(`/api/sites/${siteId}/latest`);
    return data.latest;
}

function buildDowntimeWindows(checks, range, site) {
    const intervalSeconds = site?.intervalSeconds || 60;
    const intervalMs = intervalSeconds * 1000;
    const rangeEnd = Date.now();
    const rangeStart = rangeEnd - rangeToMs(range);
    const sorted = [...checks].sort((a, b) => a.ts - b.ts);
    const windows = [];
    let current = null;

    sorted.forEach((entry) => {
        if (entry.ts < rangeStart - intervalMs) return;
        if (entry.ok) {
            if (current) {
                windows.push(current);
                current = null;
            }
            return;
        }
        if (!current) {
            current = { start: entry.ts, end: entry.ts, last: entry };
        } else {
            current.end = entry.ts;
            current.last = entry;
        }
    });

    if (current) windows.push(current);

    return windows
        .map((win) => ({
            start: win.start,
            end: win.end,
            durationMs: win.end - win.start + intervalMs,
            statusCode: win.last?.status_code ?? null,
            error: win.last?.error ?? null,
        }))
        .sort((a, b) => b.end - a.end);
}

function buildTimeline(downtimeWindows, checks, range, site) {
    const wrap = document.createElement("div");
    wrap.className = "uptime-wrap";

    const bar = document.createElement("div");
    bar.className = "uptime-bar";

    const intervalSeconds = site?.intervalSeconds || 60;
    const intervalMs = intervalSeconds * 1000;
    const rangeMs = rangeToMs(range);
    const rangeEnd = Date.now();
    const rangeStart = rangeEnd - rangeMs;
    const segments = rangeSegments(range);
    const bucketMs = rangeMs / segments;
    const buckets = Array.from({ length: segments }, () => ({ ok: 0, total: 0, down: 0 }));

    checks.forEach((entry) => {
        const offset = Math.floor((rangeEnd - entry.ts) / bucketMs);
        if (offset < 0 || offset >= segments) return;
        const bucket = buckets[segments - offset - 1];
        bucket.total += 1;
        if (entry.ok) bucket.ok += 1;
        else bucket.down += 1;
    });

    buckets.forEach((bucket, bucketIndex) => {
        const seg = document.createElement("div");
        seg.className = "uptime-segment";
        const bucketStart = rangeStart + bucketIndex * bucketMs;
        const bucketEnd = bucketStart + bucketMs;
        if (bucket.total === 0) {
            seg.classList.add("idle");
            seg.addEventListener("mouseenter", (e) => {
                showTooltip(e, `
          <div class="tooltip-header">No Data</div>
          <div class="tooltip-row">
            <span class="tooltip-label">Start</span>
            <span class="tooltip-val">${formatTime(bucketStart)}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">End</span>
            <span class="tooltip-val">${formatTime(bucketEnd)}</span>
          </div>
        `);
            });
        } else if (bucket.down === 0) {
            seg.classList.add("good");
            seg.addEventListener("mouseenter", (e) => {
                showTooltip(e, `
          <div class="tooltip-header">Healthy</div>
          <div class="tooltip-row">
            <span class="tooltip-label">From</span>
            <span class="tooltip-val">${formatTime(bucketStart)}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">To</span>
            <span class="tooltip-val">${formatTime(bucketEnd)}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Success Rate</span>
            <span class="tooltip-val">100%</span>
          </div>
        `);
            });
        } else {
            seg.classList.add("bad");
            const rate = ((bucket.ok / bucket.total) * 100).toFixed(1);
            seg.addEventListener("mouseenter", (e) => {
                showTooltip(e, `
          <div class="tooltip-header">Down</div>
          <div class="tooltip-row">
            <span class="tooltip-label">From</span>
            <span class="tooltip-val">${formatTime(bucketStart)}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">To</span>
            <span class="tooltip-val">${formatTime(bucketEnd)}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Availability</span>
            <span class="tooltip-val">${rate}%</span>
          </div>
        `);
            });
        }
        seg.addEventListener("mouseleave", hideTooltip);
        bar.appendChild(seg);
    });

    const labels = document.createElement("div");
    labels.className = "uptime-labels";
    const left = document.createElement("span");
    left.textContent = `${rangeLabel(range)} ago`;
    const center = document.createElement("span");
    center.textContent = formatDay(Date.now());
    const right = document.createElement("span");
    right.textContent = range.type === "minutes" || range.type === "hours" ? "Now" : "Today";
    labels.appendChild(left);
    labels.appendChild(center);
    labels.appendChild(right);

    wrap.appendChild(bar);
    wrap.appendChild(labels);

    return wrap;
}

function renderDowntimeList(downtimeWindows) {
    downtimeList.innerHTML = '';

    if (!downtimeWindows || downtimeWindows.length === 0) {
        downtimeList.innerHTML = '<div class="no-downtime">✓ No downtime recorded in this period</div>';
        return;
    }

    downtimeWindows.forEach((event) => {
        const item = document.createElement('div');
        item.className = 'downtime-item';
        item.innerHTML = `
      <div>
        <div class="downtime-time">${formatTime(event.end)}</div>
        <div class="downtime-details">Code: ${event.statusCode ?? '--'} | Error: ${event.error ?? '--'}</div>
      </div>
      <div class="downtime-duration">${formatDuration(event.durationMs)}</div>
    `;
        downtimeList.appendChild(item);
    });
}

function renderLatencyChart(checks) {
    latencyChart.innerHTML = '';

    if (!checks || checks.length === 0) {
        latencyChart.innerHTML = '<div style="color: var(--muted); text-align: center;">No latency data available</div>';
        return;
    }

    const chartDiv = document.createElement('div');
    chartDiv.className = 'latency-chart';

    // Get last 50 checks for the chart
    const recentChecks = checks.slice(-50);
    const maxLatency = Math.max(...recentChecks.map(c => c.latency_ms || 0), 1);

    recentChecks.forEach((check) => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        const latency = check.latency_ms || 0;
        const heightPercent = (latency / maxLatency) * 100;

        bar.style.height = `${heightPercent}%`;

        if (latency > 500) {
            bar.classList.add('high-latency');
        }

        bar.addEventListener('mouseenter', (e) => {
            showTooltip(e, `
        <div class="tooltip-header">Response Time</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Time</span>
          <span class="tooltip-val">${formatTime(check.ts)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Latency</span>
          <span class="tooltip-val">${latency} ms</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Status</span>
          <span class="tooltip-val">${check.ok ? 'Healthy' : 'Down'}</span>
        </div>
      `);
        });
        bar.addEventListener('mouseleave', hideTooltip);

        chartDiv.appendChild(bar);
    });

    latencyChart.appendChild(chartDiv);
}

function setStatusBadge(isOnline) {
    if (isOnline) {
        statusDot.style.background = "var(--good)";
        statusDot.style.boxShadow = "0 0 12px rgba(34, 197, 94, 0.9)";
        statusText.textContent = "Online";
    } else {
        statusDot.style.background = "var(--bad)";
        statusDot.style.boxShadow = "0 0 12px rgba(239, 68, 68, 0.8)";
        statusText.textContent = "Down";
    }
}

function setActiveRange(range) {
    currentRange = range;
    if (!rangeButtons) return;
    const buttons = rangeButtons.querySelectorAll(".seg-btn");
    buttons.forEach((btn) => {
        const btnMinutes = btn.dataset.minutes ? Number(btn.dataset.minutes) : null;
        const btnHours = btn.dataset.hours ? Number(btn.dataset.hours) : null;
        const btnDays = btn.dataset.days ? Number(btn.dataset.days) : null;
        const isActive =
            (range.type === "minutes" && btnMinutes === range.value) ||
            (range.type === "hours" && btnHours === range.value) ||
            (range.type === "days" && btnDays === range.value);
        btn.classList.toggle("is-active", isActive);
    });
}

async function refreshMonitorData() {
    if (!monitorId) {
        monitorName.textContent = "Error: No monitor ID provided";
        return;
    }

    try {
        const [site, checksData, summary, latest] = await Promise.all([
            loadSite(monitorId),
            loadChecks(monitorId, currentRange),
            loadSummary(monitorId, currentRange),
            loadLatest(monitorId)
        ]);

        if (!site) {
            monitorName.textContent = "Error: Monitor not found";
            return;
        }

        // Update header
        monitorName.textContent = site.name;
        monitorUrl.textContent = site.url;

        // Update status badge
        setStatusBadge(latest?.ok);

        // Update stats - format timestamps more concisely
        currentStatus.textContent = latest?.ok ? "Online" : "Down";
        currentStatus.style.color = latest?.ok ? "var(--good)" : "var(--bad)";
        uptimePercent.textContent = summary ? `${summary.percent.toFixed(2)}%` : "--";

        // Format last checked more concisely
        if (latest?.ts) {
            const date = new Date(latest.ts);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            lastChecked.textContent = timeStr;
        } else {
            lastChecked.textContent = "--";
        }

        const checks = checksData.checks || [];
        const validLatencies = checks.filter(c => c.latency_ms).map(c => c.latency_ms);
        const avgLat = validLatencies.length > 0
            ? (validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length).toFixed(0)
            : "--";
        avgLatency.textContent = avgLat !== "--" ? `${avgLat} ms` : "--";

        totalChecks.textContent = summary ? summary.total : 0;
        checkInterval.textContent = site.intervalSeconds ? `${site.intervalSeconds}s` : "--";

        // Build downtime windows
        const downtimeWindows = buildDowntimeWindows(checks, currentRange, site);

        // Update timeline
        timelineContainer.innerHTML = '';
        const timeline = buildTimeline(downtimeWindows, checks, currentRange, site);
        timelineContainer.appendChild(timeline);

        // Update downtime list
        renderDowntimeList(downtimeWindows);

        // Update latency chart
        renderLatencyChart(checks);

    } catch (error) {
        console.error("Error loading monitor data:", error);
        monitorName.textContent = "Error loading monitor data";
    }
}

function startRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshMonitorData();
    refreshTimer = setInterval(refreshMonitorData, REFRESH_MS);
}

function setTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    if (themeToggle) {
        const icon = themeToggle.querySelector(".theme-icon");
        const label = themeToggle.querySelector(".theme-label");
        if (icon) icon.textContent = theme === "light" ? "☀️" : "🌙";
        if (label) label.textContent = theme === "light" ? "Light" : "Dark";
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    const theme = savedTheme || "dark";
    setTheme(theme);
    if (!themeToggle) return;
    themeToggle.addEventListener("click", () => {
        const next = document.body.getAttribute("data-theme") === "light" ? "dark" : "light";
        setTheme(next);
        localStorage.setItem("theme", next);
    });
}

// Range button handlers
if (rangeButtons) {
    rangeButtons.addEventListener("click", (event) => {
        const button = event.target.closest(".seg-btn");
        if (!button) return;
        if (button.dataset.minutes) {
            const minutes = Number(button.dataset.minutes);
            if (Number.isNaN(minutes)) return;
            setActiveRange({ type: "minutes", value: minutes });
            refreshMonitorData();
            return;
        }
        if (button.dataset.hours) {
            const hours = Number(button.dataset.hours);
            if (Number.isNaN(hours)) return;
            setActiveRange({ type: "hours", value: hours });
            refreshMonitorData();
            return;
        }
        if (button.dataset.days) {
            const days = Number(button.dataset.days);
            if (Number.isNaN(days)) return;
            setActiveRange({ type: "days", value: days });
            refreshMonitorData();
        }
    });
}

// Initialize on load
window.addEventListener("load", () => {
    initTheme();
    setActiveRange(DEFAULT_RANGE);
    startRefresh();
});
