---
tags: [duplication, tech-debt, refactoring, shared]
related: [../contracts/shared-enums.md, ../contracts/database-architecture.md, ../contracts/auth-contract.md]
---

# Known Duplication

Code and definitions that are copy-pasted across apps. Changing any of these requires updating all locations.

## AssignmentStatus (5 locations)

1. `apps/sales-dashboard/src/lib/types.ts` line 22 — `export type AssignmentStatus`
2. `apps/admin-panel/src/lib/types.ts` line 2 — `export type AssignmentStatus`
3. `apps/mobile-api/src/routes/leads.ts` — hardcoded validation array
4. `apps/ios/salesflow/salesflow/Models.swift` line 19 — `var status: String`
5. `supabase/sales-dashboard-tables.sql` line 33 — CHECK constraint

## SQL Schema (3 copies of 4 tables)

1. `supabase/sales-dashboard-tables.sql` — canonical (with CHECK constraints, indexes, RLS policies)
2. `apps/sales-dashboard/src/lib/db/index.ts` — CREATE TABLE IF NOT EXISTS copy
3. `apps/mobile-api/src/db.ts` lines 24-52 — relaxed copy (no CHECK constraints, fewer columns)

Admin-panel's `src/lib/db/index.ts` may also have a copy.

## Auth Token Logic (2 identical implementations)

1. `apps/sales-dashboard/src/lib/auth.ts` — createToken, validateToken, hashPin, loginUser
2. `apps/mobile-api/src/auth.ts` — same functions, same logic

Subtle difference: token expiry units (seconds vs milliseconds).

## AuthPayload Type (2 definitions)

1. `apps/sales-dashboard/src/lib/types.ts` — `interface AuthPayload { user_id, name, exp }`
2. `apps/mobile-api/src/auth.ts` — `interface AuthPayload { user_id, name, exp }`

## What Should Be Unified

Priority order for a future `packages/shared/` directory:
1. **Enums/constants** — AssignmentStatus, DemoLinkStatus, DeviceType (least risk, highest value)
2. **Auth logic** — createToken, validateToken, hashPin (fix the expiry bug at the same time)
3. **Types** — SalesUser, LeadAssignment, AuthPayload
4. **Schema** — single migration source that all apps reference

## What Can Stay Separate

- Admin-panel's computed types (TeamMember, TeamStats) — these are admin-specific views
- iOS Swift models — can't import TypeScript, must stay as manual translations
- Training system — mobile-only, no duplication issue
