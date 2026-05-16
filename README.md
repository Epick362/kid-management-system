# KMS — Domáce úlohy

Mobile-first PWA that ties home chores to screen-time for our family. Built on TanStack Start + Cloudflare Workers + D1. UI is in Slovak.

Two perspectives:

- **`/`** — kid picker → `/kid/:id` dashboard with chore picker, balance ring, calendar
- **`/admin`** — parent: today overview, log surface, kids/chores/settings CRUD, calendar (password-gated)

## Quick start (local dev)

```bash
pnpm install
pnpm db:migrate:local                       # apply Drizzle migrations to local D1
pnpm exec wrangler d1 execute kms-db --local --file=./drizzle/seed.sql
                                            # seed Miško + 11 starter chores
echo "ADMIN_PASSWORD=changeme" > .dev.vars   # (optional, see auth note below)
pnpm dev
# open http://localhost:5173
```

First visit to `/admin/login` shows a "first-run" form — whatever password you submit becomes the admin password. Change it later from `/admin/settings`.

## Deploy to Cloudflare

```bash
# 1. Create the remote D1 database (one time)
pnpm exec wrangler d1 create kms-db
# → copy the returned database_id into wrangler.jsonc (replace "local-dev-placeholder")

# 2. Run migrations against remote
pnpm db:migrate:remote

# 3. Seed remote with the starter catalog (one time)
pnpm exec wrangler d1 execute kms-db --remote --file=./drizzle/seed.sql

# 4. Deploy
pnpm run deploy                              # `pnpm deploy` collides with a built-in
# → first deploy will prompt you to login to Cloudflare if you haven't already
```

After deploy, visit the printed URL on a phone, "Add to Home Screen" — installs as a PWA.

## Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Vite + Workers dev server with HMR |
| `pnpm test` | Vitest (screen-time math + auth) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Production build (client + SSR Worker) |
| `pnpm db:generate` | Generate Drizzle migration after editing `src/server/schema.ts` |
| `pnpm db:migrate:local` | Apply migrations to local D1 |
| `pnpm db:migrate:remote` | Apply migrations to Cloudflare D1 |
| `pnpm cf-typegen` | Regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc` |
| `node scripts/build-icons.mjs` | Re-rasterize PWA icons from `public/icon.svg` |

## Where to find things

- **Schema** (source of truth): `src/server/schema.ts`
- **Screen-time math** (bank cap, daily cap, calendar coloring): `src/server/screen-time.ts` (+ 23 unit tests)
- **All Slovak copy**: `src/lib/sk.ts`
- **CET day bucketing**: `src/lib/dates.ts`
- **Server fns**: `src/server/{auth-fns,admin-fns,log-fns,kid-fns}.ts`
- **Routes**: `src/routes/*` (flat-file convention — `admin.kids.tsx` → `/admin/kids`)
- **PWA**: `public/{manifest.webmanifest,sw.js,offline.html,icon.svg,icons/}` + `src/lib/sw-register.ts`

## Design decisions

See the [original plan](/Users/epx/.claude/plans/i-am-starting-a-polished-sloth.md) for the full reasoning. Highlights:

- **Three chore types**: `family_duty` (logged, no reward — guards against the overjustification effect), `earning_daily` (repeatable, fixed reward), `earning_weekly_quest` (variable bonus).
- **Bank with cap**: unused earned minutes accumulate up to `bank_cap_minutes`. Excess overflows are logged as discarded (so the kid sees the limit). Daily play is capped separately by `daily_cap_minutes`.
- **No loss aversion**: earned minutes are never taken away as punishment. Balance can go negative if usage exceeds earnings, but UI floors at 0.
- **Calendar coloring**: green = ≥1 chore done & no overage; red = overage OR (weekday & zero chores); weekends are neutral; future days blank.
- **Effort-praise copy**: "Bravo, urobil si to!" rotated from `sk.chore.praise` on each chore-tap celebration.
- **Single-family v1**: schema permits multi-family but `SINGLE_FAMILY_ID = 1` is hardcoded. Multi-family UI is on the v2 roadmap.

## Out of scope for v1 (planned next)

- **Web Push notifications**: parent gets a push when a kid completes a chore; kid gets a daily reminder; iOS requires the PWA installed first, which is why PWA shipped in v1.
- Multi-family tenancy UI
- Non-screen-time reward types
- Streaks / achievements / levels
- Photo proof of completed chores
