# 2026-02-27 010 M3 Approval Resolved Flow

## Date and sequence
- Date: 2026-02-27
- Sequence: 010

## Milestone mapping
- Milestone 3: approval gating
- SPEC references: Section 8.2 (approval required), Section 8.3 (notify/callback), Section 9 (Milestone 3)
- OpenClaw mapping: inbound `openclaw.approval_decision`, outbound `system.message_send`

## Summary
- Added approval resolution path in orchestrator with approve/deny branching.
- Approve path now resumes task execution with approval token context.
- Deny path now blocks task, emits `notify.requested`, and finalizes trace as `blocked`.
- Added trace timeline logging for `approval.resolved` and deny notifications.
- Added OpenClaw adapter handling for inbound `openclaw.approval_decision` payloads.
- Added Mission Control API endpoint (`POST /api/approvals`) for local approval decisions.
- Added contract tests for approval decision approved/denied behavior.

## Files changed
- `src/agents/codeAgent.ts`
- `src/orchestrator/orchestrator.ts`
- `src/interface/controller.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/missionControl/server.ts`
- `src/tests/adapterContract.test.ts`
- `src/tests/approvalResolvedContract.test.ts`
- `TASK_BOARD.md`

## New components
- `approvalResolvedContract.test.ts` covering approve and deny decision outcomes.

## Behavior changes
- Inbound approval decisions now actively change task state.
- Approved tasks resume and can reach `completed`.
- Denied tasks transition to `blocked` with notify signal and immutable blocked trace.

## Tests or verification
- `npm run typecheck`
- `npm test`
- `INTERFACE_MODE=openclaw npm run dev`

## Rollback steps
1. Revert `resolveApprovalDecision` and approval-token resume flow in orchestrator.
2. Revert interface controller and OpenClaw adapter approval decision handling.
3. Remove Mission Control `/api/approvals` endpoint.
4. Remove approval resolved tests and task board update.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: resumed execution currently restarts the plan loop.
- Mitigation: approval token prevents re-request loop for the same gated step; next iteration can add precise step checkpoints.
- Risk: deny path leaves task blocked without automated external notification transport.
- Mitigation: `notify.requested` event and trace entry are emitted for adapter delivery.

## Next steps
- Implement `M3-003` strict side-effect token enforcement at execution points.
- Add explicit approval record persistence (requested/resolved metadata).
- Begin Milestone 4 voice transcript event flow after approval gate hardening.
