import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { env } from "./env";

const dbPath = path.isAbsolute(env.DATABASE_URL)
  ? env.DATABASE_URL
  : path.join(process.cwd(), env.DATABASE_URL);

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

export interface CheckEntry {
  id?: number;
  site_id: string;
  ts: number;
  ok: number;
  latency_ms: number | null;
  status_code: number | null;
  error: string | null;
}

export interface Summary {
  total: number;
  okCount: number;
  percent: number;
}

function run(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export async function initDb() {
  await run(
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
  await run("CREATE INDEX IF NOT EXISTS idx_checks_site_ts ON checks(site_id, ts)");
}

export const dbOps = {
  async insertCheck(entry: {
    siteId: string;
    ts: number;
    ok: boolean;
    latency?: number | null;
    statusCode?: number | null;
    error?: string | null;
  }) {
    await run(
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
  async listChecks(siteId: string, days: number): Promise<CheckEntry[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return all<CheckEntry>(
      "SELECT site_id, ts, ok, latency_ms, status_code, error FROM checks WHERE site_id = ? AND ts >= ? ORDER BY ts DESC",
      [siteId, cutoff]
    );
  },
  async getLatest(siteId: string): Promise<CheckEntry | undefined> {
    return get<CheckEntry>(
      "SELECT site_id, ts, ok, latency_ms, status_code, error FROM checks WHERE site_id = ? ORDER BY ts DESC LIMIT 1",
      [siteId]
    );
  },
  async getSummary(siteId: string, days: number): Promise<Summary> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = await all<{ ok: number }>(
      "SELECT ok FROM checks WHERE site_id = ? AND ts >= ?",
      [siteId, cutoff]
    );
    const total = rows.length;
    const okCount = rows.filter((row) => row.ok).length;
    const percent = total ? Number(((okCount / total) * 100).toFixed(2)) : 0;
    return { total, okCount, percent };
  },
};
