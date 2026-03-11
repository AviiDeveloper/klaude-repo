# 2026-03-10_067_openclaw-cron-trigger-mode

## Summary
Added a native OpenClaw cron integration path by introducing an external trigger mode for pipeline runs, while keeping the existing internal scheduler available.

## What Changed
- Added scheduler mode switching in mission-control runtime:
  - `SCHEDULER_MODE=internal` keeps existing setInterval scheduler.
  - `SCHEDULER_MODE=openclaw-cron` disables internal ticking and expects external cron triggers.
- Added runtime visibility endpoint:
  - `GET /api/scheduler/mode`
- Added protected external trigger endpoint:
  - `POST /api/jobs/:id/trigger`
  - uses `trigger: "scheduler"` and optional token guard via `MISSION_CONTROL_CRON_TRIGGER_TOKEN` + `x-mc-cron-token` header.
- Added PI helper script to register OpenClaw cron jobs that call the trigger endpoint:
  - `scripts/pi/openclaw-cron-wire.sh`
- Added API test coverage for:
  - scheduler mode visibility
  - token-protected trigger behavior
- Updated runtime docs in `README.md`.

## Why
The project needs OpenClaw-native scheduling where possible. This change separates scheduling concerns from orchestration concerns:
- OpenClaw cron can own time-based job triggering.
- Mission Control keeps DAG execution, Lead mediation, approvals, and persistence.

## Files
- `src/index.ts`
- `src/missionControl/server.ts`
- `src/tests/missionControlApi.test.ts`
- `scripts/pi/openclaw-cron-wire.sh`
- `README.md`
- `TASK_BOARD.md`
