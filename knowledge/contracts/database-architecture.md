---
tags: [database, sqlite, supabase, schema, shared]
related: [../architecture/known-duplication.md]
---

# Database Architecture

Two database systems serve different purposes. Apps share SQLite for operations.

## SQLite (Operational — shared across apps)

**Location**: `apps/mission-control/mission-control.db`
All TypeScript apps that need sales data point here (sales-dashboard, admin-panel, mobile-api).

**Core tables** (defined in `supabase/sales-dashboard-tables.sql`):
- `sales_users` — salesperson accounts
- `lead_assignments` — lead-to-salesperson bindings with status
- `sales_activity_log` — audit trail
- `demo_links` — shareable demo links

**Mobile-only tables** (defined in `apps/mobile-api/src/db.ts`):
- `visit_sessions` — GPS-tracked visit records
- `lead_photos` — storefront photos
- `push_tokens` — mobile push notification tokens
- `sync_journal` — offline sync queue
- `training_units`, `training_progress`, `training_responses` — academy

**Runtime tables** (separate DB at `data/mvp.sqlite`):
- Tasks, traces, transcripts, notifications, pipeline state for the orchestration system.

## Supabase (PostgreSQL — demo generation + ML)

**Tables**:
- `business_profiles` — scraped business data, brand colours, Google place info
- `demo_records` — generated HTML demos, design metadata, QC scores
- `salesperson_metrics` — performance tracking, Stripe Connect IDs
- `pitch_outcomes` — sale/rejection records with Stripe payment confirmation
- ML tables: `model_versions`, `training_runs`, `decision_log`, `targeting_scores`
- System: `agent_state`, `message_log`, `cost_log`, `validation_flags`, `system_config`

## Schema Duplication Problem

The 4 sales tables are defined in 3 places:
1. **Canonical**: `supabase/sales-dashboard-tables.sql` (with CHECK constraints, indexes, RLS)
2. **Copy 1**: `apps/sales-dashboard/src/lib/db/index.ts` (CREATE TABLE IF NOT EXISTS)
3. **Copy 2**: `apps/mobile-api/src/db.ts` (CREATE TABLE IF NOT EXISTS, relaxed — no CHECK constraints)

Admin-panel's `src/lib/db/index.ts` also has a copy.

Changes to the schema must be applied in all locations manually. The CHECK constraints on status values differ between the canonical SQL and the app copies.

## Connection Pattern

All apps use `better-sqlite3` with WAL mode. Mobile-api sets `foreign_keys = OFF` for cross-app compatibility. No migration system — tables created with `IF NOT EXISTS`.
