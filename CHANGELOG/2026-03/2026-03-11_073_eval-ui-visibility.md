# 2026-03-11_073_eval-ui-visibility

## Summary
Completed Mission Control eval visibility slice by adding task-level evaluation UI, agent-level performance view, and lead queue eval indicators.

## What Changed
- Added `Evaluation` tab to task modal with:
  - latest eval status/score/confidence/fault attribution
  - reason-code chips
  - eval history list
  - manual "Run Eval" trigger action
- Extended agent modal with `Performance` tab:
  - rolling score, sample count, pass rate, input-gap rate
  - recent eval run history
- Extended lead queue query payload to include latest eval data.
- Updated Lead Console cards to display latest eval badge + score + attribution summary.
- Updated task board:
  - `EXP-010c` marked complete.

## Why
This gives the operator immediate observability into output quality and agent reliability directly in Mission Control, aligning UI behavior with Charlie’s eval-driven orchestration model.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed.
- `npm run mc:eval:verify` passed all gates.

## Files
- `apps/mission-control/src/components/EvaluationTab.tsx`
- `apps/mission-control/src/components/TaskModal.tsx`
- `apps/mission-control/src/components/AgentModal.tsx`
- `apps/mission-control/src/components/LeadConsolePanel.tsx`
- `apps/mission-control/src/lib/lead-orchestrator.ts`
- `apps/mission-control/src/lib/types.ts`
- `TASK_BOARD.md`
