---
tags: [lead, status, workflow, core]
related: [../entities/entity-lead.md, ../contracts/shared-enums.md]
---

# Lead Lifecycle

A lead represents a local small business that could buy an AI-generated website. Salespeople work leads through a linear status pipeline.

## Status Flow

```
new → visited → pitched → sold
  ↑                ↓   → rejected
  └── rejected ────┘        ↓
       (reopen)    (back to visited)
```

- **new** — Lead assigned to salesperson, not yet contacted. Default status on creation.
- **visited** — Salesperson physically visited the business. Sets `visited_at` timestamp. Location (lat/lng) recorded on iOS/mobile.
- **pitched** — Salesperson showed the demo website to the business owner. Sets `pitched_at`.
- **sold** — Business owner purchased. Sets `sold_at`. Triggers Stripe checkout + commission. Terminal state.
- **rejected** — Business declined. Sets `rejected_at`. Optional `rejection_reason` (price, not_interested, has_website, wrong_person, timing, other).

## Allowed Transitions

| From | To |
|---|---|
| new | visited, rejected |
| visited | pitched, rejected |
| pitched | sold, rejected, visited (rework) |
| sold | (terminal) |
| rejected | new (reopen) |

## Rules

- Each transition sets the corresponding timestamp column.
- A salesperson has a `max_active_leads` field (default 20) — only leads in `new`, `visited`, or `pitched` count. **Note: this limit is defined in the schema but not enforced in route handlers.**
- Follow-ups: any lead can have `follow_up_at` + `follow_up_note` set regardless of status.
- Mobile-api hardcodes `commission_amount = 50` on sale (not configurable).

## Where Status Is Tracked

- **SQLite** `lead_assignments.status` — source of truth
- **TypeScript** `AssignmentStatus` type — defined in sales-dashboard and admin-panel
- **Swift** `Lead.status: String` — plain string in iOS app
- **Mobile API** — validates against hardcoded array in route handlers
