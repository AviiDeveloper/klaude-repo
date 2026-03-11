# 2026-02-27 019 M5 OpenRouter Native Mode

## Date and sequence
- Date: 2026-02-27
- Sequence: 019

## Milestone mapping
- Milestone 5: model-provider integration
- SPEC references: Section 10 (model usage policy)

## Summary
- Added native `MODEL_PROVIDER=openrouter` mode in provider factory.
- Added OpenRouter-specific defaults (`https://openrouter.ai/api/v1`) and model env fallback.
- Added OpenRouter compatibility headers (`HTTP-Referer`, `X-Title`) support.
- Added env guard requiring OpenRouter or OpenAI API key when using openrouter mode.
- Added tests for openrouter mode guard and header forwarding behavior.

## Files changed
- `src/models/provider.ts`
- `src/tests/openaiCallerProvider.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- No new top-level component; expanded existing provider factory capabilities.

## Behavior changes
- Runtime now supports explicit OpenRouter mode without manual URL patching.
- OpenRouter mode uses dedicated env vars while preserving OpenAI-compatible request format.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert openrouter mode branch in provider factory.
2. Revert extra OpenRouter headers support.
3. Remove openrouter mode tests.
4. Revert README/task board updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: model-specific incompatibilities with strict JSON outputs.
- Mitigation: strict output validation; fallback/retry policy planned in `M5-004`.
- Risk: missing app/site headers for provider analytics.
- Mitigation: default header values plus env override options.

## Next steps
- Implement `M5-004` timeout/retry/fallback policy for provider calls.
- Run live OpenRouter smoke test with your API credits.
