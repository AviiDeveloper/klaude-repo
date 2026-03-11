# 2026-02-27 007 M2 SQLite Persistence

## Date and sequence
- Date: 2026-02-27
- Sequence: 007

## Milestone mapping
- Milestone 2: durable persistence baseline
- SPEC references: Section 4 (Storage), Section 6 (Task system), Section 9 (Milestone 2)

## Summary
- Introduced `TaskStore` abstraction and added `SQLiteTaskStore` implementation.
- Introduced `TraceStore` abstraction and added `SQLiteTraceStore` implementation.
- Switched runtime default from in-memory/file stores to SQLite-backed stores.
- Added SQLite persistence contract test covering orchestrator create/execute/reload.
- Added native dependency `better-sqlite3` plus TypeScript declarations.

## Files changed
- `src/storage/taskStore.ts`
- `src/storage/sqliteTaskStore.ts`
- `src/trace/traceStore.ts`
- `src/trace/sqliteTraceStore.ts`
- `src/orchestrator/orchestrator.ts`
- `src/index.ts`
- `src/tests/sqlitePersistence.test.ts`
- `package.json`
- `package-lock.json`
- `.gitignore`
- `TASK_BOARD.md`
- `ADR/ADR-0005-sqlite-persistence-m2.md`

## New components
- SQLite-backed task persistence (`SQLiteTaskStore`).
- SQLite-backed trace persistence (`SQLiteTraceStore`).
- Common store interfaces (`TaskStore`, `TraceStore`) for backend swappability.

## Behavior changes
- Runtime now persists tasks and traces in `data/mvp.sqlite` by default.
- DB path can be overridden with `DB_PATH` environment variable.
- Finalized traces are immutable at store level (no append/finalize after final state).

## Tests or verification
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npm run dev`

## Rollback steps
1. Revert runtime wiring in `src/index.ts` to in-memory/file stores.
2. Remove `sqliteTaskStore.ts` and `sqliteTraceStore.ts`.
3. Revert orchestrator dependency typing changes.
4. Remove SQLite test and dependency entries.
5. Remove ADR-0005 and this changelog pair.

## Risks and mitigations
- Risk: native module build issues on some hosts.
- Mitigation: dependency verified locally and typed checks/tests enforced in CI-style verify command.
- Risk: DB file accumulation in repo workspace.
- Mitigation: `data/` and `data-test/` ignored in `.gitignore`.

## Next steps
- Build M2-002 Mission Control minimal panel over SQLite-backed state.
- Add read APIs for task list/detail and trace inspection.
- Start M3 approval event flows after Mission Control baseline is in place.
