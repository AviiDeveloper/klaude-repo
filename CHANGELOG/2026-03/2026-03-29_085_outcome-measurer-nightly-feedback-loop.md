# Outcome Measurer — Nightly Feedback Loop

**Date:** 2026-03-29
**Sequence:** 085
**Type:** feat

## What changed

### New files
- `src/agents/outreach/outcomeMeasurerAgent.ts` — Nightly agent that measures pending decision outcomes, expires stale decisions (14-day window), and computes per-agent prediction accuracy reports
- `src/tests/outcomeMeasurer.test.ts` — 6 tests (measure via QA cross-ref, expiry, skip measured, accuracy reports, empty list, no logger)

### Modified files
- `src/agents/outreach/index.ts` — Register outcome-measurer-agent
- `src/pipeline/engine.ts` — Add createOutcomeMeasurerDefinition() (FREQ=DAILY;BYHOUR=2)
- `src/pipeline/agentRuntime.ts` — Inject decisionLogger + demoRecorder into outcome-measurer config
- `src/index.ts` — Create outcome-measurer-v1 pipeline definition on startup

## Why

Step 5 of the spec's mandatory self-learning build order. Closes the feedback loop — turns raw decision and demo logs into measured outcomes with prediction accuracy. Without this, data accumulates but never feeds back into learning.

## Stack

TypeScript, node:test

## Integrations

- DecisionLogger (reads pending, writes outcomes)
- DemoRecorder (cross-references QA results)
- Pipeline scheduler (RRULE nightly at 02:00)

## How to verify

1. `npm run verify` — 85 pass, 1 pre-existing fail
2. Pipeline definition `outcome-measurer-v1` created in SQLite on startup
3. Manual pipeline trigger measures pending demo_generated decisions via QA cross-reference
4. Decisions older than 14 days automatically expired
5. Per-agent accuracy reports computed in artifacts output

## Known issues

- Only measures `demo_generated` decisions currently — other decision types measured at execution time
- Telegram notification integration not yet built (summary output ready for it)
- Requires DecisionLogger and DemoRecorder in config (gracefully skips if missing)
