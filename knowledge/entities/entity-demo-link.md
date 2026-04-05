---
tags: [entity, demo, link, conversion]
related: [../domain/demo-site-flow.md, ../contracts/shared-enums.md]
---

# Entity: Demo Link

A shareable link that lets a potential customer view their AI-generated demo website.

## Canonical Fields (SQLite `demo_links` table)

| Field | Type | Notes |
|---|---|---|
| id | text PK | UUID |
| code | text UNIQUE | Short shareable code (used in URL) |
| assignment_id | text FK | Links to lead_assignments.id |
| user_id | text FK | Salesperson who created it |
| lead_id | text | Business identifier |
| business_name | text | Denormalized for display |
| demo_domain | text | Domain of the generated site |
| status | text | active/viewed/interested/converted/expired |
| views | int | View counter (default 0) |
| last_viewed_at | timestamp | Most recent view |
| customer_name | text | Captured when customer shows interest |
| customer_phone | text | Captured contact info |
| customer_email | text | Captured contact info |
| customer_message | text | Customer's message/notes |
| interested_at | timestamp | When customer submitted contact info |
| converted_at | timestamp | When purchase completed |
| expires_at | timestamp | Auto-expiry date |

## Status Flow

```
active → viewed → interested → converted
                             → expired
```

Note: `expired` can happen from any non-terminal status when `expires_at` passes.

## Where Defined

- **Schema**: `supabase/sales-dashboard-tables.sql` (canonical)
- **SQLite copy**: `apps/sales-dashboard/src/lib/db/index.ts`, `apps/mobile-api/src/db.ts`
- **API**: `POST /api/demo-links` (create), `GET /api/demo-links/:code` (retrieve)
- **iOS**: Created via mobile-api, shared via QR code or AirDrop
