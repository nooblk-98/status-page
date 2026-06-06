import nodemailer from "nodemailer";
import { getNotificationConfig, NotificationConfig } from "@/lib/settings";

export interface AlertTarget {
  name: string;
  url: string;
}

async function sendEmail(
  cfg: NotificationConfig["email"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.pass || !cfg.to) return;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = `[${isUp ? "RECOVERED" : "DOWN"}] ${site.name} is ${isUp ? "up" : "down"}`;
  const text = `
Site: ${site.name} (${site.url})
Status: ${isUp ? "RECOVERED" : "DOWN"}
Time: ${new Date().toLocaleString()}
${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}
  `;

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to: cfg.to,
      subject,
      text,
    });
    console.log("Email sent: %s", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

async function sendGoogleChat(
  cfg: NotificationConfig["googleChat"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.webhookUrl) return;

  const text = `*${isUp ? "RECOVERED" : "DOWN"}:* ${site.name} (${site.url})\nTime: ${new Date().toLocaleString()}\n${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}`;

  try {
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    console.log("Google Chat alert sent");
  } catch (err) {
    console.error("Error sending Google Chat alert:", err);
  }
}

async function sendTeams(
  cfg: NotificationConfig["teams"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.webhookUrl) return;

  const color = isUp ? "00FF00" : "FF0000";
  const title = `${isUp ? "RECOVERED" : "DOWN"}: ${site.name}`;

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: title,
    sections: [
      {
        activityTitle: title,
        activitySubtitle: site.url,
        activityImage: "",
        facts: [
          { name: "Status", value: isUp ? "RECOVERED" : "DOWN" },
          { name: "Time", value: new Date().toLocaleString() },
          {
            name: isUp ? "Latency" : "Error",
            value: isUp ? `${latency}ms` : error,
          },
        ],
        markdown: true,
      },
    ],
  };

  try {
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    console.log("Teams alert sent");
  } catch (err) {
    console.error("Error sending Teams alert:", err);
  }
}

async function sendTelegram(
  cfg: NotificationConfig["telegram"],
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return;

  const text = `${isUp ? "✅ RECOVERED" : "🔴 DOWN"}: ${site.name} (${site.url})\nTime: ${new Date().toLocaleString()}\n${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}`;

  try {
    await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, text }),
    });
    console.log("Telegram alert sent");
  } catch (err) {
    console.error("Error sending Telegram alert:", err);
  }
}

export async function sendAlert(
  site: AlertTarget,
  isUp: boolean,
  latency: number | null,
  error: string | null
) {
  const cfg = await getNotificationConfig();
  await Promise.allSettled([
    sendEmail(cfg.email, site, isUp, latency, error),
    sendGoogleChat(cfg.googleChat, site, isUp, latency, error),
    sendTeams(cfg.teams, site, isUp, latency, error),
    sendTelegram(cfg.telegram, site, isUp, latency, error),
  ]);
}
