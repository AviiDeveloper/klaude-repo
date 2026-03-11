# Risk Register

## Latency explosion
Cause: multi-hop inference, slow tool calls
Mitigation: two-phase responses, caching, strict latency budget

## Hallucinated actions
Cause: agents proposing unapproved side effects
Mitigation: approval token gating, explicit side effect lists, trace enforcement

## State drift
Cause: schema changes without governance
Mitigation: ADR requirement, change control policy, contract tests

## OpenClaw dependency risk
Cause: interface outage breaks approvals or notifications
Mitigation: queued notifications, fail-closed for side effects, health checks
