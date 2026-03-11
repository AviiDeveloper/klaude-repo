# 2026-03-11_072_charlie-eval-autowire-weighted-delegation

## Summary
Completed Charlie-side Eval Layer integration by auto-running evaluation on worker findings and incorporating rolling eval performance into delegation scoring.

## What Changed
- Extended lead delegation scoring to include `agent_performance_profiles` metrics:
  - rolling score
  - pass/failure rates
  - confidence and sample counts
- Added `evaluateDelegationOutcome` in lead orchestrator:
  - runs task evaluation
  - writes lead decision log + memory journal entry
  - updates lead intake status based on fault attribution:
    - `input_gap` -> `awaiting_operator`
    - `agent_error` fail -> `blocked` (retry/reassign candidate)
    - pass/partial -> `monitoring`
- Updated finding submission endpoint to auto-trigger evaluation and return evaluation payload.
- Updated task board:
  - `EXP-010b` marked complete.

## Why
This closes the gap where Charlie could orchestrate execution but could not use measured quality outcomes to adapt delegation decisions or escalate the correct next action.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed.
- `npm run mc:eval:verify` passed all gates.

## Files
- `apps/mission-control/src/lib/lead-orchestrator.ts`
- `apps/mission-control/src/app/api/lead/tasks/[id]/findings/route.ts`
- `TASK_BOARD.md`
