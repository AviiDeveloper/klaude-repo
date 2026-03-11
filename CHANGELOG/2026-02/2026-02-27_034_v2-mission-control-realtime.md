# 2026-02-27 034 V2 Mission Control Realtime

## Date and sequence
- Date: 2026-02-27
- Sequence: 034

## Milestone mapping
- Voice mode expansion (Realtime operations)
- Mission Control operational surface enhancement

## Summary
- Added Mission Control API endpoint `POST /api/realtime/session` using shared realtime session broker.
- Added Mission Control UI controls to request Realtime Mini sessions directly from the panel.
- Added response pane in Mission Control UI to show returned realtime session payload.
- Wired mission-control runtime construction to pass optional realtime broker from `index.ts`.
- Added API tests for realtime session success and unavailable (`503`) paths.
- Added ADR documenting Mission Control realtime API contract addition.

## Files changed
- `src/missionControl/server.ts`
- `src/tests/missionControlApi.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`
- `ADR/ADR-0008-mission-control-realtime-api.md`

## New components
- Mission Control realtime session UI action and API route.

## Behavior changes
- Mission Control can now mint `gpt-realtime-mini` session credentials when realtime broker is configured.
- Mission Control returns explicit `503` when realtime broker is unavailable.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove mission-control `POST /api/realtime/session` route and UI controls.
2. Revert mission-control constructor broker parameter and index wiring.
3. Revert mission-control realtime tests.
4. Revert docs/task board/ADR updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: operator confusion when realtime is disabled.
- Mitigation: explicit `503` error with actionable env configuration guidance.
- Risk: overexposing session metadata.
- Mitigation: route remains local mission-control scope and intended for development operations.

## Next steps
- Wire browser WebRTC client path in Mission Control using returned client secret.
- Add mission-control fallback action to `/calls/*` flow when realtime setup fails.
