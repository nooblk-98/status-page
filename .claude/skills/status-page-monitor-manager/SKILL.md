---
name: status-page-monitor-manager
description: >
  How the runtime monitor manager and check executors work in this status-page app. Use this skill whenever
  adding a monitor check type, changing how monitors are scheduled/pinged, working with the background
  monitoring loop, retention cleanup, or anything in features/status/server/*. Trigger on phrases like
  "add a check type", "schedule a monitor", "ping logic", "background job", "reschedule monitors live",
  "monitor manager", or "retention cleanup". Apply automatically when touching the monitoring runtime.
---

# Status Page Monitor Manager

Monitoring runs **in the Next.js Node server process**, started from `instrumentation.ts`
(`NEXT_RUNTIME === "nodejs"` only). It must support live add/edit/delete of monitors **without a restart**.

## The singleton (`features/status/server/manager.ts`)

The manager is a **module-level singleton stashed on `globalThis`** so it survives dev HMR and is the
same instance across every API route handler in the single Node process:

```ts
const g = globalThis as any;
export const monitorManager = g.__spMonitorManager ?? (g.__spMonitorManager = createManager());
```

API surface:
- `start()` — idempotent (guard with a `started` flag); calls `reloadFromDb()` then `startRetentionJob()`.
- `reloadFromDb()` — read enabled monitors, diff against the live handle map, add/update/remove to match.
- `addOrUpdate(row)` — clear any existing `setInterval` for `row.id`, run one immediate `pingMonitor(row)`,
  then `setInterval(... , interval_seconds*1000)`, storing the handle in `Map<string, NodeJS.Timeout>`.
  If `row.enabled === 0`, treat as `remove(row.id)`.
- `remove(id)` — `clearInterval` + map delete.
- `startRetentionJob()` — a daily `setInterval` that calls `dbOps.pruneChecks(Date.now() - retentionDays*86400000)`.

**The write-then-notify rule:** admin API mutations write the DB first, then call `monitorManager.addOrUpdate(row)`
or `.remove(id)`. That is what makes changes go live immediately.

**Caveat:** this assumes a single Node instance. If the app is ever horizontally scaled, each process owns its
own intervals and would double-ping. Current Docker deployment is single-instance.

## Check executors (`features/status/server/monitor.ts`)

`pingMonitor(row)` dispatches on `row.type` and returns `{ ok, latency, statusCode, error }`:
- `http` — `fetch(row.url, { method: row.method, cache: 'no-store', signal })` with an AbortController timeout
  (`row.timeout_ms`). `ok` = `row.expected_status ? status === expected_status : response.ok`. If `row.keyword`
  is set, also require the response body to contain it.
- `tcp` — `net.Socket().connect(row.port, row.host)` with `setTimeout(row.timeout_ms)`; `ok` = `connect` fired
  before `timeout`/`error`. Measure latency from connect start. Always `socket.destroy()`.
- `ping` — shell out: `child_process.execFile('ping', ['-c','1','-W',<sec>, row.host])`; `ok` = exit 0; parse
  rtt from stdout for latency. (Busybox ping ships in the alpine image; ICMP may need `cap_add: [NET_RAW]`.)

Keep the surrounding behaviour identical regardless of type: fetch previous state via `dbOps.getLatest(id)`,
retry up to 3 times on failure, detect UP↔DOWN state change and call `sendAlert(monitor, isUp, latency, error)`,
then `dbOps.insertCheck(...)`.

## Startup order (`instrumentation.ts`)

`initDb()` → `seedMonitorsIfEmpty()` → `seedSettingsDefaults()` → `monitorManager.start()`. Wrap in try/catch
and log; a failure here must not crash the server.
