# ADR-0005: SQLite-backed Persistence for Milestone 2

## Status
Accepted

## Date
2026-02-27

## Context
Milestone 2 requires durable local persistence beyond in-memory stores.
The runtime now needs persisted task state and execution traces that survive restarts, while remaining single-node and easy to inspect.

## Options Considered
1. Keep in-memory + file JSON persistence
2. SQLite-backed persistence
3. Postgres-backed persistence now

## Decision
Adopt SQLite-backed task and trace persistence for Milestone 2 baseline.

## Rationale
- Fits single-node MVP and constraints.
- Zero external service dependency for local development.
- Strong inspectability and deterministic local behavior.
- Preserves portability to future Postgres queue/storage path when required.

## Consequences
Positive:
- Durable task and trace data in one local DB file.
- Runtime can be built/tested on machines without external infra.

Negative:
- Limited concurrency/scaling compared with external DB.
- Native addon dependency (`better-sqlite3`) must be supported on target machines.

## Follow-up
- Keep store interfaces stable for future backend swaps.
- Add migration strategy when moving from SQLite to Postgres-backed production topology.
