# 2026-03-07 055 Execution Heartbeat Visibility

## Date and sequence
- Date: 2026-03-07
- Sequence: 055

## Milestone mapping
- Expansion track: Mission Control execution visibility and operator trust

## Summary
- Added dispatch-time execution heartbeat logging tied to run IDs so long-running tasks emit visible progress.
- Added automatic task `updated_at` touch + `task_updated` SSE broadcast during heartbeat cycles.
- Added Activity tab polling and mission-queue card `active now` indicator for in-progress tasks.

## Files changed
- `apps/mission-control/src/app/api/tasks/[id]/dispatch/route.ts`
- `apps/mission-control/src/components/ActivityLog.tsx`
- `apps/mission-control/src/components/MissionQueue.tsx`
- `TASK_BOARD.md`

## Behavior changes
- Dispatch now records `task_activities` entries when execution starts, during periodic heartbeat updates, and when run monitoring completes/stops.
- In-progress cards show `active now` when fresh heartbeat/touch signals are present.
- Activity tab refreshes every 5 seconds, so operators can observe progress without reopening modals.

## Tests or verification
- `npm run mc:build`
- Live API dispatch test: `POST /api/tasks/:id/dispatch` returns success and run starts
- Pi runtime log check: dispatch run lifecycle start observed for task `7dc9ed7d-7904-4572-8cdc-fc6c94bde1a0`

## Rollback steps
1. Revert dispatch route heartbeat/monitor additions.
2. Revert ActivityLog polling change.
3. Revert MissionQueue `active now` indicator.
4. Revert `TASK_BOARD.md` and delete this changelog pair.

## Next steps
- Add explicit run phase text to task cards (queued/running/waiting/errored).
- Add persisted `last_activity_at` column to avoid overloading `updated_at` semantics.
