---
tags: [auth, token, security, shared]
related: [../entities/entity-salesperson.md]
---

# Auth Contract

All salesperson-facing apps share the same authentication mechanism.

## Token Format

HMAC-SHA256 signed, two-part token: `{base64url(payload)}.{base64url(signature)}`.

```
payload = base64url(JSON.stringify({ user_id, name, exp }))
signature = HMAC-SHA256(SD_SECRET, payload)
token = payload + "." + signature
```

## Shared Secret

Environment variable `SD_SECRET`. Same value must be set in:
- sales-dashboard (Next.js env)
- mobile-api (Express env)
- admin-panel uses a separate auth system (role-based, not PIN-based)

Default dev value: `'sales-dashboard-dev-secret-change-in-production'`

## PIN Hashing

`SHA-256(SD_SECRET + ":" + pin)` — used for storage and comparison.

## Token Expiry

30 days. Both apps use Unix seconds: `Math.floor(Date.now() / 1000) + 30d`. Validation uses seconds comparison in both implementations.

Previously there was a ms-vs-seconds mismatch between apps — **fixed in Phase 1 (2026-04-05)**.

## Transport

- **Web (sales-dashboard)**: httpOnly cookie named `sd_session`, SameSite=lax.
- **Mobile (iOS/Android)**: `Authorization: Bearer {token}` header.
- **sales-dashboard resolves both**: checks cookie first, then Bearer header.

## Implementations

- `apps/sales-dashboard/src/lib/auth.ts` — createToken, validateToken, hashPin, loginUser, cookie management, resolveUserFromRequest
- `apps/mobile-api/src/auth.ts` — createToken, validateToken, hashPin, loginUser, requireAuth middleware

These are near-identical copies. Both define `AuthPayload { user_id, name, exp }`.
