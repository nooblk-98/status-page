const DEFAULT_RANGE = { type: "minutes", value: 60 };
const RECENT_LIMIT = 4;
const REFRESH_MS = 15000;

const siteGrid = document.getElementById("siteGrid");
const liveBadge = document.getElementById("liveBadge");
const liveDot = document.getElementById("liveDot");
const liveText = document.getElementById("liveText");
const rangeButtons = document.getElementById("rangeButtons");
const themeToggle = document.getElementById("themeToggle");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const searchSuggestions = document.getElementById("searchSuggestions");
const alertToggle = document.getElementById("alertToggle");
const ALERTS_READ_KEY = "alertsLastRead";

let sites = [];
let refreshTimer = null;
let currentRange = { ...DEFAULT_RANGE };
let searchQuery = "";

function setBadge(state, label) {
  liveText.textContent = label;
  if (state === "live") {
    liveDot.style.background = "var(--good)";
    liveDot.style.boxShadow = "0 0 12px rgba(34, 197, 94, 0.9)";
  } else if (state === "warn") {
    liveDot.style.background = "var(--warn)";
    liveDot.style.boxShadow = "0 0 12px rgba(250, 204, 21, 0.8)";
  } else {
    liveDot.style.background = "var(--muted)";
    liveDot.style.boxShadow = "0 0 12px rgba(148, 163, 184, 0.8)";
  }
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

async function loadSites() {
  const data = await fetchJson("/api/sites");
  sites = data.sites || [];
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
  const buckets = Array.from({ length: segments }, () => ({ ok: 0, total: 0 }));

  // Use raw checks to compute per-segment health.
  // This keeps the original up/down bars visible behind downtime windows.
  checks.forEach((entry) => {
    const offset = Math.floor((rangeEnd - entry.ts) / bucketMs);
    if (offset < 0 || offset >= segments) return;
    const bucket = buckets[segments - offset - 1];
    bucket.total += 1;
    if (entry.ok) bucket.ok += 1;
  });

  buckets.forEach((bucket) => {
    const ratio = bucket.total ? bucket.ok / bucket.total : null;
    const seg = document.createElement("div");
    seg.className = "uptime-segment";
    if (ratio === null) {
      seg.classList.add("idle");
    } else if (ratio > 0.98) {
      seg.classList.add("good");
    } else if (ratio > 0.9) {
      seg.classList.add("warn");
    } else {
      seg.classList.add("bad");
    }
    bar.appendChild(seg);
  });

  downtimeWindows.forEach((win) => {
    const windowStart = Math.max(rangeStart, win.start);
    const windowEnd = Math.min(rangeEnd, win.end + intervalMs);
    if (windowEnd <= windowStart) return;
    const left = ((windowStart - rangeStart) / rangeMs) * 100;
    const width = ((windowEnd - windowStart) / rangeMs) * 100;
    if (!Number.isFinite(left) || !Number.isFinite(width)) return;
    const safeLeft = Math.max(0, Math.min(100, left));
    const safeWidth = Math.max(0.5, Math.min(100 - safeLeft, width));
    const segment = document.createElement("div");
    segment.className = "uptime-window";
    segment.style.left = `${safeLeft}%`;
    segment.style.width = `${safeWidth}%`;
    bar.appendChild(segment);
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

function buildRecent(downtimeWindows) {
  const list = document.createElement("div");
  list.className = "recent";
  const recent = downtimeWindows.slice(0, RECENT_LIMIT);
  if (!recent.length) {
    const empty = document.createElement("div");
    empty.className = "recent-row";
    empty.innerHTML = "<span>No downtime recorded</span><span>--</span><span>--</span>";
    list.appendChild(empty);
    return list;
  }

  recent.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `
      <span>${formatTime(entry.end)}</span>
      <span class="recent-detail">Code: ${entry.statusCode ?? "--"} | Error: ${entry.error ?? "--"}</span>
      <span>${formatDuration(entry.durationMs)}</span>
    `;
    list.appendChild(row);
  });

  return list;
}

function updateStatusPill(pill, entry) {
  if (!entry) return;
  pill.textContent = entry.ok ? "Online" : "Down";
  pill.style.background = entry.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  pill.style.borderColor = entry.ok ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
}

function renderSiteCard({ site, summary, latest, checks }, range) {
  const card = document.createElement("div");
  card.className = "card site-card";

  const header = document.createElement("div");
  header.className = "site-header";

  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "site-title";
  title.textContent = site.name;
  const url = document.createElement("div");
  url.className = "site-url";
  url.textContent = site.url;
  titleWrap.appendChild(title);
  titleWrap.appendChild(url);

  const pill = document.createElement("div");
  pill.className = "status-pill";
  pill.textContent = "Waiting";
  updateStatusPill(pill, latest);

  const expandBtn = document.createElement("button");
  expandBtn.className = "expand-btn";
  expandBtn.type = "button";
  expandBtn.setAttribute("aria-expanded", "false");
  expandBtn.innerHTML = "Recent downtime <span class=\"chev\">?</span>";

  const recentPanel = document.createElement("div");
  recentPanel.className = "recent-panel is-collapsed";
  const downtimeWindows = buildDowntimeWindows(checks, range, site);
  const recent = buildRecent(downtimeWindows);
  recentPanel.appendChild(recent);

  expandBtn.addEventListener("click", () => {
    const expanded = expandBtn.getAttribute("aria-expanded") === "true";
    expandBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
    recentPanel.classList.toggle("is-collapsed", expanded);
  });

  const actions = document.createElement("div");
  actions.className = "site-actions";
  actions.appendChild(expandBtn);
  actions.appendChild(pill);

  header.appendChild(titleWrap);
  header.appendChild(actions);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.innerHTML = `
    <div>
      <span class="label">Last checked</span>
      <span class="value">${formatTime(latest?.ts)}</span>
    </div>
    <div>
      <span class="label">Uptime (${rangeLabel(range)})</span>
      <span class="value">${summary ? summary.percent.toFixed(2) : "0.00"}%</span>
    </div>
    <div>
      <span class="label">Checks stored</span>
      <span class="value">${summary ? summary.total : 0}</span>
    </div>
    <div>
      <span class="label">Latency</span>
      <span class="value latency">${latest?.latency_ms ?? "--"} ms</span>
    </div>
  `;

  const timeline = buildTimeline(downtimeWindows, checks, range, site);

  card.appendChild(header);
  card.appendChild(meta);
  card.appendChild(timeline);
  card.appendChild(recentPanel);

  return card;
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

function scoreMatch(text, query) {
  const index = text.indexOf(query);
  if (index === -1) return null;
  return index === 0 ? 0 : index + 2;
}

function buildSuggestions(query) {
  if (!searchSuggestions) return;
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    searchSuggestions.classList.remove("is-open");
    searchSuggestions.innerHTML = "";
    return;
  }

  const matches = sites
    .map((site) => {
      const name = site.name.toLowerCase();
      const url = site.url.toLowerCase();
      const nameScore = scoreMatch(name, trimmed);
      const urlScore = scoreMatch(url, trimmed);
      if (nameScore === null && urlScore === null) return null;
      return {
        site,
        score: Math.min(nameScore ?? 99, urlScore ?? 99),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);

  if (!matches.length) {
    searchSuggestions.classList.remove("is-open");
    searchSuggestions.innerHTML = "";
    return;
  }

  searchSuggestions.classList.add("is-open");
  searchSuggestions.innerHTML = "";
  matches.forEach((match) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.innerHTML = `
      <span>${match.site.name}</span>
      <span class="hint">${match.site.url}</span>
    `;
    item.addEventListener("click", () => {
      searchQuery = match.site.name;
      if (searchInput) searchInput.value = match.site.name;
      searchSuggestions.classList.remove("is-open");
      refreshAll();
    });
    searchSuggestions.appendChild(item);
  });
}

async function refreshAll() {
  if (!sites.length) return;

  const results = await Promise.all(
    sites.map(async (site) => {
      const [checksData, summary, latest] = await Promise.all([
        loadChecks(site.id, currentRange),
        loadSummary(site.id, currentRange),
        loadLatest(site.id),
      ]);
      const downtimeWindows = buildDowntimeWindows(checksData.checks || [], currentRange, site);
      return {
        site,
        checks: checksData.checks || [],
        summary,
        latest,
        downtimeWindows,
      };
    })
  );

  const query = searchQuery.trim().toLowerCase();
  const filtered = results.filter((result) => {
    if (!query) return true;
    const name = result.site.name.toLowerCase();
    const url = result.site.url.toLowerCase();
    return name.includes(query) || url.includes(query);
  });

  filtered.sort((a, b) => {
    if (query) {
      const aName = a.site.name.toLowerCase();
      const bName = b.site.name.toLowerCase();
      const aUrl = a.site.url.toLowerCase();
      const bUrl = b.site.url.toLowerCase();
      const aScore = Math.min(scoreMatch(aName, query) ?? 99, scoreMatch(aUrl, query) ?? 99);
      const bScore = Math.min(scoreMatch(bName, query) ?? 99, scoreMatch(bUrl, query) ?? 99);
      if (aScore !== bScore) return aScore - bScore;
    }
    const aDown = a.latest && !a.latest.ok;
    const bDown = b.latest && !b.latest.ok;
    if (aDown !== bDown) return aDown ? -1 : 1;
    const aLastDown = a.downtimeWindows?.[0]?.end ?? 0;
    const bLastDown = b.downtimeWindows?.[0]?.end ?? 0;
    return bLastDown - aLastDown;
  });

  const alertItems = results
    .flatMap((result) =>
      (result.downtimeWindows || []).map((win) => ({
        siteName: result.site.name,
        siteUrl: result.site.url,
        end: win.end,
        durationMs: win.durationMs,
        statusCode: win.statusCode,
        error: win.error,
      }))
    )
    .sort((a, b) => b.end - a.end);

  if (alertToggle) {
    const lastRead = Number(localStorage.getItem(ALERTS_READ_KEY) || 0);
    const unreadCount = alertItems.filter((item) => item.end > lastRead).length;
    alertToggle.textContent = unreadCount ? `Alerts (${unreadCount})` : "Alerts";
  }

  siteGrid.innerHTML = "";
  let anyDown = false;
  let anyUp = false;

  filtered.forEach((result) => {
    if (result.latest?.ok) anyUp = true;
    if (result.latest && !result.latest.ok) anyDown = true;
    siteGrid.appendChild(renderSiteCard(result, currentRange));
  });

  if (anyDown) setBadge("warn", "Issues detected");
  else if (anyUp) setBadge("live", "All systems normal");
  else setBadge("idle", "Waiting for data");
}

function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshAll();
  refreshTimer = setInterval(refreshAll, REFRESH_MS);
}

function setTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  if (themeToggle) {
    themeToggle.textContent = theme === "light" ? "Light" : "Dark";
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

if (rangeButtons) {
  rangeButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".seg-btn");
    if (!button) return;
    if (button.dataset.minutes) {
      const minutes = Number(button.dataset.minutes);
      if (Number.isNaN(minutes)) return;
      setActiveRange({ type: "minutes", value: minutes });
      refreshAll();
      return;
    }
    if (button.dataset.hours) {
      const hours = Number(button.dataset.hours);
      if (Number.isNaN(hours)) return;
      setActiveRange({ type: "hours", value: hours });
      refreshAll();
      return;
    }
    if (button.dataset.days) {
      const days = Number(button.dataset.days);
      if (Number.isNaN(days)) return;
      setActiveRange({ type: "days", value: days });
      refreshAll();
    }
  });
}

window.addEventListener("load", async () => {
  initTheme();
  setBadge("idle", "Loading");
  await loadSites();
  setActiveRange(DEFAULT_RANGE);
  startRefresh();
});

if (searchInput) {
  searchInput.addEventListener("input", (event) => {
    searchQuery = event.target.value || "";
    buildSuggestions(searchQuery);
    refreshAll();
  });
}

if (searchClear) {
  searchClear.addEventListener("click", () => {
    searchQuery = "";
    if (searchInput) searchInput.value = "";
    if (searchSuggestions) {
      searchSuggestions.classList.remove("is-open");
      searchSuggestions.innerHTML = "";
    }
    refreshAll();
  });
}
