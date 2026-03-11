# 2026-03-05 051 Planning Provider Error Visibility

## Date and sequence
- Date: 2026-03-05
- Sequence: 051

## Milestone mapping
- Expansion track: planning reliability

## Summary
- Fixed Mission Control Planning tab getting stuck on `Waiting for next question...` when planner provider fails upstream.
- Wired planning state load to capture and show `plannerError` returned by `/api/tasks/:id/planning`.
- Added explicit failure state UI so OpenClaw/provider auth failures are visible and actionable.

## Files changed
- `apps/mission-control/src/components/PlanningTab.tsx`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- Planning view now renders `Planner failed` with provider error details instead of an infinite spinner when upstream planner returns an error (for example `401 User not found`).
- Users can distinguish "waiting" from "backend failure" without checking server logs.

## Tests or verification
- `npm run mc:build`
- `npm run mc:lint`

## Rollback steps
1. Revert `apps/mission-control/src/components/PlanningTab.tsx` planner error handling block.
2. Revert `TASK_BOARD.md` and `src/index.ts` updates.
3. Delete this changelog pair.

## Next steps
- Fix OpenClaw provider auth on runtime host so planning question generation succeeds again.
- Add a one-click `Retry planner` action in Planning UI after provider errors.
