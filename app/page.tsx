"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Timeline } from "@/features/status/components/Timeline";
import Link from "next/link";
import { Search, Moon, Sun, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { NotificationDropdown } from "@/components/ui/NotificationDropdown";

interface Site {
  id: string;
  name: string;
  url: string;
}

interface SiteData {
  site: Site;
  summary: { total: number; okCount: number; percent: number } | null;
  latest: { ts: number; ok: number; latency_ms: number | null } | null;
  checks: any[];
}

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const [siteDataList, setSiteDataList] = useState<SiteData[]>([]);
  const [range, setRange] = useState({ type: "minutes", value: 60 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const days = range.type === "minutes" ? range.value / 1440 : range.type === "hours" ? range.value / 24 : range.value;
    try {
      const res = await fetch(`/api/dashboard?days=${days}`);
      const result = await res.json();
      if (result.data) {
        setSiteDataList(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const filteredSiteData = siteDataList.filter(d =>
    d.site.name.toLowerCase().includes(search.toLowerCase()) ||
    d.site.url.toLowerCase().includes(search.toLowerCase())
  );

  const anyDown = siteDataList.some(d => d.latest && !d.latest.ok);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="text-indigo-600" />
            <span className="font-bold text-xl">Status Page</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Uptime you can trust</h1>
          <p className="text-muted">Simple Modern looking Uptime Monitor.</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--secondary-bg)]">
             <div className={cn("w-2 h-2 rounded-full animate-pulse", anyDown ? "bg-rose-500" : "bg-emerald-500")} />
             <span className="text-xs font-medium">{anyDown ? "Issues detected" : "All systems normal"}</span>
          </div>
        </div>
      </header>

      <Card className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 space-y-2 w-full">
          <label className="text-xs font-bold uppercase tracking-wider text-muted">History window</label>
          <div className="flex gap-1 bg-[var(--secondary-bg)] p-1 rounded-lg w-fit">
            {[
              { type: "minutes", value: 60, label: "60 min" },
              { type: "hours", value: 24, label: "24 hours" },
              { type: "days", value: 30, label: "30 days" },
              { type: "days", value: 90, label: "90 days" },
            ].map((r) => (
              <button
                key={`${r.type}-${r.value}`}
                onClick={() => {
                  setLoading(true);
                  setRange(r);
                }}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                  range.type === r.type && range.value === r.value
                    ? "bg-[var(--card-bg)] shadow-sm"
                    : "text-muted hover:text-[var(--foreground)]"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-[2] space-y-2 w-full">
          <label className="text-xs font-bold uppercase tracking-wider text-muted">Search monitors</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              placeholder="Search by name or URL"
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-4 text-xs font-medium text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" /> Down
          </div>
        </div>
      </Card>

      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity", loading && "opacity-50")}>
        {filteredSiteData.map((data) => {
          const { site } = data;
          return (
            <Link key={site.id} href={`/monitor/${site.id}`}>
              <Card className="hover:border-indigo-500/50 transition-colors cursor-pointer space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{site.name}</h3>
                    <p className="text-sm text-muted flex items-center gap-1">
                      <span className="text-[10px] font-bold px-1 rounded bg-[var(--secondary-bg)] uppercase">
                        {site.url.startsWith("https") ? "HTTPS" : "HTTP"}
                      </span>
                      {site.url.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                  {data?.latest && (
                    <Badge variant={data.latest.ok ? "success" : "error"}>
                      {data.latest.ok ? "Online" : "Down"}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 py-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Last Checked</span>
                    <span className="block text-xs font-semibold">
                      {data?.latest ? new Date(data.latest.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Uptime</span>
                    <span className="block text-xs font-semibold">
                      {data?.summary ? `${data.summary.percent}%` : "--"}
                    </span>
                  </div>
                   <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Checks</span>
                    <span className="block text-xs font-semibold">
                      {data?.summary ? data.summary.total : 0}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Latency</span>
                    <span className={cn(
                      "block text-sm font-bold",
                      data?.latest?.latency_ms && data.latest.latency_ms < 200 ? "text-emerald-500" : "text-[var(--foreground)]"
                    )}>
                      {data?.latest?.latency_ms ?? "--"} ms
                    </span>
                  </div>
                </div>

                <Timeline checks={data?.checks || []} range={range} />
              </Card>
            </Link>
          );
        })}
      </div>

      <footer className="text-center text-sm text-muted py-8">
        Developed by <a href="https://github.com/nooblk-98" className="font-bold hover:text-indigo-600">nooblk</a>
      </footer>
    </main>
  );
}
