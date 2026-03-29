# Demo Record Logging with Screenshot Capture

**Date:** 2026-03-29
**Sequence:** 084
**Type:** feat

## What changed

### New files
- `src/demos/types.ts` — DemoRecord, DesignElements, PitchOutcomeInput, DemoQuery types
- `src/demos/demoRecordStore.ts` — DemoRecordStore interface + InMemoryDemoRecordStore
- `src/demos/sqliteDemoRecordStore.ts` — SQLite-backed store with indexed queries
- `src/demos/screenshotCapture.ts` — Playwright headless screenshot capture (graceful fallback)
- `src/demos/demoRecorder.ts` — DemoRecorder service + extractDesignElements helper
- `src/tests/demoRecorder.test.ts` — 13 tests (record, QA, outcomes, persistence, extraction)

### Modified files
- `src/agents/outreach/siteComposerAgent.ts` — Records demos after generation via DemoRecorder
- `src/agents/outreach/siteQaAgent.ts` — Records QA pass/fail scores to demo records
- `src/pipeline/agentRuntime.ts` — Injects DemoRecorder into site-composer and site-qa agent configs
- `src/index.ts` — Bootstrap creates SQLiteDemoRecordStore + DemoRecorder

## Why

Step 4 of the spec's mandatory self-learning build order. Every generated demo must be captured with full design_elements JSON (colours, layout, typography, hero style, sections) so that when pitch outcomes are logged, the training pipeline can learn which design choices lead to closes.

## Stack

TypeScript, SQLite (better-sqlite3), Playwright (optional, for screenshots), node:test

## Integrations

- Local filesystem via assetStore for screenshots
- DecisionLogger integration (logs demo generation and pitch outcome decisions)
- Pipeline agents (site-composer, site-qa) via config injection

## How to verify

1. `npm run verify` — 79 pass, 1 pre-existing fail
2. Pipeline run → `demo_records` table populated with design_elements JSON
3. QA results flow back into demo records (quality_score, quality_passed)
4. Each demo captures: colour palette, layout type, typography pair, hero style, section order, density, colour temperature
5. Pitch outcomes can be recorded with salesperson_close_rate_at_time

## Known issues

- Screenshots require Playwright browsers installed (`npx playwright install chromium`) — gracefully skipped otherwise
- Storage is local filesystem only — R2 migration planned for production
- scrape_quality_score defaults to 0 when not provided by upstream profiler
