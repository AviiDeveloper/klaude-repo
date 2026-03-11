# 2026-02-27 014 M4 Progress Narration Loop

## Date and sequence
- Date: 2026-02-27
- Sequence: 014

## Milestone mapping
- Milestone 4: voice responsiveness
- SPEC references: Section 5.2 (no silence longer than 3 seconds), Section 9 (Milestone 4)

## Summary
- Added progress narration loop in `InterfaceController` while task execution is pending.
- Progress updates are emitted at 3-second intervals as `phase: progress` messages.
- Added controlled slow-path behavior in `CodeAgent` (keyword-triggered) to exercise long-running flow.
- Extended OpenClaw outbound payload phase typing to include `progress`.
- Added contract test verifying progress narration appears for slow execution.

## Files changed
- `src/interface/controller.ts`
- `src/agents/codeAgent.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/tests/adapterContract.test.ts`
- `TASK_BOARD.md`

## New components
- No new top-level components; this step extends existing response orchestration.

## Behavior changes
- Requests running longer than 3 seconds now include periodic progress narration messages.
- Outbound message phase now supports `ack`, `progress`, and `detail`.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert progress loop in `InterfaceController`.
2. Revert slow-path simulation in `CodeAgent`.
3. Revert `progress` phase typing in OpenClaw adapter.
4. Remove slow execution progress narration contract test.
5. Revert task board update.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: progress messages can be noisy for borderline durations.
- Mitigation: fixed 3-second cadence and phase-tagged messages allow downstream filtering.
- Risk: slow-path keyword simulation could be unintentionally triggered in tests.
- Mitigation: trigger terms are explicit (`slow|long running|heavy`) and isolated to stub agent behavior.

## Next steps
- Start `M5-001` model-provider integration foundation.
- Replace deterministic CallerModel with provider-backed implementation.
- Add agent model adapters while preserving current safety/approval boundaries.
