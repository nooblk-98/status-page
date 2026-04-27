import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import { SiteConfig } from "@/lib/config";

async function sendEmail(site: SiteConfig, isUp: boolean, latency: number | null, error: string | null) {
  if (!env.EMAIL_ENABLED || !env.EMAIL_HOST || !env.EMAIL_USER || !env.EMAIL_PASS || !env.EMAIL_TO) return;

  const transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_SECURE,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
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
      from: env.EMAIL_FROM,
      to: env.EMAIL_TO,
      subject: subject,
      text: text,
    });
    console.log("Email sent: %s", info.messageId);
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

async function sendGoogleChat(site: SiteConfig, isUp: boolean, latency: number | null, error: string | null) {
  if (!env.GOOGLE_CHAT_ENABLED || !env.GOOGLE_CHAT_WEBHOOK_URL) return;

  const text = `*${isUp ? "RECOVERED" : "DOWN"}:* ${site.name} (${site.url})\nTime: ${new Date().toLocaleString()}\n${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}`;

  try {
    await fetch(env.GOOGLE_CHAT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    console.log("Google Chat alert sent");
  } catch (err) {
    console.error("Error sending Google Chat alert:", err);
  }
}

async function sendTeams(site: SiteConfig, isUp: boolean, latency: number | null, error: string | null) {
  if (!env.TEAMS_ENABLED || !env.TEAMS_WEBHOOK_URL) return;

  const color = isUp ? "00FF00" : "FF0000";
  const title = `${isUp ? "RECOVERED" : "DOWN"}: ${site.name}`;
  const text = `
**Site:** ${site.name} (${site.url})
**Status:** ${isUp ? "RECOVERED" : "DOWN"}
**Time:** ${new Date().toLocaleString()}
${isUp ? `**Latency:** ${latency}ms` : `**Error:** ${error}`}
  `;

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
    await fetch(env.TEAMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    console.log("Teams alert sent");
  } catch (err) {
    console.error("Error sending Teams alert:", err);
  }
}

export async function sendAlert(site: SiteConfig, isUp: boolean, latency: number | null, error: string | null) {
  await Promise.allSettled([
    sendEmail(site, isUp, latency, error),
    sendGoogleChat(site, isUp, latency, error),
    sendTeams(site, isUp, latency, error),
  ]);
}
