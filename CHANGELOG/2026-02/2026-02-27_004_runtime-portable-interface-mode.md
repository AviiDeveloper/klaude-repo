# 2026-02-27 004 Runtime Portable Interface Mode

## Milestone
Milestone 1: OpenClaw text loop foundation

## Spec sections affected
- SPEC.md Section 4.1 (OpenClaw Interface Layer)
- SPEC.md Section 9 Milestone 1
- OPERATIONS/DEPLOYMENT.md (openclaw-adapter interface boundary)

## Summary
Made runtime portable so development can run without OpenClaw installed on this machine:
- Added `InterfaceController` as the core interface boundary for message handling.
- Refactored `OpenClawInboundAdapter` into a transport mapper that calls the controller.
- Added local/mock adapter and default `INTERFACE_MODE=local` runtime path.
- Kept OpenClaw mode available via `INTERFACE_MODE=openclaw`.

## Verification
- `npm run typecheck`
- `npm run build`
- `npm run dev`
- `INTERFACE_MODE=openclaw npm run dev`

## Rollback
1. Remove `src/interface/controller.ts` and `src/mock/localAdapter.ts`.
2. Restore previous OpenClaw adapter and `src/index.ts` flow.
3. Revert TASK_BOARD update.
4. Remove this changelog md/json pair.

## Next steps
- Implement real network bridge process for OpenClaw on Mac mini.
- Add trace persistence to keep cross-machine execution audit-compatible.
- Add tests for local/openclaw mode behavior.
