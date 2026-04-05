---
tags: [salesperson, auth, onboarding, user]
related: [../entities/entity-salesperson.md, ../contracts/auth-contract.md]
---

# Salesperson Onboarding

Salespeople are gig workers who sign up to sell AI-generated websites to local businesses.

## Signup Flow

1. Salesperson provides: name, PIN (4+ digits), optional email/phone/area postcode.
2. PIN is hashed with SHA-256 using `SD_SECRET` as salt: `sha256(SD_SECRET + ":" + pin)`.
3. A `sales_users` row is created with defaults: `commission_rate: 0.10`, `max_active_leads: 20`, `active: true`.
4. An HMAC auth token is returned (see auth-contract.md).

## Login

- Web: name + PIN → token stored as `sd_session` httpOnly cookie (30-day expiry).
- Mobile: name + PIN → token stored in app, sent as `Bearer` header.

## Area Assignment

- `area_postcode` — primary area (single postcode).
- `area_postcodes_json` — JSON array of multiple postcodes for wider coverage.
- Leads are assigned based on area overlap.

## Key Settings

- `commission_rate` — percentage of sale price (default 10%).
- `max_active_leads` — cap on non-terminal leads (default 20).
- `device_type` — 'web', 'ios', or 'android'. Set on first login from that platform.
- `user_status` — 'available' by default. Used for admin visibility.
