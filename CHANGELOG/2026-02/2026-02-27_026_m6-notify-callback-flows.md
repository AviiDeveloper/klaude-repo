# 2026-02-27 026 M6 Notify and Callback Flows

## Date and sequence
- Date: 2026-02-27
- Sequence: 026

## Milestone mapping
- Milestone 6: runtime integration hardening for blocked/failure escalation
- SPEC reference: section 3 (notify/call back when blocked) and section 8.3 (notify/callback triggers)

## Summary
- Added interface-level notification contract for `missing_input`, `task_blocked`, `task_failed`, and `approval_denied` conditions.
- Added outbound OpenClaw events `system.notify_user` and `system.call_user` in inbound adapter mapping.
- Added missing-input guard that avoids task creation and emits callback request for clarification.
- Added blocked/failure escalation wiring after task execution and approval-denied decisions.
- Persisted notify/callback outbound events into session transcripts for audit continuity.
- Updated Mission Control message/approval APIs to include notification payloads.

## Files changed
- `src/interface/controller.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/tests/adapterContract.test.ts`
- `src/missionControl/server.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `InterfaceNotificationRequest` contract.
- Adapter outbound event payloads for `system.notify_user` and `system.call_user`.

## Behavior changes
- Ambiguous one-word or weak-input requests now produce clarification messages and a callback event instead of creating tasks.
- Approval denial now emits `system.notify_user` in addition to task-status messaging.
- Failed task execution now emits `system.call_user` escalation event.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert notification contract and missing-input logic in `InterfaceController`.
2. Remove notify/call event types and mapping from OpenClaw adapter.
3. Revert transcript persistence of notify/call events.
4. Revert mission-control notification passthrough.
5. Revert docs/task-board updates.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: false positives for missing-input detection.
- Mitigation: limited weak-phrase list and explicit clarification response.
- Risk: notify/callback fatigue.
- Mitigation: emits only for defined high-signal conditions.

## Next steps
- Add configurable missing-input detection thresholds.
- Add Mission Control notification queue endpoint/panel.
