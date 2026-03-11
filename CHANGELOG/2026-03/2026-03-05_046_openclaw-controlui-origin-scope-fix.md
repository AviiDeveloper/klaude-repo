# 2026-03-05 046 OpenClaw Control UI Origin + Scope Fix

## Date and sequence
- Date: 2026-03-05
- Sequence: 046

## Milestone mapping
- Expansion track: Mission Control runtime stability

## Summary
- Upgraded Mission Control OpenClaw websocket client to use explicit Control UI identity and requested operator scopes for task/session methods.
- Switched server-side websocket transport to `ws` package and added configurable websocket origin support.
- Resolved runtime websocket framing issue on Pi by running with `WS_NO_BUFFER_UTIL=1` and `WS_NO_UTF_8_VALIDATE=1`.
- Verified end-to-end gateway connectivity and successful task dispatch from Mission Control.

## Files changed
- `apps/mission-control/src/lib/openclaw/client.ts`
- `apps/mission-control/package.json`
- `apps/mission-control/package-lock.json`
- `src/index.ts`

## Behavior changes
- `GET /api/openclaw/status` returns connected state with live session payload when gateway is healthy.
- `GET /api/openclaw/sessions?source=gateway` now returns session data instead of connection/scope failure.
- `POST /api/tasks/:id/dispatch` can successfully dispatch tasks to OpenClaw agent sessions.

## Tests or verification
- `npm run mc:build` (local)
- `npm run build` in `apps/mission-control` (Pi)
- `curl http://100.93.24.14:3001/api/openclaw/status`
- `curl "http://100.93.24.14:3001/api/openclaw/sessions?source=gateway"`
- `POST /api/tasks` + `POST /api/tasks/:id/dispatch` live smoke test (success)

## Rollback steps
1. Revert websocket client changes in `apps/mission-control/src/lib/openclaw/client.ts`.
2. Remove `ws` dependency changes in mission-control package files.
3. Revert `src/index.ts` build change id update.
4. Restart Mission Control service and remove `WS_NO_BUFFER_UTIL` / `WS_NO_UTF_8_VALIDATE` runtime flags.
5. Delete this changelog pair.

## Next steps
- Persist Mission Control runtime env into a managed service unit on Pi so websocket runtime flags survive reboot.
- Add a visible OpenClaw connection status panel in Mission Control settings/dashboard.
