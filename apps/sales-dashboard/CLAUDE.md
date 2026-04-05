# Sales Dashboard — App Instructions

Salesperson-facing web app. Next.js 14, deployed to Vercel.

## Quick Reference
- **Port**: 4300
- **Dev**: `npm run dev` from this directory
- **Auth**: Custom HMAC token with PIN login (`src/lib/auth.ts`)
- **DB**: SQLite (shared at `../mission-control/mission-control.db`) + Supabase (demo storage)
- **Types**: `src/lib/types.ts` — SalesUser, LeadCard, LeadDetail, AssignmentStatus

## Before Editing
Search the `business-brain` MCP tool for context on the entity or flow you're touching.
Key knowledge notes: `shared-enums.md`, `entity-lead.md`, `auth-contract.md`.

AssignmentStatus is defined in 5 places across the monorepo. If you change it here,
check `knowledge/contracts/shared-enums.md` for the other locations.

## Env Vars Required
- `SD_SECRET` — shared auth secret (also used by mobile-api)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## API Routes
- `/api/auth/*` — login, signup, logout, me
- `/api/leads/*` — CRUD, status updates, intel, briefs
- `/api/payments/*` — Stripe Connect checkout, webhook, onboarding
- `/api/demo-site/[slug]`, `/api/demo-preview/[id]` — serve demos from Supabase
- `/api/demo-links` — create/retrieve shareable demo links
- `/api/admin/*` — upload demos, assign leads (separate admin auth)
- `/api/stats`, `/api/activity`

## Pages
`/dashboard`, `/lead/[id]`, `/map`, `/payouts`, `/profile`, `/settings`,
`/referrals`, `/help`, `/demo/[code]`, `/admin`, landing at `/`,
legal at `/legal/terms`, `/legal/privacy`, `/legal/contractor`

## Architecture Notes
- `better-sqlite3` externalized in `next.config.mjs`
- Auth resolves both cookie (web) and Bearer header (mobile fallback)
- Demo HTML served from Supabase R2 storage via `demo_records` table
