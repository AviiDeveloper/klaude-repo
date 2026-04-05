---
tags: [entity, salesperson, user, auth]
related: [../domain/salesperson-onboarding.md, ../contracts/auth-contract.md]
---

# Entity: Salesperson (SalesUser)

A gig worker who visits local businesses and sells AI-generated websites.

## Canonical Fields (SQLite `sales_users` table)

| Field | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| name | text UNIQUE | Login identifier |
| pin_hash | text | SHA-256 of `SD_SECRET:pin` |
| email | text | Optional |
| phone | text | Optional |
| area_postcode | text | Primary area |
| area_postcodes_json | text | JSON array of postcodes for wider coverage |
| max_active_leads | int | Default 20. Cap on non-terminal leads. |
| user_status | text | Default 'available' |
| commission_rate | real | Default 0.10 (10%) |
| active | bool | Soft delete flag |
| api_token | text | Stored token (optional) |
| push_token | text | Mobile push notification token |
| device_type | text | 'web', 'ios', or 'android' |
| last_active_at | timestamp | Updated on each authenticated request |
| created_at | timestamp | Registration time |

## Representations Across Apps

**sales-dashboard** (`apps/sales-dashboard/src/lib/types.ts`):
- `SalesUser` — id, name, email, phone, area_postcode, commission_rate, active, device_type, last_active_at, created_at
- Missing from type: area_postcodes_json, max_active_leads, user_status, pin_hash, api_token, push_token

**admin-panel** (`apps/admin-panel/src/lib/types.ts`):
- `TeamMember` — includes all SalesUser fields PLUS computed stats: active_leads, total_visits, total_pitches, total_sales, total_commission, conversion_rate

**iOS** (`apps/ios/salesflow/salesflow/Models.swift`):
- `User` struct (Decodable) — id, name, email, phone, areaPostcode, commissionRate, deviceType

**mobile-api**: No dedicated type — returns raw DB row.

## Admin Roles (admin-panel only)

Separate from salespeople. Defined in `apps/admin-panel/src/lib/admin-auth.ts`:
- `AdminRole`: 'owner' | 'manager' | 'viewer'
- Uses different auth mechanism (not PIN-based).
