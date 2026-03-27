# 2026-03-25_086 — Admin Panel + Demo Upload + Lead Assignment

## What changed
- **Added `/admin` panel** to sales dashboard with password-protected access
  - `src/app/admin/layout.tsx` — auth gate with password login
  - `src/app/admin/page.tsx` — dashboard showing salespeople + uploaded demos
  - `src/app/admin/upload/page.tsx` — upload demo HTML files to Supabase Storage
  - `src/app/admin/assign/page.tsx` — assign demos to salespeople as leads
- **Added admin API routes:**
  - `POST /api/admin/auth` — password authentication
  - `GET /api/admin/salespeople` — list all sales_users
  - `GET /api/admin/demos` — list all business_profiles
  - `POST /api/admin/upload` — upload HTML to Supabase Storage + create business_profiles row
  - `POST /api/admin/assign` — create lead_assignments row with demo data
- **Added demo site proxy route** (`/api/demo-site/[slug]`) — proxies HTML from Supabase Storage to avoid CSP restrictions that block iframe rendering
- **Added demo preview fallback** (`/api/demo-preview/[id]`) — allows viewing demos by assignment ID (not just demo link code)
- **Updated middleware** to allow `/admin`, `/api/admin`, `/api/demo-preview` as public paths
- **Updated ConditionalShell** to exclude `/admin` from the salesperson AppShell
- **Fixed signup flow** — submit now fires on area step, "Go to Dashboard" button works, added phone number field, added login reminder on done screen
- Created `src/lib/admin-auth.ts` for shared admin token validation

## Why
Need a way to manually upload AI-generated demo sites and assign them to salesperson accounts for initial field testing before the automated demo generation pipeline is built.

## Stack
- Next.js 14, Supabase Storage (public bucket), Supabase PostgreSQL

## Integrations
- **Supabase Storage** — `demo-sites` public bucket for HTML files
- **Supabase DB** — `business_profiles` for demo metadata, `lead_assignments` for salesperson assignments

## How to verify
1. Go to `salesflow-sigma.vercel.app/admin` — enter password `salesflow2026`
2. Upload an HTML demo file with a business name
3. Assign the demo to a salesperson
4. Log in as that salesperson — see the new lead in dashboard
5. View demo — HTML renders in iframe via proxy route

## Known issues
- Admin password is a single shared password (no user accounts)
- No delete/edit functionality for uploaded demos yet
- Demo proxy route adds a small latency vs static files (fetches from Supabase on each request, cached 1hr)
