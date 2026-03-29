# Decision Logger — Self-Learning Data Foundation

**Date:** 2026-03-29
**Sequence:** 083
**Type:** feat

## What changed

### New files
- `src/decisions/types.ts` — Decision types (DecisionRecord, DecisionInput, DecisionOutcome, DecisionQuery, AccuracyReport)
- `src/decisions/decisionStore.ts` — DecisionStore interface + InMemoryDecisionStore
- `src/decisions/sqliteDecisionStore.ts` — SQLite-backed DecisionStore with indexed queries
- `src/decisions/decisionLogger.ts` — Core DecisionLogger class (log, recordOutcome, query, getAccuracy)
- `src/tests/decisionLogger.test.ts` — 13 tests covering logging, outcomes, accuracy, persistence, events

### Modified files
- `src/events/bus.ts` — Added `decision.logged` and `decision.outcome_measured` event types
- `src/index.ts` — Bootstrap creates SQLiteDecisionStore + DecisionLogger, passes to Orchestrator and AgentRuntime
- `src/orchestrator/orchestrator.ts` — Logs decisions at task creation, agent dispatch; records outcomes at completion/failure
- `src/pipeline/agentRuntime.ts` — Wraps every pipeline agent execution with decision logging (input → output)

## Why

Step 2-3 of the spec's mandatory self-learning build order. Every agent decision must be captured with expected vs actual outcomes before any learning system can be built. Every pitch without structured logging is a permanently lost data point.

## Stack

TypeScript, SQLite (better-sqlite3), node:test

## Integrations

None (pure internal infrastructure). Follows existing SQLiteTaskStore/InMemoryTaskStore pattern.

## How to verify

1. `npm run verify` — 66 pass, 1 pre-existing fail (outreach pipeline needs API key)
2. Start runtime: `npm run dev` — DecisionLogger initialises, `decision_log` table created in SQLite
3. Execute a task — decisions appear in `decision_log` table with agent_id, type, rationale
4. Pipeline runs log every agent execution as a decision with input/output tracking

## Known issues

- No Supabase sync yet — decisions stay in local SQLite (migration to Supabase is a future step)
- Prediction accuracy uses simple score comparison; more sophisticated metrics can be added per-agent
- Outreach agents don't log agent-specific decisions (e.g., QC threshold) — the pipeline wrapper captures the overall execution, which is sufficient for Phase 1 data collection
