# 2026-02-27 003 M1 OpenClaw Message Adapter

## Milestone
Milestone 1: OpenClaw text loop

## Spec sections affected
- SPEC.md Section 3.1 (OpenClaw routes input into the system)
- SPEC.md Section 4.1 (OpenClaw Interface Layer)
- SPEC.md Section 9 Milestone 1

## Summary
Implemented inbound OpenClaw message handling for `openclaw.message_received`:
- Added OpenClaw event schema types and required field validation.
- Added a minimal caller model for intent parsing and acknowledgement.
- Added `OpenClawInboundAdapter` that creates tasks and triggers orchestrator execution.
- Added outbound `system.message_send` acknowledgements and completion message.
- Updated the runtime entrypoint to run through OpenClaw adapter flow.

## Verification
- `npm run typecheck`
- `npm run build`
- `npm run dev`

## Rollback
1. Remove `src/openclaw/*` and `src/caller/*`.
2. Restore previous `src/index.ts`.
3. Revert TASK_BOARD update.
4. Remove this changelog md/json pair.

## Next steps
- Implement `openclaw.approval_decision` handling to unblock side-effect steps.
- Add trace persistence aligned to `GOVERNANCE/TRACE_SCHEMA.md`.
- Add tests for inbound adapter event validation and flow.
