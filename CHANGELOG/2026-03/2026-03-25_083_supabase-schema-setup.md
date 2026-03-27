# 2026-03-25_083 — Supabase Schema & Client Setup

## What changed
- Created `supabase/schema.sql` — full SQL schema with all 13 tables specified in production context
  - business_profiles, demo_records, pitch_outcomes, salesperson_metrics
  - model_versions, training_runs, decision_log, agent_state
  - system_config (seeded with 11 default config values), message_log
  - targeting_scores, cost_log, validation_flags
  - All tables: uuid PKs, timestamptz, proper FKs, indexes, RLS enabled
  - `updated_at` triggers on mutable tables
- Created `packages/supabase/` — shared TypeScript client library
  - `index.ts` — `createServiceClient()` and `createAnonClient()` exports
  - `types.ts` — full TypeScript types for all 13 tables, enums, JSONB structures (DesignElements, CopyElements)
  - `package.json` — `@klaude/supabase` package with `@supabase/supabase-js` dependency
- Created `supabase/README.md` — step-by-step setup instructions
- Updated `apps/mission-control/.env.example` — added Supabase env var section

## Why
Phase 1 requires data logging infrastructure as the #1 priority. Every pitch without logging is a permanently lost training data point. The production context (source of truth) specifies Supabase as the decided data layer. This sets up the foundation for all sales platform data — demos, pitches, salespeople, ML training, orchestration decisions.

## Stack
- PostgreSQL (via Supabase managed hosting)
- `@supabase/supabase-js` v2.49.1
- TypeScript
- SQL (DDL with enums, JSONB, RLS, triggers)

## Integrations
- Supabase (new — project needs to be created by user)
- Existing SQLite remains untouched for Mission Control agent system

## How to verify
1. Create a Supabase project at supabase.com
2. Run `supabase/schema.sql` in the SQL Editor
3. Confirm all 13 tables appear in Table Editor
4. Confirm `system_config` table has 11 seeded rows
5. Set env vars in `.env.local` and test:
   ```typescript
   import { createServiceClient } from '@klaude/supabase';
   const supabase = createServiceClient();
   const { data } = await supabase.from('system_config').select('*');
   // Should return 11 rows
   ```

## Known issues
- Supabase project not yet created — user must do this manually
- No migration system yet — schema.sql is a one-shot run
- TypeScript types are hand-written, not auto-generated via `supabase gen types` (can switch later)
- No Supabase CLI (`supabase init`) integration — using SQL Editor approach for simplicity
