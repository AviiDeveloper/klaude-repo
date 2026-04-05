---
tags: [lead, status, workflow, core]
related: [../entities/entity-lead.md, ../contracts/shared-enums.md]
---

# Lead Lifecycle

A lead represents a local small business that could buy an AI-generated website. Salespeople work leads through a linear status pipeline.

## Status Flow

```
new → visited → pitched → sold
                        → rejected
```

- **new** — Lead assigned to salesperson, not yet contacted. Default status on creation.
- **visited** — Salesperson physically visited the business. Sets `visited_at` timestamp. Location (lat/lng) recorded on iOS/mobile.
- **pitched** — Salesperson showed the demo website to the business owner. Sets `pitched_at`.
- **sold** — Business owner purchased. Sets `sold_at`. Triggers Stripe checkout + commission.
- **rejected** — Business declined. Sets `rejected_at`. Optional `rejection_reason` (price, not_interested, has_website, wrong_person, timing, other).

## Rules

- Status can only move forward (no going back from pitched to visited).
- Each transition sets the corresponding timestamp column.
- A salesperson has a `max_active_leads` limit (default 20) — only leads in `new`, `visited`, or `pitched` count.
- Follow-ups: any lead can have `follow_up_at` + `follow_up_note` set regardless of status.

## Where Status Is Tracked

- **SQLite** `lead_assignments.status` — source of truth
- **TypeScript** `AssignmentStatus` type — defined in sales-dashboard and admin-panel
- **Swift** `Lead.status: String` — plain string in iOS app
- **Mobile API** — validates against hardcoded array in route handlers
