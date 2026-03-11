# Telegram Control Plan (Mission Control + OpenClaw)

## Goal
Enable Telegram as a remote operator surface for:
- task progress alerts,
- on-demand status checks,
- control actions (request progress, pause/retry/reassign task) routed to Mission Control/OpenClaw.

## Scope (MVP)
1. Notifications from Mission Control to Telegram chat:
- task assigned
- task blocked/failure
- task completed
- manual `Request Progress` result

2. Telegram command webhook to Mission Control:
- `/status <task_id>`: return current status + assignee + last activity
- `/progress <task_id>`: trigger Mission Control progress request action
- `/tasks`: return top N active tasks summary

3. Security:
- bot token in env only
- allowlist `TELEGRAM_ALLOWED_CHAT_IDS`
- optional shared admin secret for webhook endpoint

## Architecture
1. `apps/mission-control` adds `lib/telegram.ts` sender utility.
2. New API route: `POST /api/integrations/telegram/webhook`.
3. Existing task activity/events pipeline calls telegram notifier when configured.
4. Reuse existing OpenClaw progress-request path for command relay (no duplicate orchestration logic).

## Data + Config
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_DEFAULT_CHAT_ID`
- `TELEGRAM_ALLOWED_CHAT_IDS`
- `TELEGRAM_WEBHOOK_SECRET` (optional but recommended)

## Delivery Phases
1. T1: Outbound notifier only (task/failure/progress events).
2. T2: Inbound commands (`/status`, `/progress`, `/tasks`).
3. T3: Action controls (`/retry`, `/pause`, `/resume`, `/reassign`) with role checks.
4. T4: Rich formatting + deep links into Mission Control task modal.

## Acceptance Criteria
- Telegram receives notifications within 5 seconds of Mission Control event write.
- `/progress <task_id>` triggers same behavior as UI `Request Progress` button.
- Non-allowlisted chat IDs are rejected and logged.
- All telegram-driven actions create task activities and trace events.
