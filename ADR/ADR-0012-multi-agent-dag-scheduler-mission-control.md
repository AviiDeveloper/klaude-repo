# ADR-0012 Multi-Agent DAG Scheduler in Mission Control

## Status
Accepted

## Date
2026-03-02

## Context
Mission Control needed to evolve from task list operations into a control plane for recurring, multi-agent content workflows with dependency-aware execution and operational visibility.

## Decision
Introduce a SQLite-backed multi-agent DAG scheduler/runtime integrated with Mission Control APIs.

Key decisions:
- Represent workflow as pipeline definitions with node dependencies and retry policy.
- Execute runs via an 8-agent topology with deterministic typed node contracts.
- Enforce paid-node approval token gates and budget caps before side-effect steps.
- Queue publishing actions for approval before dispatch.
- Use pluggable webhook adapters for platform dispatch in v1.
- Keep deployment single-node and TypeScript-native.

## Consequences
Positive:
- Mission Control now supports recurring DAG runs, run graphs, retry/override controls, and queue dispatch workflows.
- Pipeline state is persisted and auditable in SQLite.
- Budget and approval gates are enforced before paid operations.

Tradeoffs:
- Webhook adapters are an integration layer, not native platform OAuth publishing.
- Full realtime telephony media-to-model bridge remains a separate follow-on.

## Alternatives considered
1. Keep linear job chain only.
   - Rejected due to inability to model parallel/dependent specialist agents.
2. Event-driven free routing with no explicit graph.
   - Rejected to keep behavior deterministic and inspectable.
3. External scheduler service.
   - Rejected to preserve single-node simplicity and local operability.
