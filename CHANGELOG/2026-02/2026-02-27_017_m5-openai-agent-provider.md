# 2026-02-27 017 M5 OpenAI Agent Provider

## Date and sequence
- Date: 2026-02-27
- Sequence: 017

## Milestone mapping
- Milestone 5: model-provider integration
- SPEC references: Section 10 (agents and caller model usage policy)

## Summary
- Extended OpenAI provider to support `agentOutput` generation via OpenAI API.
- Refactored OpenAI provider internals to shared JSON request helper.
- Added structured validation for OpenAI agent outputs (`summary`, `logs`).
- Renamed provider class to `OpenAIModelProvider` to reflect caller+agent scope.
- Added tests for OpenAI agent output parsing behavior.

## Files changed
- `src/models/provider.ts`
- `src/tests/openaiCallerProvider.test.ts`
- `TASK_BOARD.md`

## New components
- No new top-level component; expanded existing OpenAI provider behavior.

## Behavior changes
- `MODEL_PROVIDER=openai` now affects both caller and non-gated agent textual outputs.
- Safety gating and approval token enforcement remain unchanged in orchestrator/agents.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert OpenAI provider agentOutput implementation to local fallback.
2. Revert shared OpenAI request helper changes.
3. Remove agent-output OpenAI parsing test.
4. Revert task board update.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: malformed agent JSON responses from model.
- Mitigation: strict field validation and explicit error throws.
- Risk: provider outages affecting caller and agent outputs.
- Mitigation: fallback/retry policy is next (`M5-004`).

## Next steps
- Implement `M5-004` provider timeout/retry/fallback policy.
- Build `M6-001` OpenClaw bridge process for Mac mini deployment.
- Continue expansion-track design docs for 8-agent scheduling pipelines.
