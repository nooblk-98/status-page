const DEFAULT_INTERVAL = 60;
const { sendAlert } = require("./notification");

async function pingSite(site, db) {
  const timeoutMs = site.timeoutMs || 8000;

  async function attempt() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    let ok = false;
    let latency = null;
    let statusCode = null;
    let error = null;

    try {
      const response = await fetch(site.url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      statusCode = response.status;
      ok = response.ok;
      latency = Date.now() - started;
    } catch (err) {
      error = err.name === "AbortError" ? "Timeout" : err.message;
      ok = false;
    } finally {
      clearTimeout(timer);
    }

    return { ok, latency, statusCode, error };
  }

  // Get previous state
  const previous = await db.getLatest(site.id);

  let result = await attempt();
  if (!result.ok) {
    for (let retry = 0; retry < 3; retry += 1) {
      result = await attempt();
      if (result.ok) break;
    }
  }

  // Check for state change
  if (previous && previous.ok !== (result.ok ? 1 : 0)) {
    const isUp = result.ok;
    console.log(
      `State change detected for ${site.name}: ${isUp ? "UP" : "DOWN"}`
    );
    sendAlert(site, isUp, result.latency, result.error);
  }

  await db.insertCheck({
    siteId: site.id,
    ts: Date.now(),
    ok: result.ok,
    latency: result.latency,
    statusCode: result.statusCode,
    error: result.error,
  });
}

function startMonitoring({ db, sites }) {
  sites.forEach((site) => {
    const intervalSeconds = site.intervalSeconds || DEFAULT_INTERVAL;
    pingSite(site, db).catch((err) =>
      console.error("Initial ping failed", err)
    );
    setInterval(() => {
      pingSite(site, db).catch((err) =>
        console.error("Ping failed", err)
      );
    }, intervalSeconds * 1000);
  });
}

module.exports = { startMonitoring };
