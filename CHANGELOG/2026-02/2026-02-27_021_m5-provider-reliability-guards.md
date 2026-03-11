# 2026-02-27 021 M5 Provider Reliability Guards

## Date and sequence
- Date: 2026-02-27
- Sequence: 021

## Milestone mapping
- Milestone 5: model-provider reliability hardening
- SPEC references: Section 10 (model usage policy), reliability goals

## Summary
- Added provider request timeout handling via abort controller.
- Added bounded retry logic with simple backoff for transient provider failures.
- Added fallback-to-local behavior for caller and agent outputs when provider calls fail.
- Added env-based reliability controls for OpenAI/OpenRouter provider modes:
  - `MODEL_TIMEOUT_MS`
  - `MODEL_MAX_RETRIES`
  - `MODEL_FALLBACK_TO_LOCAL`
- Added tests for retry success, timeout fallback success, and timeout hard-fail when fallback disabled.

## Files changed
- `src/models/provider.ts`
- `src/tests/openaiCallerProvider.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- No new top-level component; expanded provider reliability behavior.

## Behavior changes
- Provider-backed caller/agent calls are now guarded against hangs/transient failures.
- System can fail-open to local heuristic outputs (when fallback enabled) to preserve responsiveness.
- System can fail-closed for provider issues (when fallback disabled).

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert timeout/retry/fallback logic in `src/models/provider.ts`.
2. Remove reliability env controls from provider creation path.
3. Remove reliability guard tests from `openaiCallerProvider.test.ts`.
4. Revert README/task board updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: fallback may hide provider quality issues.
- Mitigation: fallback is configurable; can be disabled for strict mode.
- Risk: aggressive timeout values may increase fallback frequency.
- Mitigation: timeout and retry counts are env-configurable.

## Next steps
- Implement `M6-001` OpenClaw bridge process for real Mac mini integration.
- Add provider-level observability counters for retries/timeouts/fallbacks.
