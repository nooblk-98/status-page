const ALERT_RANGE = { type: "days", value: 30 };
const REFRESH_MS = 15000;
const ALERTS_READ_KEY = "alertsLastRead";

const themeToggle = document.getElementById("themeToggle");
const alertsList = document.getElementById("alertsList");
const alertsEmpty = document.getElementById("alertsEmpty");
const alertCount = document.getElementById("alertCount");
const markRead = document.getElementById("markRead");

let sites = [];
let refreshTimer = null;

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

function formatTime(ts) {
  return ts ? new Date(ts).toLocaleString() : "--";
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

function rangeToMs(range) {
  if (range.type === "minutes") return range.value * 60 * 1000;
  if (range.type === "hours") return range.value * 60 * 60 * 1000;
  return range.value * 24 * 60 * 60 * 1000;
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

async function loadChecks(siteId) {
  const days = ALERT_RANGE.value;
  return fetchJson(`/api/sites/${siteId}/checks?days=${days}`);
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

function renderAlerts(items) {
  if (!alertsList || !alertsEmpty) return;
  const lastRead = Number(localStorage.getItem(ALERTS_READ_KEY) || 0);
  const unreadCount = items.filter((item) => item.end > lastRead).length;

  if (alertCount) {
    alertCount.textContent = unreadCount ? `Unread ${unreadCount}` : `All read (${items.length})`;
  }

  if (markRead) {
    markRead.disabled = unreadCount === 0;
  }

  alertsList.innerHTML = "";
  alertsEmpty.textContent = "";

  if (!items.length) {
    alertsEmpty.textContent = "No downtime alerts";
    return;
  }

  items.slice(0, 50).forEach((item) => {
    const row = document.createElement("div");
    row.className = "alert-card";
    if (item.end > lastRead) row.classList.add("is-unread");

    // Formatting values
    const err = item.error ? `<div class="alert-err">${item.error}</div>` : "";
    const code = item.statusCode ?? "--";

    row.innerHTML = `
      <div class="alert-header">
        <div>
          <div class="alert-site">${item.siteName}</div>
          <div class="alert-url">${item.siteUrl}</div>
        </div>
        ${err}
      </div>
      <div class="alert-meta">
        <div>
          <div class="alert-label">Time</div>
          <div class="alert-value">${formatTime(item.end)}</div>
        </div>
        <div>
          <div class="alert-label">Duration</div>
          <div class="alert-value">${formatDuration(item.durationMs)}</div>
        </div>
        <div>
          <div class="alert-label">Code</div>
          <div class="alert-value">${code}</div>
        </div>
      </div>
    `;
    alertsList.appendChild(row);
  });
}

async function refreshAll() {
  if (!sites.length) return;
  const results = await Promise.all(
    sites.map(async (site) => {
      const checksData = await loadChecks(site.id);
      const downtimeWindows = buildDowntimeWindows(checksData.checks || [], ALERT_RANGE, site);
      return { site, downtimeWindows };
    })
  );

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

  renderAlerts(alertItems);
}

function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshAll();
  refreshTimer = setInterval(refreshAll, REFRESH_MS);
}

if (markRead) {
  markRead.addEventListener("click", () => {
    localStorage.setItem(ALERTS_READ_KEY, String(Date.now()));
    refreshAll();
  });
}

window.addEventListener("load", async () => {
  initTheme();
  await loadSites();
  startRefresh();
});
