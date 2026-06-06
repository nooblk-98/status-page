---
name: status-page-auth
description: >
  Single-password admin authentication for this status-page app. Use this skill whenever working on login,
  sessions, the session cookie, middleware route protection, or the Node-vs-Edge runtime split for auth.
  Trigger on phrases like "protect the admin", "login", "session cookie", "middleware auth", "verify the
  session", "admin password", or anything touching lib/auth.ts, lib/auth-edge.ts, or middleware.ts.
  Apply automatically when building or changing authentication here.
---

# Status Page Auth (single password)

There is one admin, protected by a single password and a signed session cookie. No users table.

## The Node/Edge split (critical)

Next.js `middleware.ts` runs in the **Edge runtime** — it has Web Crypto but **no `sqlite3` and no Node
`crypto`**. Importing either into middleware breaks the build. Therefore auth is split into two files:

- **`lib/auth.ts` (Node runtime, used by route handlers only):**
  - `hashPassword(pw)` / `verifyPassword(pw, hash)` via Node `crypto.scrypt` + `timingSafeEqual`.
  - `createSession()` → `jose` `new SignJWT({ role:'admin' }).setProtectedHeader({alg:'HS256'}).setExpirationTime('7d').sign(secret)`.
  - `SESSION_COOKIE = 'sp_session'`, plus a helper to build the `Set-Cookie` options.
- **`lib/auth-edge.ts` (Edge-safe, imported ONLY by `middleware.ts`):**
  - `verifySession(token)` → `jose.jwtVerify(token, secret)`; returns boolean. No DB, no Node crypto.
  - `jose` works in Edge because it uses Web Crypto — this is why we use `jose` instead of Node HMAC.

The signing secret comes from `process.env.SESSION_SECRET` (available in both runtimes). It MUST be stable
across restarts or all sessions invalidate.

## middleware.ts

```ts
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
```
- Allow `/admin/login` and `/api/admin/auth/login` through unauthenticated (entry points).
- Read the `sp_session` cookie → `verifySession`. On failure: `/api/admin/*` → `401` JSON;
  page paths → `NextResponse.redirect(new URL('/admin/login', req.url))`.

## Flows

- **Login** `POST /api/admin/auth/login {password}` → `getAdminAuth()` resolves the expected credential
  (DB `admin.passwordHash` first, else `env.ADMIN_PASSWORD`) → verify → `createSession()` →
  set cookie `HttpOnly; SameSite=Lax; Path=/; Secure (prod); Max-Age=7d`.
- **Logout** `POST /api/admin/auth/logout` → clear cookie (`Max-Age=0`).

## Bootstrap rules

- If no DB password hash is set, accept `env.ADMIN_PASSWORD` (timing-safe compare).
- If neither a DB hash nor `ADMIN_PASSWORD` is set, the login page shows a "set ADMIN_PASSWORD" notice and
  blank-password login is rejected.
- Setting a password in the admin settings stores a scrypt hash in `settings.admin` and takes precedence over env.
