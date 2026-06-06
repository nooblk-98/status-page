"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Field } from "@/components/ui/Input";

interface SettingsState {
  branding: {
    siteName: string;
    tagline: string;
    description: string;
    footerText: string;
    footerLinkText: string;
    footerLinkUrl: string;
    metaTitle: string;
    metaDescription: string;
  };
  notifications: {
    email: {
      enabled: boolean;
      host?: string | null;
      port: number;
      secure: boolean;
      user?: string | null;
      pass?: string | null;
      from: string;
      to?: string | null;
    };
    googleChat: { enabled: boolean; webhookUrl?: string | null };
    teams: { enabled: boolean; webhookUrl?: string | null };
    telegram: { enabled: boolean; botToken?: string | null; chatId?: string | null };
  };
  retention: { days: number };
}

export function SettingsForm() {
  const [state, setState] = useState<SettingsState | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then(setState)
      .catch(() => setError("Failed to load settings"));
  }, []);

  if (!state) {
    return <Card className="p-8 text-center text-muted">Loading settings…</Card>;
  }

  const patch = (section: keyof SettingsState, value: any) =>
    setState((s) => (s ? { ...s, [section]: { ...(s as any)[section], ...value } } : s));

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const body: any = {
      branding: state!.branding,
      notifications: state!.notifications,
      retention: state!.retention,
    };
    if (password.trim()) body.password = password.trim();

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("Settings saved. Reload the dashboard to see branding changes.");
      setPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save settings");
    }
  }

  const b = state.branding;
  const n = state.notifications;

  return (
    <div className="space-y-6">
      {/* Branding */}
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">Branding</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Site name">
            <Input value={b.siteName} onChange={(e) => patch("branding", { siteName: e.target.value })} />
          </Field>
          <Field label="Tagline">
            <Input value={b.tagline} onChange={(e) => patch("branding", { tagline: e.target.value })} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={b.description} onChange={(e) => patch("branding", { description: e.target.value })} />
        </Field>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Footer text">
            <Input value={b.footerText} onChange={(e) => patch("branding", { footerText: e.target.value })} />
          </Field>
          <Field label="Footer link text">
            <Input value={b.footerLinkText} onChange={(e) => patch("branding", { footerLinkText: e.target.value })} />
          </Field>
          <Field label="Footer link URL">
            <Input value={b.footerLinkUrl} onChange={(e) => patch("branding", { footerLinkUrl: e.target.value })} />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Meta title (browser tab)">
            <Input value={b.metaTitle} onChange={(e) => patch("branding", { metaTitle: e.target.value })} />
          </Field>
          <Field label="Meta description">
            <Input value={b.metaDescription} onChange={(e) => patch("branding", { metaDescription: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="space-y-5">
        <h2 className="text-lg font-bold">Notifications</h2>

        <div className="space-y-3">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={n.email.enabled}
              onChange={(e) => patch("notifications", { email: { ...n.email, enabled: e.target.checked } })}
              className="h-4 w-4 accent-indigo-600"
            />
            Email (SMTP)
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Host">
              <Input value={n.email.host ?? ""} onChange={(e) => patch("notifications", { email: { ...n.email, host: e.target.value } })} />
            </Field>
            <Field label="Port">
              <Input type="number" value={n.email.port} onChange={(e) => patch("notifications", { email: { ...n.email, port: Number(e.target.value) } })} />
            </Field>
            <Field label="User">
              <Input value={n.email.user ?? ""} onChange={(e) => patch("notifications", { email: { ...n.email, user: e.target.value } })} />
            </Field>
            <Field label="Password">
              <Input type="password" value={n.email.pass ?? ""} onChange={(e) => patch("notifications", { email: { ...n.email, pass: e.target.value } })} placeholder="leave masked to keep" />
            </Field>
            <Field label="From">
              <Input value={n.email.from} onChange={(e) => patch("notifications", { email: { ...n.email, from: e.target.value } })} />
            </Field>
            <Field label="To">
              <Input value={n.email.to ?? ""} onChange={(e) => patch("notifications", { email: { ...n.email, to: e.target.value } })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={n.email.secure}
              onChange={(e) => patch("notifications", { email: { ...n.email, secure: e.target.checked } })}
              className="h-4 w-4 accent-indigo-600"
            />
            Use TLS (secure)
          </label>
        </div>

        <div className="space-y-2 border-t border-[var(--card-border)] pt-4">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={n.googleChat.enabled}
              onChange={(e) => patch("notifications", { googleChat: { ...n.googleChat, enabled: e.target.checked } })}
              className="h-4 w-4 accent-indigo-600"
            />
            Google Chat
          </label>
          <Field label="Webhook URL">
            <Input value={n.googleChat.webhookUrl ?? ""} onChange={(e) => patch("notifications", { googleChat: { ...n.googleChat, webhookUrl: e.target.value } })} />
          </Field>
        </div>

        <div className="space-y-2 border-t border-[var(--card-border)] pt-4">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={n.teams.enabled}
              onChange={(e) => patch("notifications", { teams: { ...n.teams, enabled: e.target.checked } })}
              className="h-4 w-4 accent-indigo-600"
            />
            Microsoft Teams
          </label>
          <Field label="Webhook URL">
            <Input value={n.teams.webhookUrl ?? ""} onChange={(e) => patch("notifications", { teams: { ...n.teams, webhookUrl: e.target.value } })} />
          </Field>
        </div>

        <div className="space-y-2 border-t border-[var(--card-border)] pt-4">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={n.telegram.enabled}
              onChange={(e) => patch("notifications", { telegram: { ...n.telegram, enabled: e.target.checked } })}
              className="h-4 w-4 accent-indigo-600"
            />
            Telegram
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Bot token">
              <Input
                type="password"
                value={n.telegram.botToken ?? ""}
                onChange={(e) => patch("notifications", { telegram: { ...n.telegram, botToken: e.target.value } })}
                placeholder="from @BotFather (leave masked to keep)"
              />
            </Field>
            <Field label="Chat ID">
              <Input
                value={n.telegram.chatId ?? ""}
                onChange={(e) => patch("notifications", { telegram: { ...n.telegram, chatId: e.target.value } })}
                placeholder="e.g. 123456789"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Retention + password */}
      <Card className="space-y-4">
        <h2 className="text-lg font-bold">Data & security</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Retention (days of history kept)">
            <Input
              type="number"
              min={1}
              value={state.retention.days}
              onChange={(e) => patch("retention", { days: Number(e.target.value) })}
            />
          </Field>
          <Field label="Change admin password (optional)">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="leave blank to keep current"
            />
          </Field>
        </div>
      </Card>

      <div className="flex items-center gap-4 sticky bottom-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {message && <span className="text-sm text-emerald-500">{message}</span>}
        {error && <span className="text-sm text-rose-500">{error}</span>}
      </div>
    </div>
  );
}
