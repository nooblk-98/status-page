const STORAGE_KEY = "statusPageChecks";
const SETTINGS_KEY = "statusPageSettings";
const MAX_DAYS = 30;
const RECENT_LIMIT = 8;

const endpointInput = document.getElementById("endpoint");
const intervalSelect = document.getElementById("interval");
const useProxyToggle = document.getElementById("useProxy");
const autoStartToggle = document.getElementById("autoStart");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

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

let timer = null;
let checks = loadChecks();
let settings = loadSettings();

function loadChecks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveChecks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

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
  return new Date(ts).toLocaleString();
}

function daysAgo(ts) {
  const now = new Date();
  const day = new Date(ts);
  const diff = Math.floor((now - day) / (1000 * 60 * 60 * 24));
  return diff;
}

function pruneOldChecks() {
  const cutoff = Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;
  checks = checks.filter((entry) => entry.ts >= cutoff);
}

function buildTimeline() {
  timeline.innerHTML = "";
  const dayBuckets = Array.from({ length: MAX_DAYS }, (_, index) => {
    return { dayOffset: MAX_DAYS - index - 1, ok: 0, total: 0 };
  });

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

function renderRecent() {
  recentTable.innerHTML = "";
  const header = document.createElement("div");
  header.className = "row";
  header.innerHTML = "<strong>Timestamp</strong><strong>Status</strong><strong>Latency</strong>";
  recentTable.appendChild(header);

  const recent = checks.slice(-RECENT_LIMIT).reverse();
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
      <span>${entry.latency ? `${entry.latency} ms` : "—"}</span>
    `;
    recentTable.appendChild(row);
  });
}

function updateStats() {
  const total = checks.length;
  const okCount = checks.filter((entry) => entry.ok).length;
  const percent = total ? ((okCount / total) * 100).toFixed(2) : "0.00";
  uptimePercent.textContent = `${percent}%`;
  checkCount.textContent = total.toString();
}

function updateStatus(entry) {
  if (!entry) return;
  statusPill.textContent = entry.ok ? "Online" : "Down";
  statusPill.style.background = entry.ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  statusPill.style.borderColor = entry.ok ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
  latencyValue.textContent = entry.latency ? entry.latency : "--";
  lastChecked.textContent = formatTime(entry.ts);
}

function persistEntry(entry) {
  checks.push(entry);
  pruneOldChecks();
  saveChecks();
  render();
}

function buildUrl() {
  const endpoint = endpointInput.value.trim();
  if (!endpoint) return null;
  if (useProxyToggle.checked) {
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(endpoint)}`;
  }
  return endpoint;
}

async function ping() {
  const url = buildUrl();
  if (!url) return;

  const start = performance.now();
  let ok = false;
  let latency = null;

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    ok = response.ok || response.type === "opaque";
    latency = Math.round(performance.now() - start);
  } catch (error) {
    ok = false;
  }

  const entry = {
    ts: Date.now(),
    ok,
    latency,
  };

  persistEntry(entry);
  updateStatus(entry);
  setBadge("live", ok ? "Live" : "Issue detected");
}

function startMonitoring() {
  const url = endpointInput.value.trim();
  if (!url) {
    alert("Enter an endpoint URL to monitor.");
    return;
  }
  setBadge("live", "Monitoring");
  startBtn.disabled = true;
  stopBtn.disabled = false;
  settings = {
    endpoint: url,
    interval: intervalSelect.value,
    useProxy: useProxyToggle.checked,
    autoStart: autoStartToggle.checked,
  };
  saveSettings();
  ping();
  const intervalMs = Number(intervalSelect.value) * 1000;
  timer = setInterval(ping, intervalMs);
}

function stopMonitoring() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setBadge("pause", "Paused");
}

function render() {
  buildTimeline();
  renderRecent();
  updateStats();
}

function loadFromSettings() {
  if (settings.endpoint) endpointInput.value = settings.endpoint;
  if (settings.interval) intervalSelect.value = settings.interval;
  if (typeof settings.useProxy === "boolean") useProxyToggle.checked = settings.useProxy;
  if (typeof settings.autoStart === "boolean") autoStartToggle.checked = settings.autoStart;
}

startBtn.addEventListener("click", startMonitoring);
stopBtn.addEventListener("click", stopMonitoring);

window.addEventListener("load", () => {
  loadFromSettings();
  render();
  const latest = checks[checks.length - 1];
  if (latest) updateStatus(latest);
  setBadge("idle", "Idle");
  if (autoStartToggle.checked) {
    startMonitoring();
  }
});
