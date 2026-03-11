# 2026-03-11_071_eval-verification-pipeline

## Summary
Added a deterministic Eval Verification Pipeline to repeatedly test scoring behavior, attribution correctness, profile aggregation, and latency performance with explicit pass/fail gates.

## What Changed
- Added verification runner script:
  - creates isolated temporary SQLite DB
  - seeds minimal workspace/agent/task/delegation fixtures
  - executes four eval scenarios
  - validates expected status + fault attribution
  - validates profile aggregation sample count
  - validates latency target and exits non-zero on failure
- Added npm scripts:
  - app: `npm run eval:verify`
  - root passthrough: `npm run mc:eval:verify`
- Added operations doc with usage and gate definitions.
- Updated task board:
  - `EXP-010e` marked complete.

## Why
You requested high-confidence, repeatable testing that visibly proves how the eval layer behaves and whether it meets performance expectations before continuing.

## Validation
- `npm run mc:eval:verify` passed with all scenario and latency gates.
- `npm run typecheck` passed.
- `npm run mc:build` passed.

## Files
- `apps/mission-control/scripts/eval-verify.ts`
- `apps/mission-control/package.json`
- `package.json`
- `OPERATIONS/EVAL_VERIFICATION_PIPELINE.md`
- `TASK_BOARD.md`
