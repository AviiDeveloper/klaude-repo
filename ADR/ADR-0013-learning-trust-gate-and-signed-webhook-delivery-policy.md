# ADR-0013 Learning Trust Gate And Signed Webhook Delivery Policy

## Status
Accepted

## Date
2026-03-11

## Context
Two stability risks were identified:
- Learning-driven delegation tuning could react to low-quality answers (keyword stuffing, shallow restatement, contradiction) without explicit trust gating.
- Platform webhook delivery lacked strict fail-closed guarantees for endpoint safety, signed acknowledgement, idempotency confirmation, and policy reason-code reporting.

## Decision
1. Learning trust policy
- Split answer scoring into independent `coverage_score` and `reasoning_score` plus explicit `confidence`.
- Apply contradiction, low-structure, keyword-stuffing, and shallow-restatement penalties.
- Require both subscore and confidence thresholds for `grade=good`.
- Gate learning-driven delegation tuning behind trust requirements (sample size, average confidence, wrong-rate).
- Expose trust state (`tuning_enabled`, `trust_state`, `trust_reasons`) for operator visibility and contract verification.

2. Webhook delivery policy
- Enforce safe endpoint policy (https or localhost http only).
- Require signed outbound webhook requests and signed acknowledgements.
- Require idempotency key acknowledgement consistency.
- Classify outcomes with structured reason codes and retryability.
- Enforce retry/backoff and dead-letter behavior, fail-closed on invalid/unsafe deliveries.

## Consequences
Positive:
- Delegation tuning now uses trusted learning signals only.
- Webhook dispatch behavior is deterministic, auditable, and safer under integration faults.
- Contract/regression tests now permanently cover adversarial scorer cases and dispatch reason-code behavior.

Tradeoffs:
- Webhook integrations must implement acknowledgement signing and idempotency echo requirements.
- Strict fail-closed policy can increase dead-letter rates for non-compliant integrations until adapters are aligned.

## Alternatives Considered
1. Keep single score without confidence/trust gating.
- Rejected due to susceptibility to superficial keyword-matching and noisy tuning behavior.

2. Keep webhook policy permissive (best-effort without signed ack/idempotency validation).
- Rejected due to replay/ambiguity risk and weak operational auditability.
