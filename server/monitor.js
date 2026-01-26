const DEFAULT_INTERVAL = 60;

async function pingSite(site, db) {
  const controller = new AbortController();
  const timeoutMs = site.timeoutMs || 8000;
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

  await db.insertCheck({
    siteId: site.id,
    ts: Date.now(),
    ok,
    latency,
    statusCode,
    error,
  });
}

function startMonitoring({ db, sites }) {
  sites.forEach((site) => {
    const intervalSeconds = site.intervalSeconds || DEFAULT_INTERVAL;
    pingSite(site, db).catch((err) => console.error("Initial ping failed", err));
    setInterval(() => {
      pingSite(site, db).catch((err) => console.error("Ping failed", err));
    }, intervalSeconds * 1000);
  });
}

module.exports = { startMonitoring };
