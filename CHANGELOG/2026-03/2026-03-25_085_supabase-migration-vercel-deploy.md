# 2026-03-25_085 — SQLite→Supabase Migration + Vercel Deployment

## What changed
- **Migrated entire sales dashboard from SQLite to Supabase** — all 13 API routes rewritten
  - `src/lib/db/index.ts` — replaced `better-sqlite3` with Supabase client (`getSupabase()`)
  - `src/lib/auth.ts` — `loginUser()` and `createSalesUser()` now async, query Supabase
  - All API routes (`auth/login`, `auth/signup`, `auth/me`, `leads`, `leads/[id]`, `leads/[id]/followup`, `leads/[id]/status`, `demo-links`, `demo-links/[code]`, `activity`, `stats`) migrated from raw SQL to Supabase JS client
- **Removed `better-sqlite3`** and `@types/better-sqlite3` (native C++ module incompatible with Vercel serverless)
- **Added `supabase/sales-dashboard-tables.sql`** — 4 new Supabase tables: `sales_users`, `lead_assignments`, `sales_activity_log`, `demo_links` with RLS policies and updated_at triggers
- **Added `.npmrc`** with `legacy-peer-deps=true` to fix react-leaflet/React 18 peer dep conflict on Vercel
- **Deployed to Vercel** at `https://salesflow-sigma.vercel.app`
- **Configured Stripe webhook** endpoint with signing secret
- **Updated `.env.local`** with webhook secret

## Why
- SQLite cannot run on Vercel's serverless environment (native C++ binary)
- Supabase is the permanent data store per production context (single source of truth)
- Vercel deployment provides public URL needed for demo sharing, Stripe webhooks, and salesperson access from any phone
- Stripe webhook needs reachable public endpoint to confirm payments

## Stack
- Next.js 14.2.35, Supabase JS client, Stripe, Vercel

## Integrations
- **Supabase** — all sales dashboard operational data (users, leads, activity, demo links) now alongside ML/orchestration tables
- **Stripe** — webhook endpoint configured for `checkout.session.completed`
- **Vercel** — production deployment with env vars (Supabase URL/keys, Stripe keys, webhook secret)

## How to verify
1. `https://salesflow-sigma.vercel.app` — login page loads
2. `https://salesflow-sigma.vercel.app/demo/preview-test` — Mannys Barbers demo + embedded Stripe checkout
3. Supabase Table Editor — `sales_users`, `lead_assignments`, `sales_activity_log`, `demo_links` tables exist
4. Stripe Dashboard > Webhooks — endpoint active at `/api/payments/webhook`
5. Local build: `cd apps/sales-dashboard && npm run build` — passes clean

## Known issues
- `react-leaflet@5.0.0` requires React 19 but app uses React 18 — works via `legacy-peer-deps`
- Demo sites are static HTML from `/public/demo-sites/` — no dynamic generation yet
- Stripe keys are sandbox (test mode) — swap when going live
- No custom domain on Vercel yet
