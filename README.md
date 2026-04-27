# Status Page – Uptime Monitor

**Modern status dashboard built with Next.js, featuring live checks, downtime alerts, and a clean UI.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite&logoColor=white)](https://www.sqlite.org/index.html)

---

## Quick Start

### Local Development

```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm run start
```

---

## Features

- **Live Monitoring**: Background checks with configurable intervals and timeouts.
- **Modern UI**: Clean dashboard built with Next.js App Router and Tailwind CSS.
- **Timeline View**: Visual history of site health and latency.
- **Alerts**: Dedicated alerts page for tracking downtime events.
- **Notifications**: Support for Email, Google Chat, and MS Teams.

---

## Configuration

Edit `lib/config.ts` to manage your monitors:

```typescript
export const sites: SiteConfig[] = [
  {
    id: "my-web",
    name: "My Website",
    url: "https://example.com",
    intervalSeconds: 30,
    timeoutMs: 8000,
  },
];
```

---

## Notifications

Set up environment variables in `.env` for alerts:

```env
# Email
EMAIL_ENABLED=true
EMAIL_HOST=smtp.example.com
EMAIL_USER=user@example.com
EMAIL_PASS=password
EMAIL_TO=admin@example.com

# Webhooks
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/...
TEAMS_WEBHOOK_URL=https://outlook.office.com/...
```

---

## Project Structure (Feature-First)

- **app/**: Routes, layouts, and metadata.
- **features/**: Domain logic (status monitoring, notifications).
- **components/ui/**: Reusable UI components.
- **lib/**: Cross-feature utilities (database, config, env validation).

---

## License

This project is licensed under the AGPL-3.0 License.
