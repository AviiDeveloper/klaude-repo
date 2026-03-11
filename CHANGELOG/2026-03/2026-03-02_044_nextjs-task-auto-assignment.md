# 2026-03-02 044 Next.js Task Auto-Assignment

## Date and sequence
- Date: 2026-03-02
- Sequence: 044

## Milestone mapping
- Expansion track: Mission Control task routing UX

## Summary
- Added natural-language task assignment inference in imported Next.js Mission Control API routes.
- Create route now infers assignee from task text when `assigned_agent_id` is omitted.
- Update route now infers assignee from updated title/description when explicit assignee is omitted.
- Added support for common patterns: `assign ... to <agent>`, `@agent-slug`, and inline agent name match.

## Files changed
- `apps/mission-control/src/lib/task-assignment.ts`
- `apps/mission-control/src/app/api/tasks/route.ts`
- `apps/mission-control/src/app/api/tasks/[id]/route.ts`
- `README.md`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- `POST /api/tasks` can auto-set:
  - `assigned_agent_id`
  - status to `assigned` when assignment is inferred and status is not explicitly provided.
- `PATCH /api/tasks/:id` can auto-set `assigned_agent_id` from updated text.

## Tests or verification
- Built imported app: `npm run mc:build`
- API smoke verified:
  - create flow inferred `assigned_agent_id` + `status=assigned`
  - patch flow inferred `assigned_agent_id` from `@agent-slug`

## Rollback steps
1. Remove `apps/mission-control/src/lib/task-assignment.ts`.
2. Revert inference wiring in `apps/mission-control/src/app/api/tasks/route.ts`.
3. Revert inference wiring in `apps/mission-control/src/app/api/tasks/[id]/route.ts`.
4. Revert docs/board/build-id updates.
5. Remove this changelog pair.

## Next steps
- Add confidence scoring + explicit UI preview of inferred assignee before save.
- Add route-level unit tests for inference patterns and false-positive guardrails.
