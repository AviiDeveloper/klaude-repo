# 2026-02-27 027 M6 Notification Queue APIs

## Date and sequence
- Date: 2026-02-27
- Sequence: 027

## Milestone mapping
- Milestone 6: runtime/mission-control integration hardening
- RELIABILITY reference: queue notifications when OpenClaw path is unavailable

## Summary
- Added `NotificationStore` contract for persistent notify/call records.
- Added SQLite-backed notification storage with status tracking (`pending`, `acknowledged`).
- Wired OpenClaw adapter to persist outbound `system.notify_user` and `system.call_user` events into queue storage.
- Added Mission Control notification APIs: list/filter notifications and acknowledge by id.
- Wired Mission Control local message/approval flows to persist generated notifications.
- Added API contract test coverage for notification queue listing and acknowledge flow.

## Files changed
- `src/notifications/notificationStore.ts`
- `src/notifications/sqliteNotificationStore.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/missionControl/server.ts`
- `src/index.ts`
- `src/tests/missionControlApi.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `NotificationStore` abstraction.
- `SQLiteNotificationStore` persistent queue implementation.

## Behavior changes
- Notification and callback events are now durable and queryable through Mission Control.
- Mission Control supports filtering notifications by channel/reason/severity/status/task/session.
- Notifications can be acknowledged via API and move from `pending` to `acknowledged`.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove notification store files under `src/notifications`.
2. Revert OpenClaw adapter notification persistence wiring.
3. Revert Mission Control notification endpoints and local persistence hooks.
4. Revert runtime wiring in `src/index.ts`.
5. Revert tests/docs/task board updates.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: duplicate notifications if upstream retries same event.
- Mitigation: queue keeps event ids and status for downstream dedupe policies.
- Risk: notification growth over time.
- Mitigation: filtered query and explicit status lifecycle provide retention-management base.

## Next steps
- Add Mission Control UI panel for notification queue and acknowledgement actions.
- Add retry scheduler for pending notifications when OpenClaw delivery is unhealthy.
