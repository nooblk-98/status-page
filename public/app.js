const MAX_DAYS = 30;
const RECENT_LIMIT = 8;
const REFRESH_MS = 15000;

const siteSelect = document.getElementById("siteSelect");
const statusPill = document.getElementById("statusPill");
const latencyValue = document.getElementById("latency");
const lastChecked = document.getElementById("lastChecked");
const uptimePercent = document.getElementById("uptimePercent");
const checkCount = document.getElementById("checkCount");
const timeline = document.getElementById("timeline");
const recentTable = document.getElementById("recentTable");
const liveBadge = document.getElementById("liveBadge");
const liveDot = document.getElementById("liveDot");
const liveText = document.getElementById("liveText");

let sites = [];
let currentSiteId = null;
let refreshTimer = null;

function setBadge(state, label) {
  liveText.textContent = label;
  if (state === "live") {
    liveDot.style.background = "var(--good)";
    liveDot.style.boxShadow = "0 0 12px rgba(34, 197, 94, 0.9)";
  } else if (state === "pause") {
    liveDot.style.background = "var(--warn)";
    liveDot.style.boxShadow = "0 0 12px rgba(250, 204, 21, 0.8)";
  } else {
    liveDot.style.background = "var(--muted)";
    liveDot.style.boxShadow = "0 0 12px rgba(148, 163, 184, 0.8)";
  }
}

function formatTime(ts) {
  return ts ? new Date(ts).toLocaleString() : "—";
}

function daysAgo(ts) {
  const now = new Date();
  const day = new Date(ts);
  return Math.floor((now - day) / (1000 * 60 * 60 * 24));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

async function loadSites() {
  const data = await fetchJson("/api/sites");
  sites = data.sites || [];
  siteSelect.innerHTML = "";
  sites.forEach((site) => {
    const option = document.createElement("option");
    option.value = site.id;
    option.textContent = site.name;
    siteSelect.appendChild(option);
  });
  currentSiteId = sites[0]?.id || null;
}

async function loadChecks() {
  if (!currentSiteId) return { checks: [] };
  return fetchJson(`/api/sites/${currentSiteId}/checks?days=${MAX_DAYS}`);
}

async function loadSummary() {
  if (!currentSiteId) return null;
  return fetchJson(`/api/sites/${currentSiteId}/summary?days=${MAX_DAYS}`);
}

async function loadLatest() {
  if (!currentSiteId) return null;
  const data = await fetchJson(`/api/sites/${currentSiteId}/latest`);
  return data.latest;
}

function buildTimeline(checks) {
  timeline.innerHTML = "";
  const dayBuckets = Array.from({ length: MAX_DAYS }, (_, index) => ({
    dayOffset: MAX_DAYS - index - 1,
    ok: 0,
    total: 0,
  }));

  checks.forEach((entry) => {
    const age = daysAgo(entry.ts);
    if (age >= 0 && age < MAX_DAYS) {
      const bucket = dayBuckets[MAX_DAYS - age - 1];
      bucket.total += 1;
      if (entry.ok) bucket.ok += 1;
    }
  });

  dayBuckets.forEach((bucket) => {
    const ratio = bucket.total ? bucket.ok / bucket.total : null;
    const el = document.createElement("div");
    el.className = "day";

    if (ratio === null) {
      el.style.background = "rgba(148, 163, 184, 0.12)";
    } else if (ratio > 0.98) {
      el.style.background = "linear-gradient(160deg, rgba(34,197,94,0.9), rgba(34,197,94,0.4))";
    } else if (ratio > 0.9) {
      el.style.background = "linear-gradient(160deg, rgba(250,204,21,0.9), rgba(250,204,21,0.4))";
    } else {
      el.style.background = "linear-gradient(160deg, rgba(239,68,68,0.9), rgba(239,68,68,0.4))";
    }

    const label = document.createElement("span");
    label.textContent = bucket.dayOffset === 0 ? "Today" : `${bucket.dayOffset}d`;
    el.appendChild(label);
    timeline.appendChild(el);
  });
}

function renderRecent(checks) {
  recentTable.innerHTML = "";
  const header = document.createElement("div");
  header.className = "row";
  header.innerHTML = "<strong>Timestamp</strong><strong>Status</strong><strong>Latency</strong>";
  recentTable.appendChild(header);

  const recent = checks.slice(0, RECENT_LIMIT);
  if (!recent.length) {
    const empty = document.createElement("div");
    empty.className = "row";
    empty.innerHTML = "<span>No checks yet</span><span>—</span><span>—</span>";
    recentTable.appendChild(empty);
    return;
  }

  recent.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <span>${formatTime(entry.ts)}</span>
      <span>${entry.ok ? "Online" : "Down"}</span>
      <span>${entry.latency_ms ? `${entry.latency_ms} ms` : "—"}</span>
    `;
    recentTable.appendChild(row);
  });
}

function updateStats(summary) {
  if (!summary) return;
  uptimePercent.textContent = `${summary.percent.toFixed(2)}%`;
  checkCount.textContent = summary.total.toString();
}

function updateStatus(entry) {
  if (!entry) return;
  statusPill.textContent = entry.ok ? "Online" : "Down";
  statusPill.style.background = entry.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  statusPill.style.borderColor = entry.ok ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
  latencyValue.textContent = entry.latency_ms ? entry.latency_ms : "--";
  lastChecked.textContent = formatTime(entry.ts);
  setBadge(entry.ok ? "live" : "pause", entry.ok ? "Healthy" : "Issue detected");
}

async function refresh() {
  if (!currentSiteId) return;
  const [checksData, summary, latest] = await Promise.all([
    loadChecks(),
    loadSummary(),
    loadLatest(),
  ]);
  buildTimeline(checksData.checks || []);
  renderRecent(checksData.checks || []);
  updateStats(summary);
  updateStatus(latest);
}

function startRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refresh();
  refreshTimer = setInterval(refresh, REFRESH_MS);
}

siteSelect.addEventListener("change", () => {
  currentSiteId = siteSelect.value;
  startRefresh();
});

window.addEventListener("load", async () => {
  setBadge("idle", "Loading");
  await loadSites();
  if (currentSiteId) siteSelect.value = currentSiteId;
  await refresh();
  startRefresh();
});
