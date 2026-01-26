# status-page

Modern status page with live monitoring and a 30-day SQLite history.

## Folder structure
```
status-page/
  config.js
  data/            # SQLite database (created on first run)
  public/          # Frontend assets
  server/          # API + monitoring service
```

## Configure sites
Edit `config.js` and add your endpoints:
```js
module.exports = [
  { id: "api", name: "API", url: "https://example.com/health", intervalSeconds: 3600 }
];
```

## Run locally
```
npm install
npm start
```
Then open `http://localhost:3000`.

## Docker
```
docker compose up --build
```
Then open `http://localhost:8080`.
