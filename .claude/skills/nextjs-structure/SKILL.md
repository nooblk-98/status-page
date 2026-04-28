---
name: nextjs-structure
description: >
  Enforces a consistent, scalable Next.js App Router folder and file structure for full-stack projects.
  Use this skill whenever the user asks to create, scaffold, add, move, or refactor files in a Next.js project —
  including adding new pages, features, API routes, components, hooks, providers, or lib utilities.
  Trigger on phrases like "add a new page", "create a feature", "add an API route", "scaffold a component",
  "where should I put this file", "create a new Next.js project", or any time code is being placed in or
  moved within a Next.js app. Apply this structure even if the user doesn't explicitly ask about structure —
  if they're building something in Next.js, follow these conventions automatically.
---

# Next.js App Router Structure

This project uses the App Router with a feature-based architecture. The goal is to keep routes thin, colocate feature logic, and share only truly reusable code globally.

## Directory map

```
my-app/
├─ app/                        # Routes, layouts, pages, API handlers only
│  ├─ layout.tsx               # Root layout
│  ├─ page.tsx                 # Root page
│  ├─ globals.css
│  ├─ not-found.tsx
│  ├─ (auth)/                  # Route group — no URL segment
│  │  ├─ login/page.tsx
│  │  └─ register/page.tsx
│  ├─ (dashboard)/             # Route group
│  │  ├─ layout.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ settings/page.tsx
│  │  └─ users/page.tsx
│  └─ api/
│     ├─ auth/[...nextauth]/route.ts
│     ├─ users/route.ts
│     └─ posts/route.ts
│
├─ components/                 # Global reusable UI only
│  ├─ ui/                      # Primitive UI: button, input, modal, etc.
│  ├─ layout/                  # App-wide layout pieces: navbar, sidebar
│  └─ shared/                  # Generic helpers: loading, empty-state
│
├─ features/                   # Feature modules — the core of app logic
│  └─ <feature-name>/
│     ├─ components/           # UI used only by this feature
│     ├─ actions.ts            # Server Actions ("use server")
│     ├─ queries.ts            # DB read functions
│     ├─ validation.ts         # Zod schemas or validators
│     └─ types.ts              # TypeScript types for this feature
│
├─ lib/                        # Shared backend/frontend utilities
│  ├─ db.ts                    # Prisma client singleton
│  ├─ auth.ts                  # Auth config (NextAuth, etc.)
│  ├─ utils.ts                 # cn(), formatDate(), etc.
│  ├─ env.ts                   # Env validation (t3-env, zod, etc.)
│  └─ constants.ts
│
├─ hooks/                      # Reusable React hooks (client-side)
├─ providers/                  # React context providers
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ public/
│  ├─ images/
│  └─ icons/
├─ middleware.ts
├─ next.config.ts
├─ tsconfig.json
└─ .env
```

---

## Decision rules — where does this file go?

**Is it a route, layout, loading state, error boundary, or API handler?**
→ Put it in `app/`. Keep it thin — import logic from `features/` or `lib/`.

**Is it a UI component reused across multiple features or pages?**
→ Put it in `components/ui/`, `components/layout/`, or `components/shared/`.
→ If it's only used by one feature, put it in `features/<name>/components/` instead.

**Is it business logic (data fetching, mutations, validation, types) for a specific domain?**
→ Put it in `features/<feature-name>/`. Create the feature folder if it doesn't exist yet.

**Is it a shared utility, DB client, auth config, or env helper?**
→ Put it in `lib/`.

**Is it a reusable React hook?**
→ Put it in `hooks/`.

**Is it a React context provider?**
→ Put it in `providers/`.

---

## File naming conventions

- **Files**: lowercase kebab-case → `user-card.tsx`, `login-form.tsx`, `use-toast.ts`
- **React component exports**: PascalCase → `export function UserCard() {}`
- **Server Actions**: always include `"use server"` at the top of `actions.ts`
- **Client components**: add `"use client"` at the top when needed (event handlers, hooks, browser APIs)
- Route files follow Next.js conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`

---

## Key patterns

### Thin pages — delegate to features

```tsx
// app/(dashboard)/users/page.tsx
import { getUsers } from "@/features/users/queries";
import { UserList } from "@/features/users/components/user-list";

export default async function UsersPage() {
  const users = await getUsers();
  return <UserList users={users} />;
}
```

### Feature queries (read from DB)

```ts
// features/users/queries.ts
import { db } from "@/lib/db";

export async function getUsers() {
  return db.user.findMany();
}
```

### Feature actions (mutations)

```ts
// features/users/actions.ts
"use server";

import { db } from "@/lib/db";

export async function deleteUser(id: string) {
  return db.user.delete({ where: { id } });
}
```

### API routes — use for external clients, webhooks, mobile

```ts
// app/api/users/route.ts
import { getUsers } from "@/features/users/queries";

export async function GET() {
  const users = await getUsers();
  return Response.json(users);
}
```

For forms within the app itself, prefer Server Actions over API routes.

### Prisma client singleton

```ts
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### Import alias

Always use the `@/` alias (configured in `tsconfig.json`) instead of relative paths:

```ts
import { db } from "@/lib/db";
import { UserCard } from "@/features/users/components/user-card";
import { Button } from "@/components/ui/button";
```

---

## When creating new features

When adding a new domain (e.g., "products", "orders", "comments"), scaffold the full feature folder:

```
features/<name>/
├─ components/    ← feature-specific UI
├─ actions.ts     ← "use server" mutations
├─ queries.ts     ← DB reads
├─ validation.ts  ← input validation schemas
└─ types.ts       ← TypeScript types
```

Add only the files that are actually needed — don't create empty placeholders.

---

## What NOT to do

- Don't put business logic directly in `page.tsx` or `route.ts` — delegate to `features/`
- Don't put feature-specific components in `components/` — they belong in `features/<name>/components/`
- Don't use relative imports like `../../lib/db` — use `@/lib/db`
- Don't create a new top-level folder without a clear reason — fit new code into the existing structure first
