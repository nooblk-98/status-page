import { NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { monitorTarget } from "@/features/status/server/monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  const monitors = await dbOps.listMonitors({ enabledOnly: true });
  const sites = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    url: monitorTarget(m),
    type: m.type,
    intervalSeconds: m.interval_seconds,
  }));
  return NextResponse.json({ sites });
}
