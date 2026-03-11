# 2026-03-07 056 Task Progress Request Action

## Date and sequence
- Date: 2026-03-07
- Sequence: 056

## Milestone mapping
- Expansion track: Mission Control execution visibility and operator control

## Summary
- Added a task-level API to explicitly request a progress update from the assigned OpenClaw agent session.
- Added a `Request Progress` button in Task Modal (Overview tab).
- Logged progress-request actions into `task_activities` and `events` for auditability.

## Files changed
- `apps/mission-control/src/app/api/tasks/[id]/progress-request/route.ts`
- `apps/mission-control/src/components/TaskModal.tsx`
- `TASK_BOARD.md`

## Behavior changes
- Operators can now request an immediate progress update without waiting for passive heartbeat updates.
- Request uses the assigned agent’s active `openclaw_sessions` record and sends a structured Mission Control prompt.
- UI automatically switches to Activity tab after request.

## Tests or verification
- `npm run mc:build`
- Build output includes new route: `/api/tasks/[id]/progress-request`

## Rollback steps
1. Delete `apps/mission-control/src/app/api/tasks/[id]/progress-request/route.ts`.
2. Remove `Request Progress` button and handler from `TaskModal.tsx`.
3. Revert `TASK_BOARD.md` and delete this changelog pair.

## Next steps
- Add optional custom request prompt input (quick templates: ETA, blockers, deliverables-only).
- Add Telegram bridge subscription for task/activity notifications and command relay.
