---
tags: [database, sqlite, supabase, schema, shared]
related: [../architecture/known-duplication.md]
---

# Database Architecture

Two database systems serve different purposes. Apps share SQLite for operations.

## SQLite (Operational — shared across apps)

**Location**: `apps/mission-control/mission-control.db`
All TypeScript apps that need sales data point here (sales-dashboard, admin-panel, mobile-api).

**Core sales tables** (defined in `supabase/sales-dashboard-tables.sql`):
- `sales_users` — salesperson accounts
- `lead_assignments` — lead-to-salesperson bindings with status
- `sales_activity_log` — audit trail
- `demo_links` — shareable demo links

**Mobile-only tables** (defined in `apps/mobile-api/src/db.ts`):
- `visit_sessions` — GPS-tracked visit records
- `lead_photos` — storefront photos
- `push_tokens` — mobile push notification tokens
- `sync_journal` — offline sync queue
- `training_units`, `training_progress`, `training_responses` — SalesFlow Academy

**Mission Control tables** (managed via migrations in `apps/mission-control/src/lib/db/migrations.ts`):

Core:
- `workspaces` — workspace definitions with icon, slug, settings
- `agents` — agent definitions with SOUL.md, status, capabilities
- `tasks` — task objects with status pipeline (inbox→done)
- `conversations`, `messages` — agent communication
- `events` — system event log
- `app_settings` — key-value settings store

Planning:
- `planning_questions`, `planning_specs` — structured planning workflow

Lead Orchestration:
- `lead_task_intake`, `lead_task_delegations` — task routing
- `lead_approval_requests` — approval gating
- `lead_findings`, `lead_decision_logs` — decision audit trail
- `lead_memory_journal` — memory persistence
- `lead_operator_commands` — operator commands

Agent Evaluation:
- `agent_eval_specs`, `agent_eval_runs` — evaluation definitions and runs
- `agent_performance_profiles` — aggregated performance metrics
- `agent_reference_sheets`, `agent_reference_sheet_transitions` — agent config lifecycle

Learning:
- `learning_questions`, `learning_answers` — architecture reasoning trainer

Outreach:
- `outreach_campaigns`, `outreach_leads`, `outreach_lead_profiles` — campaign management
- `site_templates`, `generated_sites` — demo site generation

Operational:
- `openclaw_sessions` — OpenClaw session tracking
- `operator_profiles` — operator memory and preferences
- `ai_request_telemetry` — LLM call logging (model, tokens, latency, cost)
- `task_activities`, `task_deliverables` — task lifecycle artifacts
- `launch_checklist` — Project Pulse launch readiness tracking

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

The 4 core sales tables are defined in 3 places:
1. **Canonical**: `supabase/sales-dashboard-tables.sql` (with CHECK constraints, indexes, RLS)
2. **Copy 1**: `apps/sales-dashboard/src/lib/db/index.ts` (CREATE TABLE IF NOT EXISTS)
3. **Copy 2**: `apps/mobile-api/src/db.ts` (relaxed — no CHECK constraints, missing columns)
4. **Copy 3**: `apps/admin-panel/src/lib/db/index.ts`

**Known gaps in mobile-api schema**: missing `follow_up_at`, `follow_up_note`, `contact_name`, `contact_role` columns and DemoLinkStatus CHECK constraint.

Changes to the schema must be applied in all locations manually.

## Connection Pattern

All apps use `better-sqlite3` with WAL mode. Mobile-api sets `foreign_keys = OFF` for cross-app compatibility. Mission Control uses a migration system (016 migrations). Other apps use `CREATE TABLE IF NOT EXISTS`.
