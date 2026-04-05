# Mobile API — App Instructions

Express.js backend serving the iOS app and mobile apps.

## Quick Reference
- **Port**: 4350
- **Dev**: `npm run dev` from this directory (or via root launch.json)
- **Auth**: HMAC Bearer token — same `SD_SECRET` as sales-dashboard (`src/auth.ts`)
- **DB**: SQLite (shared at `../mission-control/mission-control.db`)
- **No dedicated types file** — uses inline types and DB row shapes

## Before Editing
Search the `business-brain` MCP tool for context.
Key knowledge notes: `auth-contract.md`, `entity-lead.md`, `database-architecture.md`.

Auth logic is duplicated from sales-dashboard. Known bug: token expiry uses milliseconds
here but seconds in sales-dashboard. See `knowledge/contracts/auth-contract.md`.

## Routes
- `/auth` — login, register, me
- `/leads` — list, detail, status update, intel, brief
- `/visits` — GPS-tracked visit sessions
- `/photos` — lead/storefront photos
- `/payments` — Stripe checkout URL, payment status, Connect onboarding
- `/training` — SalesFlow Academy units, progress, responses
- `/sync` — offline sync journal
- `/push` — push notification registration
- `/health` — health check

## Mobile-Only Features
This API serves features not in the web dashboard:
- **Visit sessions** (`visit_sessions` table) — GPS tracking during business visits
- **Lead photos** (`lead_photos` table) — storefront photos
- **Training academy** (`training_units`, `training_progress`, `training_responses`)
- **Offline sync** (`sync_journal` table)
- **Push notifications** (`push_tokens` table)

## iOS Contract
The iOS app (`apps/ios/salesflow/`) talks exclusively to this API.
Swift models in `Models.swift` must match the JSON shapes returned here.
When changing response formats, check the iOS DTOs: LeadDTO, TrainingUnit, etc.

## Architecture Notes
- Schema created with `CREATE TABLE IF NOT EXISTS` in `src/db.ts` — relaxed copy of canonical schema
- `foreign_keys = OFF` for cross-app compatibility
- Training seed data in `src/training-content.ts`
