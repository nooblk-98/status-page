---
name: status-page-admin-api
description: >
  Conventions for building authenticated admin API routes in this status-page app (app/api/admin/*).
  Use this skill whenever adding or editing admin endpoints for monitors or settings, validating request
  bodies, generating monitor slugs, or wiring API writes to the monitor manager. Trigger on phrases like
  "add an admin endpoint", "CRUD for monitors", "update settings API", "validate the request body",
  "admin route", or anything under app/api/admin. Apply automatically when building admin server routes.
---

# Status Page Admin API

All admin endpoints live under `app/api/admin/*` and are protected by `middleware.ts` (matcher
`/api/admin/:path*`), except the login endpoint `app/api/admin/auth/login/route.ts`.

## Conventions

1. **Validate every mutation body with Zod.** Schemas live in `features/admin/schemas.ts` and are shared
   between routes and the admin UI forms. `PATCH` uses a `.partial()` variant. On validation failure return
   `NextResponse.json({ error, issues }, { status: 400 })`.

2. **Write DB, then notify the manager.** The required order for monitor mutations:
   - POST/create → validate → generate+dedupe slug `id` → `dbOps.insertMonitor(row)` → `monitorManager.addOrUpdate(row)`.
   - PATCH/update → `dbOps.updateMonitor(id, patch)` → re-read row → `monitorManager.addOrUpdate(row)`.
   - DELETE → `dbOps.deleteMonitor(id)` → `monitorManager.remove(id)`.
   This is what makes changes take effect live. Never mutate the DB without notifying the manager.

3. **Slug generation/dedupe.** Derive `id` from `name` (lowercase, non-alphanumeric → `-`, collapse repeats,
   trim). If `getMonitor(slug)` already exists, append `-2`, `-3`, … until unique. Slugs are immutable once set
   (renaming a monitor keeps its slug so `checks` history stays linked).

4. **Mask secrets on GET.** `GET /api/admin/settings` must never return raw secrets (e.g. `notifications.email.pass`).
   Replace stored secrets with a sentinel like `"********"`. On `PUT`, if a field equals the sentinel, keep the
   existing stored value instead of overwriting it.

5. **Type-aware monitor validation.** The `monitorSchema` requires `url` when `type==='http'`, `host`+`port`
   when `type==='tcp'`, and `host` when `type==='ping'` (use Zod `superRefine`/discriminated union).

6. **Settings PUT side effects.** Saving `retention` must reschedule the manager's prune job. Saving
   `notifications`/`branding`/`theme` needs no manager call (read fresh on next use).

7. **Always declare `export const dynamic = 'force-dynamic'`** on admin routes and any DB-backed read route
   so responses aren't statically cached.

## Auth dependency

Routes assume middleware already enforced the session. The login route itself verifies the password via
`lib/auth.ts` (Node runtime) and sets the `sp_session` cookie. See the `status-page-auth` skill.
