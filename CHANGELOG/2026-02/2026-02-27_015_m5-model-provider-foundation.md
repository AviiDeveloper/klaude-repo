# 2026-02-27 015 M5 Model Provider Foundation

## Date and sequence
- Date: 2026-02-27
- Sequence: 015

## Milestone mapping
- Milestone 5: model integration foundation
- SPEC references: Section 10 (model usage policy), Section 4 (caller/orchestrator/agents separation)

## Summary
- Added `ModelProvider` abstraction with caller-intent and agent-output interfaces.
- Added default `LocalHeuristicModelProvider` implementation.
- Added `createModelProvider()` factory with `MODEL_PROVIDER` env-based selection.
- Injected provider into `CallerModel`, `CodeAgent`, and `OpsAgent`.
- Updated runtime wiring to share one provider instance across caller and agents.
- Added contract test verifying injected provider outputs are used by caller and agents.

## Files changed
- `src/models/provider.ts`
- `src/caller/callerModel.ts`
- `src/agents/codeAgent.ts`
- `src/agents/opsAgent.ts`
- `src/index.ts`
- `src/tests/modelProviderContract.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `ModelProvider` foundation for pluggable AI model backends.

## Behavior changes
- Caller and agent text outputs now flow through provider abstraction.
- Runtime still uses local deterministic behavior by default (`MODEL_PROVIDER=local`).

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `src/models/provider.ts`.
2. Revert provider injection changes in caller/agents/index.
3. Remove `modelProviderContract.test.ts`.
4. Revert README and task board updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: unsupported provider mode misconfiguration.
- Mitigation: factory fails fast with explicit supported modes list.
- Risk: provider-induced output drift in agent/caller behavior.
- Mitigation: injection contract test ensures deterministic provider wiring path.

## Next steps
- Implement `M5-002` OpenAI-backed `CallerModel` provider adapter.
- Implement `M5-003` OpenAI-backed Code/Ops agent provider adapter.
- Add provider timeout/retry/fallback controls (`M5-004`).
