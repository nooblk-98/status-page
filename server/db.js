const sqlite3 = require("sqlite3").verbose();

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initDb(filename) {
  const db = new sqlite3.Database(filename);
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      ok INTEGER NOT NULL,
      latency_ms INTEGER,
      status_code INTEGER,
      error TEXT
    )`
  );
  await run(db, "CREATE INDEX IF NOT EXISTS idx_checks_site_ts ON checks(site_id, ts)");

  return {
    async insertCheck(entry) {
      await run(
        db,
        "INSERT INTO checks (site_id, ts, ok, latency_ms, status_code, error) VALUES (?, ?, ?, ?, ?, ?)",
        [
          entry.siteId,
          entry.ts,
          entry.ok ? 1 : 0,
          entry.latency ?? null,
          entry.statusCode ?? null,
          entry.error ?? null,
        ]
      );
    },
    async listChecks(siteId, days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return all(
        db,
        "SELECT site_id, ts, ok, latency_ms, status_code, error FROM checks WHERE site_id = ? AND ts >= ? ORDER BY ts DESC",
        [siteId, cutoff]
      );
    },
    async getLatest(siteId) {
      return get(
        db,
        "SELECT site_id, ts, ok, latency_ms, status_code, error FROM checks WHERE site_id = ? ORDER BY ts DESC LIMIT 1",
        [siteId]
      );
    },
    async getSummary(siteId, days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const rows = await all(
        db,
        "SELECT ok FROM checks WHERE site_id = ? AND ts >= ?",
        [siteId, cutoff]
      );
      const total = rows.length;
      const okCount = rows.filter((row) => row.ok).length;
      const percent = total ? Number(((okCount / total) * 100).toFixed(2)) : 0;
      return { total, okCount, percent };
    },
  };
}

module.exports = { initDb };
