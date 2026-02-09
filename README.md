<div align="center">
  <img src="./images/logo.svg" width="360" alt="status-page logo" />

# Status Page – Uptime Monitor

**Modern status dashboard with live checks, downtime alerts, and a clean UI.**

[![Node](https://img.shields.io/badge/node-18%2B-3c873a?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/sqlite-3-003b57?logo=sqlite&logoColor=white)](https://www.sqlite.org/index.html)
[![Docker](https://img.shields.io/badge/Docker-20.10+-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)

[Live Demo](https://status.itsnooblk.com)

</div>

---

## UI Preview

![UI Preview](./images/ui.png)

---

### What is included

- Live monitor checks with configurable intervals and timeouts.
- SQLite storage with rolling 30‑day history.
- Uptime bars + downtime window overlays.
- Alerts page with mark‑as‑read.
- Search + suggestions for monitors.
- Light/Dark theme toggle.

---

## Features

### Monitoring
- Per‑monitor check interval and timeout in `config.js`.
- HTTP status and error details stored per check.
- Automatic uptime percentage calculation.

### UI/UX
- Clean card layout with timeline visualization.
- Recent downtime details (status code, error, duration).
- Search and quick suggestions for monitors.

### Operations
- Docker compose support with persistent SQLite volume.
- Timezone configurable via `TZ` in compose.
- Simple Node + Express server.

---

## Quick Start

### Option 1: Local dev

```bash
npm install
npm start
```
Open `http://localhost:3000`.

### Option 2: Docker Compose

```bash
docker compose up --build
```

If you want container timezone:

```yaml
environment:
  - TZ=Asia/Colombo
```

---

## Configuration

Edit `config.js`:

```js
const intervalSeconds = 30;
const timeoutMs = 8000;

module.exports = [
  {
    id: "my-web",
    name: "My Website",
    url: "https://example.com",
    intervalSeconds,
    timeoutMs,
  },
];
```

---

---

## Notifications

You can configure notifications for **Email**, **Google Chat**, and **Microsoft Teams** by creating a `.env` file in the root directory (or setting system environment variables).

### Supported Variables

```env
# Email Configuration
EMAIL_ENABLED=true
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=user@example.com
EMAIL_PASS=password
EMAIL_FROM="Status Page" <no-reply@example.com>
EMAIL_TO=admin@example.com

# Google Chat Configuration
GOOGLE_CHAT_ENABLED=true
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/...

# MS Teams Configuration
TEAMS_ENABLED=true
TEAMS_WEBHOOK_URL=https://outlook.office.com/...
```

---

## Pages

- Main dashboard: `/` (served from `public/index.html`)
- Alerts page: `/alerts.html`

---

## Project Structure

```
status-page/
  config.js            # Monitor configuration
  data/                # SQLite database (created on first run)
  public/              # Frontend assets
  server/              # API + monitoring service
```

---

## Troubleshooting

- No checks appearing: confirm `config.js` URLs are reachable and server is running.
- Alerts empty: only downtime windows appear (consecutive failed checks).
- Docker timezone: set `TZ=Asia/Colombo` under the service environment.

---

## Contributing

1) Fork and create a feature branch. 2) Make changes with tests or manual checks. 3) Update docs when behavior changes. 4) Open a PR with a clear summary.

---

## 📝 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).
See [LICENSE](LICENSE) for full details.

---

<div align="center">

**Developed by nooblk**

[⬆ Back to top](#status-page--uptime-monitor)

</div>
