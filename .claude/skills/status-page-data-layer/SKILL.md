---
name: status-page-data-layer
description: >
  Conventions for the SQLite data layer in this status-page app (lib/db.ts). Use this skill whenever
  adding tables, columns, queries, or dbOps methods, writing migrations, or persisting configuration
  (monitors, settings, checks). Trigger on phrases like "add a table", "add a column", "store a setting",
  "query the database", "add a dbOps method", "migrate the schema", or any change touching lib/db.ts,
  lib/seed.ts, or SQLite persistence. Apply automatically when working with data persistence here.
---

# Status Page Data Layer

This project persists everything in a single file-based SQLite database via the `sqlite3` package.
There is **no ORM**. All access goes through `lib/db.ts`.

## Core rules

1. **Use the promise helpers, never raw callbacks.** `lib/db.ts` wraps `sqlite3` in three helpers:
   - `run(sql, params)` — INSERT/UPDATE/DELETE/DDL; resolves to the statement (`this`, has `lastID`/`changes`).
   - `all<T>(sql, params)` — multi-row SELECT.
   - `get<T>(sql, params)` — single-row SELECT (or `undefined`).
   Always pass values as `params` (parameterized `?`), never string-interpolate user input.

2. **Migrations are additive and idempotent, inside `initDb()`.** There is no migration runner.
   Schema evolution = add `CREATE TABLE IF NOT EXISTS ...` / `CREATE INDEX IF NOT EXISTS ...` to `initDb()`,
   or guarded `ALTER TABLE` for new columns (check `PRAGMA table_info` before adding, since SQLite has no
   `ADD COLUMN IF NOT EXISTS`). `initDb()` runs on every server start via `instrumentation.ts`, so it MUST be
   safe to re-run. Never drop or rename columns that hold live data.

3. **Never break `checks.site_id` compatibility.** The `checks` table is keyed by `site_id TEXT`.
   Monitor IDs are **TEXT slugs** and must stay stable so historical check rows remain linked. Do not switch
   monitor IDs to integers, and do not rename existing seeded IDs.

4. **Settings are a key/value JSON table.** The `settings` table is `(key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)`
   where `value` is a JSON blob. One row per logical group: `branding`, `notifications`, `retention`, `admin`.
   Read with `getSetting<T>(key)` (JSON.parse, returns `undefined` if absent); write with
   `setSetting(key, obj)` using `INSERT ... ON CONFLICT(key) DO UPDATE SET value=?, updated_at=?`.
   Do NOT add a column per setting — add a new key instead.

## dbOps method naming

All query logic lives in the exported `dbOps` object. Conventions:
- `listX(opts?)` → array; `getX(id)` → single or undefined; `insertX(obj)`; `updateX(id, patch)` (always set `updated_at = Date.now()`); `deleteX(id)`; `countX()`.
- Timestamps are epoch **milliseconds** (`Date.now()`), stored as INTEGER. Booleans are `0`/`1` INTEGER.
- Keep batch/dashboard queries (e.g. `getDashboardData(siteIds[], days)`) returning raw rows; shape them in the route, not the dbOps method.

## Delete semantics

Deleting a monitor removes the `monitors` row but **retains its `checks` history** (so an accidental delete
doesn't destroy uptime data). Provide history purge only as a separate explicit operation (`pruneChecks(beforeTs)`).

## Where things live

- Schema + helpers + `dbOps`: `lib/db.ts`
- First-run seeding (only when a table/row is empty): `lib/seed.ts`
- Typed setting resolvers with env fallback: `lib/settings.ts`
