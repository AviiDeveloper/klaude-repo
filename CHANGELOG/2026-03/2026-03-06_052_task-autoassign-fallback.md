# 2026-03-06 052 Task Auto-Assign Fallback

## Date and sequence
- Date: 2026-03-06
- Sequence: 052

## Milestone mapping
- Expansion track: Mission Control workflow reliability

## Summary
- Added default auto-assignment behavior for task creation when no explicit assignee is provided.
- Added fallback assignment when a task is moved to `assigned` status without an assignee.
- Kept natural-language assignee inference as the first priority and only use fallback when inference is empty.

## Files changed
- `apps/mission-control/src/lib/task-assignment.ts`
- `apps/mission-control/src/app/api/tasks/route.ts`
- `apps/mission-control/src/app/api/tasks/[id]/route.ts`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- New tasks now auto-assign to the least-loaded agent in the workspace if no explicit or inferred assignee exists.
- Tasks moved to `assigned` via PATCH also auto-select a default agent when needed.
- Queue flow is less likely to leave tasks stranded unassigned.

## Tests or verification
- `npm run mc:build`

## Rollback steps
1. Revert default picker additions in `task-assignment.ts`.
2. Revert task create/update route fallback assignment usage.
3. Revert `TASK_BOARD.md` and `src/index.ts` updates.
4. Delete this changelog pair.

## Next steps
- Add a workspace-level setting to toggle default auto-assignment.
- Add unit tests for load-based assignee selection.
