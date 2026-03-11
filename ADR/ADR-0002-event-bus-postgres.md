# ADR-0002: Use Postgres Job Table as Queue (MVP)

## Status
Proposed

## Context
MVP needs a queue for agent dispatch and event logging. Must be inspectable and simple.

## Options Considered
1. Postgres job table
2. Redis queue
3. In-memory queue

## Decision
Proposed: Postgres job table.

## Rationale
Single dependency for state and queue. Easier audit and debugging.

## Consequences
- Higher latency than Redis in some cases
- Requires careful locking strategy
