# Sales Dashboard — Build Log

Every file created or modified is logged here linearly to preserve context across sessions.

## Session 1 — 2026-03-23

### Step 1: Project Scaffold

**Created directories:**
- `apps/sales-dashboard/src/app/` — all page and API route dirs
- `apps/sales-dashboard/src/lib/db/` — database layer
- `apps/sales-dashboard/src/components/` — UI components
- `apps/sales-dashboard/src/hooks/` — React hooks
- `apps/sales-dashboard/src/store/` — Zustand store

**Created files (scaffold):**
- `apps/sales-dashboard/package.json` — Next.js 14.2.35, React 18, better-sqlite3, Tailwind, Zustand, Lucide
- `apps/sales-dashboard/next.config.mjs` — webpack externals for better-sqlite3
- `apps/sales-dashboard/tsconfig.json` — TS config with @/* path alias
- `apps/sales-dashboard/tailwind.config.ts` — Dark theme with sd-* colour tokens
- `apps/sales-dashboard/postcss.config.mjs` — Tailwind + autoprefixer

### Step 2: Core Layout & CSS

- `src/app/globals.css` — Tailwind imports, Inter font, dark theme vars, card animations, safe-area padding
- `src/app/layout.tsx` — Root layout with Inter font, dark bg, PWA meta tags, viewport-fit=cover
- `src/app/page.tsx` — Redirects to /dashboard

### Step 3: Lib Layer (DB, Auth, Types, Intel)

- `src/lib/types.ts` — All TypeScript interfaces: SalesUser, LeadCard, LeadDetail, TalkingPoint, SalesStats, ApiResponse, AuthPayload, LoginResponse, ReviewItem
- `src/lib/db/index.ts` — SQLite connection (shared with mission-control), sales_users + lead_assignments + sales_activity_log tables, query helpers
- `src/lib/auth.ts` — PIN hashing (SHA-256), HMAC-signed tokens, dual auth (cookie + Bearer), resolveUserFromRequest(), loginUser(), createSalesUser()
- `src/lib/intel.ts` — Talking point generator: 12+ rules mapping pipeline data to salesman-friendly intel bullets

### Step 4: Auth & Middleware

- `src/middleware.ts` — Auth guard: checks cookie (web) and Bearer (mobile), redirects to /login or returns 401 JSON
- `src/app/api/auth/login/route.ts` — POST login, returns user + token, sets cookie
- `src/app/api/auth/me/route.ts` — GET current user from session

### Step 5: API Routes

- `src/app/api/leads/route.ts` — GET assigned leads with status filter + search
- `src/app/api/leads/[id]/route.ts` — GET full lead detail with profile + site data
- `src/app/api/leads/[id]/status/route.ts` — PATCH status transitions with validation, activity logging
- `src/app/api/stats/route.ts` — GET sales stats (counts, today's activity, commission total)

### Step 6: UI Components

- `src/components/LeadStatusBadge.tsx` — Colour-coded status pill (blue=new, amber=visited, purple=pitched, green=sold, red=rejected)
- `src/components/GoogleRating.tsx` — Star display with review count
- `src/components/StatsBar.tsx` — 4-card stats grid + commission banner
- `src/components/LeadCard.tsx` — Dashboard card (name, type, rating, location, demo indicator)
- `src/components/TalkingPoints.tsx` — Intel bullets with type-specific colours and icons
- `src/components/ActionButtons.tsx` — Status transition buttons with validation (big, thumb-friendly)
- `src/components/BottomNav.tsx` — Mobile bottom navigation (Leads, Map, Profile)

### Step 7: Pages

- `src/app/login/page.tsx` — Dark login page: name + numeric PIN, error handling
- `src/app/dashboard/layout.tsx` — Dashboard wrapper with bottom nav
- `src/app/dashboard/page.tsx` — Main dashboard: stats bar, filter chips, search, lead card grid
- `src/app/lead/[id]/page.tsx` — Full detail: action buttons, talking points, business info, hours, services, reviews, description
