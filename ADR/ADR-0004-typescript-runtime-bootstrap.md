# ADR-0004: TypeScript Single Runtime Bootstrap

Status: Accepted
Date: 2026-02-27

## Context
The MVP requires a single-node, debuggable system with one orchestrator and two agents.
The repository currently contains only spec/governance artifacts and no executable runtime.

## Decision
Bootstrap the implementation using a single TypeScript/Node.js runtime with:
- One orchestrator implementation
- Two local agents (Code Agent and Ops Agent)
- One in-memory event bus for MVP Milestone 1
- One in-memory task store abstraction to allow SQLite replacement later

## Consequences
Positive:
- Fast local development loop for Milestone 1
- Single runtime aligns with complexity constraints
- Clear interfaces for future persistence and approval gating

Negative:
- No durable persistence yet
- No real OpenClaw adapter yet

## Follow-up
- Milestone 2 introduces SQLite-backed store while keeping interface contracts stable.
