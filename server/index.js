const path = require("path");
const express = require("express");
const { initDb } = require("./db");
const { startMonitoring } = require("./monitor");
const sites = require("../config");

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

app.get("/api/sites", (req, res) => {
  res.json({ sites });
});

app.get("/api/sites/:id/summary", async (req, res) => {
  const { getSummary } = req.app.locals.db;
  const days = Number(req.query.days) || 30;
  const siteId = req.params.id;
  try {
    const summary = await getSummary(siteId, days);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to load summary" });
  }
});

app.get("/api/sites/:id/checks", async (req, res) => {
  const { listChecks } = req.app.locals.db;
  const days = Number(req.query.days) || 30;
  const siteId = req.params.id;
  try {
    const checks = await listChecks(siteId, days);
    res.json({ checks });
  } catch (error) {
    res.status(500).json({ error: "Failed to load checks" });
  }
});

app.get("/api/sites/:id/latest", async (req, res) => {
  const { getLatest } = req.app.locals.db;
  const siteId = req.params.id;
  try {
    const latest = await getLatest(siteId);
    res.json({ latest });
  } catch (error) {
    res.status(500).json({ error: "Failed to load latest" });
  }
});

async function start() {
  const db = await initDb(path.join(__dirname, "..", "data", "status.db"));
  app.locals.db = db;
  startMonitoring({ db, sites });
  app.listen(port, () => {
    console.log(`Status page running on http://localhost:${port}`);
  });
}

start();
