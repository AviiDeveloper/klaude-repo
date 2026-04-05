# 2026-04-05_001 — Phase 1 Critical Fixes

## What changed
- **apps/mobile-api/src/auth.ts** — fixed token expiry: `exp` now uses Unix seconds (`Math.floor(Date.now() / 1000) + ...`) instead of milliseconds; `validateToken` comparison updated to match
- **apps/mobile-api/src/routes/auth.ts** — fixed inline `exp` in `/register` handler to use Unix seconds; added `express-rate-limit` (5 req/min per IP) on `/login` and `/register`
- **apps/mobile-api/package.json** — added `express-rate-limit ^7.0.0` dependency
- **apps/sales-dashboard/src/lib/admin-auth.ts** — added `hashPassword(password)` export (HMAC-SHA256 using `SD_SECRET`)
- **apps/sales-dashboard/src/app/api/admin/auth/route.ts** — removed plaintext password compare and `|| 'admin123'` fallback; now uses `hashPassword` for timing-safe comparison; returns 503 if `ADMIN_PASSWORD` env var is unset
- **apps/sales-dashboard/src/lib/rate-limit.ts** — new: in-memory Map-based rate limiter (5 req/60 s per IP)
- **apps/sales-dashboard/src/app/api/auth/login/route.ts** — rate limiting added (429 on breach)
- **apps/sales-dashboard/src/app/api/auth/signup/route.ts** — rate limiting added (429 on breach)

## Why
Phase 1 critical security fixes: token interoperability between mobile-api and sales-dashboard was broken (ms vs seconds epoch mismatch), admin password fallback was a hardcoded credential risk, and auth endpoints had no brute-force protection.

## Stack
- Node.js / TypeScript, Express (mobile-api), Next.js 14 (sales-dashboard)
- `express-rate-limit` ^7, Node `crypto` module

## Integrations
None — all changes are internal auth/middleware logic.

## How to verify
1. **Token expiry**: create a token via mobile-api `/auth/login`, decode the base64url payload — `exp` should be a Unix timestamp (~now + 30 days in seconds, not milliseconds)
2. **Admin auth**: `POST /api/admin/auth` with correct password (from env) returns 200; missing env var returns 503; wrong password returns 401
3. **Rate limiting (mobile-api)**: send 6 rapid `POST /auth/login` requests from the same IP — 6th should return 429 with `code: RATE_LIMITED`
4. **Rate limiting (sales-dashboard)**: send 6 rapid `POST /api/auth/login` requests — 6th should return 429

## Known issues
- Sales-dashboard rate limiter is in-process memory; does not share state across Vercel serverless instances (by design per spec — in-memory Map was explicitly requested)
- `ADMIN_PASSWORD` must now be set in env; deployments without it will get 503 on admin login until configured
