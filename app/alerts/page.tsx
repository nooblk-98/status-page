"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ArrowLeft, Moon, Activity, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function Alerts() {
  const [sites, setSites] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastRead, setLastRead] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem("alertsLastRead");
    if (saved) setLastRead(Number(saved));

    fetch("/api/sites")
      .then((res) => res.json())
      .then((data) => {
        setSites(data.sites);
        return data.sites;
      })
      .then(async (sites) => {
        const results = await Promise.all(
          sites.map(async (site: any) => {
            const res = await fetch(`/api/sites/${site.id}/checks?days=30`);
            const data = await res.json();
            return { site, checks: data.checks || [] };
          })
        );

        const allAlerts = results.flatMap(({ site, checks }) => {
          const windows: any[] = [];
          let current: any = null;
          const sorted = [...checks].sort((a, b) => a.ts - b.ts);

          sorted.forEach((entry) => {
            if (entry.ok) {
              if (current) {
                windows.push(current);
                current = null;
              }
              return;
            }
            if (!current) {
              current = { start: entry.ts, end: entry.ts, last: entry, site };
            } else {
              current.end = entry.ts;
              current.last = entry;
            }
          });
          if (current) windows.push(current);
          return windows;
        }).sort((a, b) => b.end - a.end);

        setAlerts(allAlerts);
      });
  }, []);

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem("alertsLastRead", String(now));
    setLastRead(now);
  };

  const unreadCount = alerts.filter(a => a.end > lastRead).length;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="text-indigo-600" />
            <span className="font-bold text-xl">Status Page</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">System Alerts</p>
          <h1 className="text-4xl font-bold tracking-tight">Recent Downtime</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft size={16} />
              Back to Dashboard
            </Button>
          </Link>
          <Button variant="ghost" size="sm">
            <Moon size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCircle size={16} />
            {unreadCount > 0 ? `Mark ${unreadCount} as read` : "All read"}
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center p-12 text-gray-500">No downtime alerts recorded in the last 30 days.</div>
        ) : (
          alerts.map((alert, i) => (
            <Card key={i} className={cn(
              "transition-all",
              alert.end > lastRead ? "border-amber-500 bg-amber-50/10 dark:bg-amber-500/5 shadow-md" : ""
            )}>
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{alert.site.name}</h3>
                  <p className="text-sm text-gray-500">{alert.site.url}</p>
                </div>
                {alert.last.error && (
                  <Badge variant="error" className="h-fit">
                    {alert.last.error}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 mt-6 border-top border-gray-100 dark:border-gray-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Time</span>
                  <span className="font-semibold">{format(alert.end, "MMM d, HH:mm:ss")}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Duration</span>
                  <span className="font-semibold">
                    {Math.round((alert.end - alert.start) / 60000)}m
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Status Code</span>
                  <span className="font-semibold">{alert.last.status_code || "--"}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <footer className="text-center text-sm text-gray-500 py-8">
        Developed by <a href="https://github.com/nooblk-98" className="font-bold hover:text-indigo-600">nooblk</a>
      </footer>
    </main>
  );
}
