import { NextRequest, NextResponse } from "next/server";
import { dbOps } from "@/lib/db";
import { sites } from "@/lib/config";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days")) || 1;
  const siteIds = sites.map((s) => s.id);

  try {
    const { summaries, latests, checks } = await dbOps.getDashboardData(siteIds, days);

    const dashboardData = sites.map((site) => {
      const summary = summaries.find((s) => s.site_id === site.id);
      const latest = latests.find((l) => l.site_id === site.id);
      const siteChecks = checks.filter((c) => c.site_id === site.id);

      return {
        site,
        summary: summary ? {
          total: summary.total,
          okCount: summary.okCount,
          percent: summary.total ? Number(((summary.okCount / summary.total) * 100).toFixed(2)) : 0
        } : null,
        latest: latest || null,
        checks: siteChecks,
      };
    });

    return NextResponse.json({ data: dashboardData });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
