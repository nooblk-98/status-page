import net from "net";
import { execFile } from "child_process";
import { dbOps, MonitorRow } from "@/lib/db";
import { sendAlert } from "@/features/notifications/server/notifications";

export interface CheckResult {
  ok: boolean;
  latency: number | null;
  statusCode: number | null;
  error: string | null;
}

/** Human-readable target for alerts/logging, independent of monitor type. */
export function monitorTarget(m: MonitorRow): string {
  if (m.type === "tcp") return `${m.host ?? ""}:${m.port ?? ""}`;
  if (m.type === "ping") return m.host ?? "";
  return m.url ?? "";
}

// ---------- Check executors ----------

async function checkHttp(m: MonitorRow): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), m.timeout_ms);
  const started = Date.now();
  try {
    const response = await fetch(m.url ?? "", {
      method: m.method || "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const latency = Date.now() - started;
    let ok =
      m.expected_status != null
        ? response.status === m.expected_status
        : response.ok;

    let error: string | null = ok ? null : `HTTP ${response.status}`;

    if (ok && m.keyword) {
      const body = await response.text();
      if (!body.includes(m.keyword)) {
        ok = false;
        error = `Keyword "${m.keyword}" not found`;
      }
    }

    return { ok, latency, statusCode: response.status, error };
  } catch (err: any) {
    return {
      ok: false,
      latency: null,
      statusCode: null,
      error: err.name === "AbortError" ? "Timeout" : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function checkTcp(m: MonitorRow): Promise<CheckResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const done = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(m.timeout_ms);
    socket.once("connect", () =>
      done({ ok: true, latency: Date.now() - started, statusCode: null, error: null })
    );
    socket.once("timeout", () =>
      done({ ok: false, latency: null, statusCode: null, error: "Timeout" })
    );
    socket.once("error", (err) =>
      done({ ok: false, latency: null, statusCode: null, error: err.message })
    );

    socket.connect(m.port ?? 0, m.host ?? "");
  });
}

function checkPing(m: MonitorRow): Promise<CheckResult> {
  return new Promise((resolve) => {
    const waitSec = Math.max(1, Math.ceil(m.timeout_ms / 1000));
    const started = Date.now();
    execFile(
      "ping",
      ["-c", "1", "-W", String(waitSec), m.host ?? ""],
      { timeout: m.timeout_ms + 1000 },
      (err, stdout) => {
        if (err) {
          resolve({ ok: false, latency: null, statusCode: null, error: "Host unreachable" });
          return;
        }
        const match = /time[=<]([\d.]+)/.exec(stdout);
        const latency = match ? Math.round(parseFloat(match[1])) : Date.now() - started;
        resolve({ ok: true, latency, statusCode: null, error: null });
      }
    );
  });
}

async function runCheck(m: MonitorRow): Promise<CheckResult> {
  switch (m.type) {
    case "tcp":
      return checkTcp(m);
    case "ping":
      return checkPing(m);
    case "http":
    default:
      return checkHttp(m);
  }
}

// ---------- Ping a monitor: check, detect state change, store ----------

export async function pingMonitor(m: MonitorRow): Promise<void> {
  const previous = await dbOps.getLatest(m.id);

  let result = await runCheck(m);
  if (!result.ok) {
    for (let retry = 0; retry < 3; retry += 1) {
      result = await runCheck(m);
      if (result.ok) break;
    }
  }

  if (previous && previous.ok !== (result.ok ? 1 : 0)) {
    const isUp = result.ok;
    console.log(`State change detected for ${m.name}: ${isUp ? "UP" : "DOWN"}`);
    sendAlert(
      { name: m.name, url: monitorTarget(m) },
      isUp,
      result.latency,
      result.error
    );
  }

  await dbOps.insertCheck({
    siteId: m.id,
    ts: Date.now(),
    ok: result.ok,
    latency: result.latency,
    statusCode: result.statusCode,
    error: result.error,
  });
}
