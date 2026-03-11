# 2026-03-11 081 Learning Scorer Trust Gate And Webhook Delivery Policy

## Why
- Learning-driven delegation tuning could be misled by shallow/keyword-stuffed answers and lacked explicit confidence/trust gating.
- Platform webhook dispatch behavior needed stricter fail-closed policy guarantees for unsafe endpoints, signatures, idempotency, retries, and dead-letter outcomes.

## What Changed
- Hardened learning scorer (`EXP-010i`):
  - split scoring into `coverage_score` and `reasoning_score`
  - added contradiction/negation checks
  - added low-structure, keyword-stuffing, and shallow-restatement penalties
  - added per-answer `confidence`
  - require both subscore thresholds + confidence threshold for `grade=good`
- Added trust gate for learning-driven delegation tuning:
  - expose `tuning_enabled`, `trust_state`, `trust_reasons`, and `avg_confidence`
  - only apply learning-mode tuning when sample size/confidence/wrong-rate thresholds are met
- Added DB support for scorer confidence breakdown:
  - migration `011_learning_answers_confidence_breakdown`
  - schema columns: `coverage_score`, `reasoning_score`, `confidence`
- Hardened platform webhook dispatch policy (`EXP-004`):
  - enforce safe endpoint policy (https or localhost http)
  - enforce signed outbound delivery + signed acknowledgement validation
  - enforce idempotency-key acknowledgement matching
  - classify retryable vs deny/fail-closed outcomes
  - enforce retry/backoff/dead-letter behavior with structured reason codes
- Added regression protection:
  - adversarial red-team cases converted into hard assertions
  - API/contract verification now checks scorer confidence/trust-state outputs
  - new dispatch policy tests verify denial/retry/dead-letter reason-code behavior

## Validation
- `npm run typecheck` -> PASS
- `npm run mc:build` -> PASS (warnings only)
- `npm test` -> PASS (`46 passed, 0 failed`)
- `npm run mc:eval:verify` -> PASS
- `npm run mc:lead:learning:verify` -> PASS
- `npm run mc:learning:api:verify` -> PASS
- `npm run mc:self-improvement:redteam` -> PASS

## Files Touched
- `context/source-of-truth/TASK_BOARD.md`
- `apps/mission-control/src/lib/learning.ts`
- `apps/mission-control/src/lib/memory/packet.ts`
- `apps/mission-control/src/lib/types.ts`
- `apps/mission-control/src/lib/db/migrations.ts`
- `apps/mission-control/src/lib/db/schema.ts`
- `apps/mission-control/src/app/api/learning/questions/[id]/answer/route.ts`
- `apps/mission-control/scripts/self-improvement-redteam.ts`
- `apps/mission-control/scripts/learning-api-contract-verify.ts`
- `apps/mission-control/scripts/lead-learning-verify.ts`
- `src/pipeline/postDispatch.ts`
- `src/pipeline/engine.ts`
- `src/tests/pipelineDispatchPolicy.test.ts`
- `src/tests/missionControlApi.test.ts`

## Risks
- Webhook policy is stricter by design; integrations must return valid signed acknowledgements and matching idempotency keys or deliveries fail-closed/dead-letter.
- Existing non-blocking Next.js lint warnings remain and are outside this stabilization scope.
