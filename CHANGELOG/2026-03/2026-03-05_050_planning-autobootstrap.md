# 2026-03-05 050 Planning Auto-Bootstrap

## Date and sequence
- Date: 2026-03-05
- Sequence: 050

## Milestone mapping
- Expansion track: planning reliability

## Summary
- Fixed planning tasks being created with `status=planning` but no `planning_session_key`.
- Added server-side auto-bootstrap call on task create so planning sessions start automatically whenever a task is created in planning state.
- Switched bootstrap target from shared runtime URL to request origin to ensure it calls the active Next.js API host.

## Files changed
- `apps/mission-control/src/app/api/tasks/route.ts`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- New planning tasks now automatically start `/api/tasks/:id/planning` and populate `planning_session_key`/messages without manual intervention.
- Prevents queue cards from getting stuck in "Continue planning" with no active planning session.

## Tests or verification
- `npm run mc:build`
- Live API test: create task with `status=planning` and verify planning state reports `isStarted=true` + non-null `sessionKey`

## Rollback steps
1. Revert `apps/mission-control/src/app/api/tasks/route.ts` planning auto-bootstrap block.
2. Revert `TASK_BOARD.md` and `src/index.ts` updates.
3. Delete this changelog pair.

## Next steps
- Deploy updated planning prompt/normalization route changes to Pi so planner prompt matches latest source-of-truth text.
