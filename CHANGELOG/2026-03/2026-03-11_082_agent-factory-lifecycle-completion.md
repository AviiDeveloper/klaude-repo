# 2026-03-11 082 Agent Factory Lifecycle Completion

## Summary
Completed EXP-008 Wave 1 Thread B for Agent Factory lifecycle hardening: deterministic template completeness enforcement and full reference-sheet lifecycle transitions (`create`, `version`, `revise`, `archive`) with transition audit metadata and invalid-transition guards.

## Why
- EXP-008 required completion of template generation and reference-sheet lifecycle handling.
- Agent generation could be marked successful without deterministic template section integrity checks.
- Reference sheets lacked explicit lifecycle state transitions and transition-level audit tracing.

## What Changed
- Added deterministic reference-template completeness validation in `agent-factory` artifacts:
  - generation now fails if required template markers are missing.
- Added reference-sheet lifecycle model fields and transitions table:
  - `lifecycle_state`, `lifecycle_action`, `parent_sheet_id`, `archived_at`, `updated_at`
  - `agent_reference_sheet_transitions` audit table
- Added migration `011_add_reference_sheet_lifecycle` for existing databases.
- Extended Agent Factory generation route:
  - blocks success on template incompleteness
  - writes lifecycle metadata (`create`) and transition audit row on initial sheet creation.
- Implemented lifecycle API transitions on `/api/agents/[id]/reference-sheet`:
  - `GET`: history/latest with optional archived/transitions visibility
  - `POST`: `create`, `version`, `revise` with state validation and audit
  - `PATCH`: `archive` with state validation and audit
  - prevents invalid transitions (including archived-origin transitions).
- Preserved runtime compatibility:
  - runtime prompt-injection lookups now prefer active reference sheets and exclude archived where appropriate.

## Validation
- `npx tsx --test src/lib/reference-sheet-lifecycle.test.ts src/lib/agent-factory.test.ts` (from `apps/mission-control`) — pass (5/5)
- `npm run typecheck` — pass
- `npm run mc:build` — pass

## Files Touched
- `apps/mission-control/src/app/api/agents/[id]/reference-sheet/route.ts`
- `apps/mission-control/src/app/api/agents/factory/route.ts`
- `apps/mission-control/src/app/api/agents/runtime/route.ts`
- `apps/mission-control/src/app/api/tasks/[id]/dispatch/route.ts`
- `apps/mission-control/src/lib/agent-factory.ts`
- `apps/mission-control/src/lib/db/migrations.ts`
- `apps/mission-control/src/lib/db/schema.ts`
- `apps/mission-control/src/lib/types.ts`
- `apps/mission-control/src/lib/reference-sheet-lifecycle.ts`
- `apps/mission-control/src/lib/reference-sheet-lifecycle.test.ts`
- `apps/mission-control/src/lib/agent-factory.test.ts`
- `TASK_BOARD.md`

## Risks
- UI controls for lifecycle actions (version/revise/archive) are not added in this change; API supports them.
- Existing build emits non-blocking lint warnings unrelated to this scope.
