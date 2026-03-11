# 2026-03-07 054 Planner Auth + Bootstrap Fix

## Date and sequence
- Date: 2026-03-07
- Sequence: 054

## Milestone mapping
- Expansion track: planner reliability and runtime hardening

## Summary
- Fixed planner `401 User not found` by aligning OpenClaw runtime auth profile key material with the active OpenRouter key.
- Hardened Mission Control task planning auto-bootstrap to use an internal HTTP origin (`MISSION_CONTROL_INTERNAL_ORIGIN` or `http://127.0.0.1:<port>`), removing TLS mismatch failures when app traffic enters via HTTPS reverse proxy.
- Validated end-to-end planning success from both HTTP and HTTPS entrypoints.

## Files changed
- `apps/mission-control/src/app/api/tasks/route.ts`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- New planning sessions now produce planner questions instead of immediate provider auth failure caused by stale auth profile credentials.
- Creating tasks with `status=planning` behind HTTPS proxy no longer triggers `ERR_SSL_PACKET_LENGTH_TOO_LONG` in server-side bootstrap fetch.

## Tests or verification
- `npm run mc:build`
- Live Pi check: fresh planning session returns assistant JSON question (no `PLANNER_ERROR`)
- Live Pi check over HTTPS (`https://100.93.24.14`): planning auto-bootstrap succeeds and returns assistant question

## Rollback steps
1. Revert `apps/mission-control/src/app/api/tasks/route.ts` to previous origin-based bootstrap fetch behavior.
2. Restore previous auth profile files under `~/.openclaw/agents/main/agent/` from backups if needed.
3. Revert `TASK_BOARD.md` and `src/index.ts` updates.
4. Delete this changelog pair.

## Next steps
- Add a startup integrity check that compares `.env` provider key hash vs OpenClaw auth-profile hash and warns on mismatch.
- Add integration test covering `status=planning` task creation in proxied HTTPS deployments.
