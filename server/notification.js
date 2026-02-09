const nodemailer = require("nodemailer");

async function sendEmail(site, isUp, latency, error, config) {
    if (!config.enabled) return;

    const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });

    const subject = `[${isUp ? "RECOVERED" : "DOWN"}] ${site.name} is ${isUp ? "up" : "down"
        }`;
    const text = `
Site: ${site.name} (${site.url})
Status: ${isUp ? "RECOVERED" : "DOWN"}
Time: ${new Date().toLocaleString()}
${isUp ? `Latency: ${latency}ms` : `Error: ${error}`}
  `;

    try {
        const info = await transporter.sendMail({
            from: config.from,
            to: config.to,
            subject: subject,
            text: text,
        });
        console.log("Email sent: %s", info.messageId);
    } catch (err) {
        console.error("Error sending email:", err);
    }
}

async function sendGoogleChat(site, isUp, latency, error, config) {
    if (!config.enabled || !config.webhookUrl) return;

    const text = `*${isUp ? "RECOVERED" : "DOWN"}:* ${site.name} (${site.url
        })\nTime: ${new Date().toLocaleString()}\n${isUp ? `Latency: ${latency}ms` : `Error: ${error}`
        }`;

    try {
        await fetch(config.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        console.log("Google Chat alert sent");
    } catch (err) {
        console.error("Error sending Google Chat alert:", err);
    }
}

async function sendTeams(site, isUp, latency, error, config) {
    if (!config.enabled || !config.webhookUrl) return;

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
        await fetch(config.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(card),
        });
        console.log("Teams alert sent");
    } catch (err) {
        console.error("Error sending Teams alert:", err);
    }
}

const config = {
    email: {
        enabled: process.env.EMAIL_ENABLED === "true",
        host: process.env.EMAIL_HOST || "smtp.example.com",
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === "true",
        user: process.env.EMAIL_USER || "user@example.com",
        pass: process.env.EMAIL_PASS || "password",
        from: process.env.EMAIL_FROM || '"Status Page" <no-reply@example.com>',
        to: process.env.EMAIL_TO || "admin@example.com",
    },
    googleChat: {
        enabled: process.env.GOOGLE_CHAT_ENABLED === "true",
        webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL || "",
    },
    teams: {
        enabled: process.env.TEAMS_ENABLED === "true",
        webhookUrl: process.env.TEAMS_WEBHOOK_URL || "",
    },
};

async function sendAlert(site, isUp, latency, error) {
    if (config.email) {
        await sendEmail(site, isUp, latency, error, config.email);
    }
    if (config.googleChat) {
        await sendGoogleChat(site, isUp, latency, error, config.googleChat);
    }
    if (config.teams) {
        await sendTeams(site, isUp, latency, error, config.teams);
    }
}

module.exports = { sendAlert };
