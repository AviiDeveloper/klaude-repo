# 2026-03-11_070_eval-layer-v1-schema-and-apis

## Summary
Implemented Eval Layer V1 foundation in Mission Control: database schema/migration updates, typed eval contracts, eval service logic, and eval API endpoints.

## What Changed
- Added eval + learning tables to base schema and migration `009`:
  - `agent_eval_specs`
  - `agent_eval_runs`
  - `agent_performance_profiles`
  - `learning_questions`
  - `learning_answers`
- Added typed contracts for eval statuses, attribution, spec/run/profile records, and eval API payloads.
- Added eval domain service with:
  - eval spec CRUD helpers
  - task evaluation runner
  - rolling performance profile aggregation
- Added APIs:
  - `GET/POST /api/evals/specs`
  - `GET/PATCH /api/evals/specs/:id`
  - `POST /api/evals/run`
  - `GET /api/evals/task/:task_id`
  - `GET /api/evals/agent/:agent_id/profile`
- Updated task board status:
  - `EXP-010a` marked complete.

## Why
Charlie needed a measurable quality layer before any self-improvement loop. This change establishes persistence + contracts + callable evaluation endpoints to score outputs and track agent reliability.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed (existing lint warnings unchanged).

## Files
- `apps/mission-control/src/lib/db/schema.ts`
- `apps/mission-control/src/lib/db/migrations.ts`
- `apps/mission-control/src/lib/types.ts`
- `apps/mission-control/src/lib/evals.ts`
- `apps/mission-control/src/app/api/evals/specs/route.ts`
- `apps/mission-control/src/app/api/evals/specs/[id]/route.ts`
- `apps/mission-control/src/app/api/evals/run/route.ts`
- `apps/mission-control/src/app/api/evals/task/[task_id]/route.ts`
- `apps/mission-control/src/app/api/evals/agent/[agent_id]/profile/route.ts`
- `TASK_BOARD.md`
