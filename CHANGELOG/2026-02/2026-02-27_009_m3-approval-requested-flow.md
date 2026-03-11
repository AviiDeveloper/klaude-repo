# 2026-02-27 009 M3 Approval Requested Flow

## Date and sequence
- Date: 2026-02-27
- Sequence: 009

## Milestone mapping
- Milestone 3: approval gating foundation
- SPEC references: Section 8.2 (approval required), Section 9 (Milestone 3)
- OpenClaw mapping: outbound `system.approval_request`

## Summary
- Added agent-side proposal path where risky objectives trigger `needs_approval` with side-effect proposals.
- Updated orchestrator to pause tasks in `awaiting_approval` when approval is required.
- Added trace timeline entry for `approval.requested` and bus event emission for approval payload.
- Updated interface controller response contract to include approval request payloads.
- Updated OpenClaw adapter to emit outbound `system.approval_request` events.
- Added contract tests for adapter approval emission and orchestrator approval state/trace behavior.

## Files changed
- `src/agents/codeAgent.ts`
- `src/orchestrator/orchestrator.ts`
- `src/interface/controller.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/mock/localAdapter.ts`
- `src/missionControl/server.ts`
- `src/index.ts`
- `src/tests/adapterContract.test.ts`
- `src/tests/approvalRequestedContract.test.ts`
- `TASK_BOARD.md`

## New components
- `approvalRequestedContract.test.ts` validating `awaiting_approval` + trace event behavior.

## Behavior changes
- Tasks requiring risky side effects now stop at `awaiting_approval`.
- Orchestrator publishes `approval.requested` with side effects, risks, rollback notes, decision options.
- OpenClaw outbound events can now include `system.approval_request`.

## Tests or verification
- `npm run typecheck`
- `npm test`
- `INTERFACE_MODE=openclaw npm run dev`

## Rollback steps
1. Revert approval logic in `codeAgent` and `orchestrator`.
2. Revert interface/controller and OpenClaw adapter approval payload changes.
3. Remove `approvalRequestedContract.test.ts` and adapter test additions.
4. Revert task board update.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: false-positive approval triggers.
- Mitigation: trigger is currently explicit keyword-based and covered by tests.
- Risk: pending tasks not resumed yet.
- Mitigation: this step intentionally stops at request emission; unblock flow is next (`M3-002`).

## Next steps
- Implement `M3-002` inbound `openclaw.approval_decision` handling.
- Implement `M3-003` approval token checks at execution point for side effects.
- Extend Mission Control to display/resolve pending approval requests.
