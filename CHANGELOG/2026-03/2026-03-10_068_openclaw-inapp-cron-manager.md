# 2026-03-10_068_openclaw-inapp-cron-manager

## Summary
Added an in-app Mission Control panel for native OpenClaw cron management, so cron jobs can be created and operated without terminal usage.

## What Changed
- Added OpenClaw cron CLI wrapper utilities:
  - list/status
  - run/disable/remove
  - create trigger job for Mission Control pipeline endpoint
- Added new API routes:
  - `GET/POST /api/openclaw/cron`
  - `POST /api/openclaw/cron/:id`
- Extended Settings UI with a dedicated **OpenClaw Native Cron** section:
  - create trigger job fields
  - refresh/list/status output
  - run/disable/remove/history actions by cron ID
- Updated docs and task board for the new no-terminal cron control path.

## Why
This removes daily operational friction and keeps scheduler control inside Mission Control, while still using native OpenClaw cron as the scheduler backend.

## Files
- `apps/mission-control/src/lib/openclaw/cron-cli.ts`
- `apps/mission-control/src/app/api/openclaw/cron/route.ts`
- `apps/mission-control/src/app/api/openclaw/cron/[id]/route.ts`
- `apps/mission-control/src/app/settings/page.tsx`
- `README.md`
- `TASK_BOARD.md`
