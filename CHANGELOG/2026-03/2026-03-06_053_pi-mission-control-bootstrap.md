# 2026-03-06 053 Pi Mission Control Bootstrap

## Date and sequence
- Date: 2026-03-06
- Sequence: 053

## Milestone mapping
- Expansion track: operational reliability

## Summary
- Added Pi-targeted startup and stop scripts for Mission Control runtime recovery after reboots.
- Startup script now auto-writes `apps/mission-control/.env.local` using `~/.openclaw/openclaw.json` gateway token and known gateway URL/origin defaults.
- Script also starts Next.js with websocket compatibility flags and prints immediate OpenClaw status/log tail for fast diagnostics.

## Files changed
- `scripts/pi/mc-start.sh`
- `scripts/pi/mc-stop.sh`
- `README.md`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- Operators can bring Mission Control back online with one command (`bash scripts/pi/mc-start.sh`) instead of manual env + restart steps.
- Post-reboot recovery path is deterministic and self-diagnosing.

## Tests or verification
- Script syntax/permission check (`chmod +x` + local file verification)
- `npm run mc:build`

## Rollback steps
1. Delete `scripts/pi/mc-start.sh` and `scripts/pi/mc-stop.sh`.
2. Revert README/task board/index updates.
3. Delete this changelog pair.

## Next steps
- Add optional systemd user unit wrapper that calls `scripts/pi/mc-start.sh` at login.
- Add workspace reset helper for stale smoke-test workspaces in `mission-control.db`.
