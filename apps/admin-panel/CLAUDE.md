# Admin Panel — App Instructions

Internal admin interface for managing salespeople and leads. Next.js 14.

## Quick Reference
- **Port**: 4400
- **Dev**: `npm run dev` from this directory
- **Auth**: Role-based token (`src/lib/admin-auth.ts`) — NOT the same as salesperson PIN auth
- **DB**: SQLite (shared at `../mission-control/mission-control.db`)
- **Types**: `src/lib/types.ts` — AdminRole, TeamMember, LeadRow, TeamStats, ConversionFunnel

## Before Editing
Search the `business-brain` MCP tool for context.
Key knowledge notes: `shared-enums.md`, `entity-salesperson.md`, `known-duplication.md`.

AssignmentStatus is duplicated here AND in sales-dashboard, mobile-api, iOS, and SQL schema.
Check all locations before changing.

## Admin Roles
- `owner` — full access
- `manager` — team management
- `viewer` — read-only

## API Routes
- `/api/auth/*` — admin login (role-based, not PIN)
- `/api/leads/*` — all leads across all salespeople
- `/api/stats` — team-wide statistics
- `/api/team/*` — list/update salespeople with computed stats

## Pages
`/dashboard`, `/leads`, `/pipeline`, `/salesforce`, `/login`

## Architecture Notes
- Shares SQLite DB with sales-dashboard and mobile-api
- TeamMember type extends SalesUser with computed stats (active_leads, conversion_rate, etc.)
- `better-sqlite3` externalized in `next.config.mjs`
