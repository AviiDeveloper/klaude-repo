# 2026-02-27 005 M1 Trace Persistence

## Date and sequence
- Date: 2026-02-27
- Sequence: 005

## Milestone mapping
- Milestone 1: OpenClaw text loop foundation
- SPEC references: Section 3 (audit trail), Section 4 (orchestrator), Section 9 (Milestone 1)

## Summary
- Added trace record types aligned to `GOVERNANCE/TRACE_SCHEMA.md`.
- Added file-backed trace store that creates immutable per-task snapshots.
- Added timeline event logging for `task.created`, `plan.generated`, `agent.requested`, `agent.completed`, and `error`.
- Wired orchestrator to finalize trace on success/failure with final task state.
- Added baseline automated test validating required trace fields and key event coverage.

## Files changed
- `src/trace/types.ts`
- `src/trace/traceStore.ts`
- `src/orchestrator/orchestrator.ts`
- `src/index.ts`
- `src/tests/tracePersistence.test.ts`
- `package.json`
- `TASK_BOARD.md`

## New components
- `FileTraceStore` for append-style event log plus immutable final trace snapshot.
- Trace type contracts for timeline, approvals, side effects, and full execution trace.

## Behavior changes
- Every created task now initializes a trace record.
- Orchestrator execution now appends timeline events throughout dispatch/execution.
- Completed/failed tasks now write a finalized immutable trace file in `traces/`.

## Tests or verification
- `npm run typecheck`
- `npm run build`
- `npm run dev`
- `npm test`

## Rollback steps
1. Remove `src/trace/` and `src/tests/tracePersistence.test.ts`.
2. Revert orchestrator trace integration in `src/orchestrator/orchestrator.ts`.
3. Revert trace wiring in `src/index.ts` and test script in `package.json`.
4. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: trace file growth over time.
- Mitigation: using per-task files keeps data isolated and easy to archive/prune.
- Risk: finalize write failure could lose end-state visibility.
- Mitigation: execution marks task failed and writes error timeline entry before rethrowing.

## Next steps
- Add contract tests for adapter/orchestrator interactions (`M1-003`).
- Add approval event logging records (`approval.requested`, `approval.resolved`).
- Replace file-backed store with SQLite-backed persistence in Milestone 2.
