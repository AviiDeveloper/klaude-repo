# ADR-0008 Mission Control Realtime API

## Status
Accepted

## Date
2026-02-27

## Context
Realtime session bootstrap was added to bridge runtime (`/realtime/session`) but Mission Control lacked an equivalent control path. Operators need a single panel to request and inspect realtime session readiness without switching interfaces.

## Decision
Extend Mission Control API and UI with realtime bootstrap support:
- API route: `POST /api/realtime/session`
- Route uses shared `RealtimeSessionBroker` abstraction.
- If broker unavailable, return `503` with explicit configuration guidance.
- Mission Control web UI includes a "Create Realtime Mini Session" control and output pane.

## Consequences
Positive:
- Mission Control can operate as the single operational surface for realtime readiness checks.
- Reuses existing secure server-side session minting pattern.

Tradeoffs:
- Adds another API contract in Mission Control to maintain.
- UI now exposes session metadata that should be treated operationally, not as user-facing product UX.

## Alternatives considered
1. Keep realtime bootstrap only on bridge route.
   - Rejected: fragments operations and testing workflows.
2. Add mission-control proxy to bridge endpoint instead of shared broker.
   - Rejected: unnecessary coupling and extra hop.
