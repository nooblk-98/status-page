const DEFAULT_RANGE = { type: "minutes", value: 60 };
const RECENT_LIMIT = 4;
const REFRESH_MS = 15000;

const siteGrid = document.getElementById("siteGrid");
const liveBadge = document.getElementById("liveBadge");
const liveDot = document.getElementById("liveDot");
const liveText = document.getElementById("liveText");
const rangeButtons = document.getElementById("rangeButtons");

let sites = [];
let refreshTimer = null;
let currentRange = { ...DEFAULT_RANGE };

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
  return ts ? new Date(ts).toLocaleString() : "—";
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

function daysAgo(ts) {
  const now = new Date();
  const day = new Date(ts);
  return Math.floor((now - day) / (1000 * 60 * 60 * 24));
}

function minutesAgo(ts) {
  return Math.floor((Date.now() - ts) / (1000 * 60));
}

function hoursAgo(ts) {
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60));
}

function rangeToDays(range) {
  if (range.type === "minutes") return range.value / 1440;
  if (range.type === "hours") return range.value / 24;
  return range.value;
}

function rangeLabel(range) {
  if (range.type === "minutes") return `${range.value} minutes`;
  if (range.type === "hours") return `${range.value} hours`;
  return `${range.value} days`;
}

function rangeSegments(range) {
  if (range.type === "minutes") return 60;
  if (range.type === "hours") return 24;
  return range.value;
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

function buildTimeline(checks, range, site) {
  const wrap = document.createElement("div");
  wrap.className = "uptime-wrap";

  const bar = document.createElement("div");
  bar.className = "uptime-bar";

  const intervalSeconds = site?.intervalSeconds || 60;
  const intervalMs = intervalSeconds * 1000;
  const segments = rangeSegments(range);

  const buckets = Array.from({ length: segments }, (_, index) => ({
    offset: segments - index - 1,
    ok: 0,
    total: 0,
    downCount: 0,
  }));

  checks.forEach((entry) => {
    let offset = 0;
    if (range.type === "minutes") {
      offset = minutesAgo(entry.ts);
    } else if (range.type === "hours") {
      offset = hoursAgo(entry.ts);
    } else {
      offset = daysAgo(entry.ts);
    }

    if (offset >= 0 && offset < segments) {
      const bucket = buckets[segments - offset - 1];
      bucket.total += 1;
      if (entry.ok) bucket.ok += 1;
      else bucket.downCount += 1;
    }
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

    if (bucket.downCount > 0) {
      const downMs = bucket.downCount * intervalMs;
      const date = new Date();
      if (range.type === "minutes") {
        date.setMinutes(date.getMinutes() - bucket.offset);
      } else if (range.type === "hours") {
        date.setHours(date.getHours() - bucket.offset);
      } else {
        date.setDate(date.getDate() - bucket.offset);
      }
      seg.title = `Downtime: ${formatDuration(downMs)} (${formatDay(date)})`;
    }

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

function buildRecent(checks) {
  const list = document.createElement("div");
  list.className = "recent";
  const recent = checks.slice(0, RECENT_LIMIT);
  if (!recent.length) {
    const empty = document.createElement("div");
    empty.className = "recent-row";
    empty.innerHTML = "<span>No checks yet</span><span>—</span><span>—</span>";
    list.appendChild(empty);
    return list;
  }

  recent.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "recent-row";
    row.innerHTML = `
      <span>${formatTime(entry.ts)}</span>
      <span>${entry.ok ? "Online" : "Down"}</span>
      <span>${entry.latency_ms ? `${entry.latency_ms} ms` : "—"}</span>
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
  expandBtn.innerHTML = "Recent checks <span class=\"chev\">?</span>";

  const recentPanel = document.createElement("div");
  recentPanel.className = "recent-panel is-collapsed";
  const recent = buildRecent(checks);
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

  const timeline = buildTimeline(checks, range, site);

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

async function refreshAll() {
  if (!sites.length) return;

  const results = await Promise.all(
    sites.map(async (site) => {
      const [checksData, summary, latest] = await Promise.all([
        loadChecks(site.id, currentRange),
        loadSummary(site.id, currentRange),
        loadLatest(site.id),
      ]);
      return {
        site,
        checks: checksData.checks || [],
        summary,
        latest,
      };
    })
  );

  siteGrid.innerHTML = "";
  let anyDown = false;
  let anyUp = false;

  results.forEach((result) => {
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
  setBadge("idle", "Loading");
  await loadSites();
  setActiveRange(DEFAULT_RANGE);
  startRefresh();
});
