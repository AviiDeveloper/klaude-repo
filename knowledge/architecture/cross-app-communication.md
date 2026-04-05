---
tags: [architecture, integration, cross-app, future]
related: [../contracts/auth-contract.md, ../contracts/database-architecture.md]
---

# Cross-App Communication

How the apps talk to each other today, and what needs to change.

## Current State: Shared Database

Apps communicate by reading/writing the same SQLite database (`mission-control.db`). There are no HTTP calls between apps.

```
sales-dashboard ──┐
admin-panel ──────┼──→ SQLite (mission-control.db)
mobile-api ───────┘
```

iOS app talks to mobile-api via HTTP. mobile-api reads/writes the shared SQLite.

## What's Shared

- **Same DB file**: All three TypeScript backends open the same SQLite file.
- **Same auth secret**: `SD_SECRET` shared between sales-dashboard and mobile-api.
- **Same token format**: HMAC-SHA256 tokens are interchangeable between apps.
- **Same schema**: `sales_users`, `lead_assignments`, `sales_activity_log`, `demo_links`.

## What's NOT Shared

- **No shared types package**: Each app defines its own TypeScript types.
- **No shared API client**: Each frontend makes its own HTTP calls.
- **No event system between apps**: Changes in one app aren't notified to others.
- **No shared validation**: Status enums and constraints are copy-pasted.

## Known Issues

1. **Schema drift risk**: Mobile-api's CREATE TABLE has no CHECK constraints while the canonical schema does.
2. **Token expiry mismatch**: Sales-dashboard uses seconds, mobile-api uses milliseconds for `exp` field.
3. **Missing columns**: Mobile-api schema copy is missing some columns present in the canonical schema (e.g., `follow_up_at`, `follow_up_note`, `contact_name`, `contact_role` on `lead_assignments`).

## Future Direction

When apps need real-time communication (e.g., admin assigns a lead and salesperson gets notified immediately), options include:
- SQLite polling (simplest, works today)
- Shared event bus via the orchestration runtime
- Push notifications (mobile-api already has `push_tokens` table)
- WebSocket connections through OpenClaw bridge
