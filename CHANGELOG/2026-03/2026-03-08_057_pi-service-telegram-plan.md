# 2026-03-08 057 Pi Service Stabilization + Telegram Control Plan

## Date and sequence
- Date: 2026-03-08
- Sequence: 057

## Milestone mapping
- Expansion track: operator visibility and remote control hardening

## Summary
- Stabilized Pi runtime by switching Mission Control Next.js from ad-hoc nohup to managed user systemd service.
- Verified HTTPS reverse proxy target (`127.0.0.1:3001`) returns live Mission Control/API responses again.
- Added tracked Telegram control integration plan and Task Board milestone.

## Files changed
- `TASK_BOARD.md`
- `OPERATIONS/TELEGRAM_CONTROL_PLAN.md`

## Behavior changes
- Deployment guidance now tracks Telegram as an explicit build milestone (`EXP-007`).
- Mission Control process management on Pi now has a durable target (`mission-control-next.service`) for restart/recovery.

## Tests or verification
- `curl -sk https://100.93.24.14/` -> HTTP 200
- `curl -sk https://100.93.24.14/api/tasks` -> HTTP 200 JSON
- `curl -sk -X POST https://100.93.24.14/api/tasks/7dc9ed7d-7904-4572-8cdc-fc6c94bde1a0/progress-request -d '{}' -H 'content-type: application/json'` -> success=true

## Rollback steps
1. Remove `EXP-007` row from `TASK_BOARD.md`.
2. Delete `OPERATIONS/TELEGRAM_CONTROL_PLAN.md`.
3. (Pi runtime) disable user service `mission-control-next.service` and return to manual process management if required.

## Next steps
- Implement T1 notifier: outbound task/failure/progress telegram updates.
- Implement T2 command relay: `/status`, `/progress`, `/tasks` webhook handlers.
