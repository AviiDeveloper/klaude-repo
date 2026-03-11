# 2026-03-02 041 ClawDeck API Compat Wiring

## Date and sequence
- Date: 2026-03-02
- Sequence: 041

## Milestone mapping
- Expansion track: Mission Control full integration

## Summary
- Added a persistent ClawDeck compatibility store in mission-control runtime (SQLite-backed workspaces, agents, tasks, events).
- Wired ClawDeck-style API endpoints directly into `klaude-repo` mission-control server.
- Preserved existing mission-control endpoints and behavior, including legacy `/api/tasks` summary when not using workspace-scoped filters.
- Added automated tests proving compatibility CRUD flows.

## Files changed
- `src/missionControl/clawdeckCompatStore.ts`
- `src/missionControl/server.ts`
- `src/tests/missionControlApi.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `ClawdeckCompatStore` for compatibility schema + CRUD operations.

## Behavior changes
- Mission-control now serves ClawDeck contract endpoints:
  - `/api/workspaces`, `/api/workspaces/:id`
  - `/api/agents`, `/api/agents/:id`
  - `/api/tasks` (compat mode via workspace filters), `/api/tasks/:id` (compat task IDs)
  - `/api/events`
  - `/api/openclaw/status`
- Existing in-repo APIs remain available for orchestrator/trace/pipeline controls.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `ClawdeckCompatStore` wiring from `src/index.ts` and `src/missionControl/server.ts`.
2. Delete `src/missionControl/clawdeckCompatStore.ts`.
3. Revert API compatibility route blocks in `src/missionControl/server.ts`.
4. Remove compatibility test case from `src/tests/missionControlApi.test.ts`.
5. Revert this changelog pair.

## Risks and mitigations
- Risk: compatibility and legacy routes share some paths (`/api/tasks`).
- Mitigation: compatibility mode is query/id-scoped (`workspace_id` filters or `mctask_` IDs), preserving existing response shape for legacy no-filter calls.

## Next steps
- Add compatibility endpoints for task activity/deliverables/planning if you want full parity with the previous Next.js mission-control app.
- Optionally wire SSE stream compatibility (`/api/events/stream`) for live feed transport parity.
