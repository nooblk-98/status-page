"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Monitor, Settings, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

const links = [
  { href: "/admin", label: "Monitors", icon: Monitor },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-2">
        <Activity className="text-indigo-600" />
        <span className="font-bold text-xl">Admin</span>
      </div>
      <nav className="flex items-center gap-1">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href}>
              <Button variant={active ? "secondary" : "ghost"} size="sm" className="gap-2">
                <l.icon size={16} />
                {l.label}
              </Button>
            </Link>
          );
        })}
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft size={16} />
            Dashboard
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="gap-2" onClick={logout}>
          <LogOut size={16} />
          Logout
        </Button>
      </nav>
    </header>
  );
}
