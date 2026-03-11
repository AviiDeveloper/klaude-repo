# 2026-03-05 049 Queue Plan Preview

## Date and sequence
- Date: 2026-03-05
- Sequence: 049

## Milestone mapping
- Expansion track: Mission Control execution visibility

## Summary
- Added a compact execution-plan preview block to Mission Queue task cards when `planning_spec` exists.
- Preview now shows objective/summary headline, first two plan steps, and approval requirement count.
- Kept preview visually secondary to title/assignee while providing at-a-glance plan quality context.

## Files changed
- `apps/mission-control/src/components/MissionQueue.tsx`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- Task cards now parse and render normalized planning metadata from `planning_spec`.
- Operators can triage tasks faster without opening the task modal for each item.

## Tests or verification
- `npm run mc:build`

## Rollback steps
1. Revert `apps/mission-control/src/components/MissionQueue.tsx` task-card preview additions.
2. Revert `TASK_BOARD.md` and `src/index.ts` updates.
3. Delete this changelog pair.

## Next steps
- Add badge-level indicators for blocked dependencies / missing approvals in queue cards.
- Add filtered view for tasks with non-empty approval requirements.
