# 2026-02-27 016 M5 OpenAI Caller Provider

## Date and sequence
- Date: 2026-02-27
- Sequence: 016

## Milestone mapping
- Milestone 5: model-provider integration
- SPEC references: Section 10 (Caller Model usage policy)

## Summary
- Upgraded `ModelProvider` contract to async to support network model calls.
- Added `OpenAICallerModelProvider` for caller-intent generation.
- Added `MODEL_PROVIDER=openai` mode in provider factory.
- Added strict env guard requiring `OPENAI_API_KEY` for openai mode.
- Kept agent outputs local for now (M5-003 covers OpenAI agent outputs).
- Updated caller and agent code paths to await provider methods.
- Added tests for OpenAI provider guard and JSON response parsing.

## Files changed
- `src/models/provider.ts`
- `src/caller/callerModel.ts`
- `src/interface/controller.ts`
- `src/agents/codeAgent.ts`
- `src/agents/opsAgent.ts`
- `src/tests/modelProviderContract.test.ts`
- `src/tests/openaiCallerProvider.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `OpenAICallerModelProvider` backed by OpenAI chat completion API.

## Behavior changes
- Caller intent parsing can now be powered by OpenAI when enabled.
- Provider methods now run asynchronously across caller/agents.
- Runtime defaults remain unchanged (`MODEL_PROVIDER=local`).

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert async provider interface changes.
2. Remove `OpenAICallerModelProvider` and openai mode from factory.
3. Revert caller/agent await usage and test additions.
4. Revert README/task board updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: malformed model JSON outputs.
- Mitigation: explicit JSON parse + required field validation with hard errors.
- Risk: provider misconfiguration at startup.
- Mitigation: fail-fast env validation for openai mode.

## Next steps
- Implement `M5-003` OpenAI-backed code/ops agent provider outputs.
- Implement `M5-004` timeout/retry/fallback protections for provider calls.
- Add integration smoke test for live OpenAI caller mode (when key is available).
