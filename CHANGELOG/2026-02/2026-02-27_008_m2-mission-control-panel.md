# 2026-02-27 008 M2 Mission Control Panel

## Date and sequence
- Date: 2026-02-27
- Sequence: 008

## Milestone mapping
- Milestone 2: Mission Control minimal local panel
- SPEC references: Section 4.1 (Mission Control), Section 6 (Task system), Section 9 (Milestone 2)

## Summary
- Added Mission Control HTTP server with minimal UI and local API surface.
- Added API endpoints for health, task list, task detail+trace, and message execution.
- Added mission-control runtime mode (`INTERFACE_MODE=mission-control`).
- Added contract test for Mission Control API create/list behavior.
- Added `npm run verify` command for one-shot local validation.

## Files changed
- `src/missionControl/server.ts`
- `src/index.ts`
- `src/tests/missionControlApi.test.ts`
- `src/tests/sqlitePersistence.test.ts`
- `README.md`
- `package.json`
- `TASK_BOARD.md`

## New components
- `MissionControlServer` local web panel + JSON API.

## Behavior changes
- Runtime can now run as a long-lived Mission Control process.
- Users can create tasks from the panel and inspect status/logs/traces via browser.

## Tests or verification
- `npm run typecheck`
- `npm test`
- `INTERFACE_MODE=mission-control npm run dev` + `GET /api/health` + `GET /api/tasks`

## Rollback steps
1. Remove `src/missionControl/server.ts`.
2. Revert mission-control mode wiring in `src/index.ts`.
3. Remove `missionControlApi.test.ts` and related test updates.
4. Revert README and package script updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: mission-control endpoint misuse in shared environments.
- Mitigation: default binds to localhost (`127.0.0.1`) with configurable host/port.
- Risk: API regressions in task creation/listing paths.
- Mitigation: contract test covers create/list flow and is part of `npm test`.

## Next steps
- Implement `M3-001` approval request event emission and storage.
- Implement `M3-002` approval decision handling to unblock/deny side effects.
- Enforce approval tokens during side-effect execution path.
