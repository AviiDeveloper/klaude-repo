---
tags: [enums, types, shared, duplication]
related: [../entities/entity-lead.md, ../entities/entity-demo-link.md, ../architecture/known-duplication.md]
---

# Shared Enums

Business constants used across multiple apps. Currently duplicated — no single source of truth in code.

## AssignmentStatus

Values: `'new' | 'visited' | 'pitched' | 'sold' | 'rejected'`

Defined in:
1. `apps/sales-dashboard/src/lib/types.ts` — `export type AssignmentStatus`
2. `apps/admin-panel/src/lib/types.ts` — `export type AssignmentStatus`
3. `apps/mobile-api/src/routes/leads.ts` — hardcoded validation array
4. `apps/ios/salesflow/salesflow/Models.swift` — `Lead.status: String` (no enum)
5. `supabase/sales-dashboard-tables.sql` — CHECK constraint on `lead_assignments.status`

## DemoLinkStatus

Values: `'active' | 'viewed' | 'interested' | 'converted' | 'expired'`

Defined in:
1. `supabase/sales-dashboard-tables.sql` — CHECK constraint on `demo_links.status`
2. `apps/sales-dashboard/src/lib/db/index.ts` — CHECK constraint (copy)
3. `apps/mobile-api/src/db.ts` — no constraint (just DEFAULT 'active')

## DeviceType

Values: `'web' | 'ios' | 'android'`

Defined in:
1. `apps/sales-dashboard/src/lib/types.ts` — `SalesUser.device_type`
2. `supabase/sales-dashboard-tables.sql` — CHECK constraint on `sales_users.device_type`
3. `apps/mobile-api/src/routes/auth.ts` — hardcoded validation array

## AdminRole

Values: `'owner' | 'manager' | 'viewer'`

Defined in: `apps/admin-panel/src/lib/types.ts` only. Not shared.

## BusinessCategory (Supabase only)

Values: `'restaurant' | 'retail' | 'trades' | 'beauty' | 'professional' | 'other'`

Defined in: `supabase/schema.sql` as PostgreSQL ENUM. Not referenced in app TypeScript code.

## RejectionReason (Supabase only)

Values: `'price' | 'not_interested' | 'has_website' | 'wrong_person' | 'timing' | 'other'`

Defined in: `supabase/schema.sql` as PostgreSQL ENUM. Stored as plain text in SQLite `lead_assignments.rejection_reason`.

## TalkingPointType (sales-dashboard only)

Values: `'strength' | 'opportunity' | 'warning' | 'info'`

Defined in: `apps/sales-dashboard/src/lib/types.ts` only.
