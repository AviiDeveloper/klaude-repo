# 2026-02-27 006 M1 Contract Tests

## Date and sequence
- Date: 2026-02-27
- Sequence: 006

## Milestone mapping
- Milestone 1: OpenClaw text loop foundation
- SPEC references: Section 3 (audit trail), Section 4 (interface/orchestrator), Section 9 (Milestone 1)

## Summary
- Added adapter contract tests for OpenClaw message ingestion success path.
- Added adapter contract test for invalid payload rejection (`message_received` requires `text`).
- Added orchestrator failure-path contract test validating trace finalization with `failed` state.
- Updated existing trace persistence test to isolate trace directories per test run.
- Updated task board to mark `M1-003` complete.

## Files changed
- `src/tests/adapterContract.test.ts`
- `src/tests/orchestratorFailureContract.test.ts`
- `src/tests/tracePersistence.test.ts`
- `TASK_BOARD.md`

## New components
- Test contract coverage for interface adapter behavior and orchestrator failure semantics.

## Behavior changes
- No runtime behavior changed; this step increases confidence and regression protection.

## Tests or verification
- `npm run typecheck`
- `npm run build`
- `npm test`

## Rollback steps
1. Remove new test files `adapterContract.test.ts` and `orchestratorFailureContract.test.ts`.
2. Revert `tracePersistence.test.ts` directory isolation change.
3. Revert task board update.
4. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: contract drift between adapter/orchestrator implementations.
- Mitigation: tests now codify expected behavior for message mapping and failure trace semantics.

## Next steps
- Start Milestone 2 with SQLite-backed persistence adapters.
- Add Mission Control minimal task/trace status surface.
- Begin Milestone 3 approval gating event flow once M2 base is stable.
