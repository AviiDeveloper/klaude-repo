# ADR-0007 OpenAI Realtime Session Bootstrap

## Status
Accepted

## Date
2026-02-27

## Context
Voice-call runtime now supports local browser and bridge call loops, but Realtime model integration requires secure, short-lived client credentials issued server-side. Direct browser usage of long-lived `OPENAI_API_KEY` is not acceptable.

## Decision
Add a bridge-side Realtime session bootstrap interface:
- `POST /realtime/session`
- Implemented via `OpenAIRealtimeSessionBroker`.
- Controlled by runtime env:
  - `OPENAI_REALTIME_ENABLED=true`
  - `OPENAI_API_KEY` present
  - optional `OPENAI_REALTIME_MODEL` (default `gpt-realtime-mini`)

If unavailable, endpoint returns `503` with explicit configuration guidance.

## Consequences
Positive:
- Keeps API key server-side.
- Enables browser/edge clients to request short-lived Realtime session credentials.
- Connects Realtime transport to existing bridge runtime without replacing current `/calls/*` path.

Tradeoffs:
- Adds another bridge endpoint to maintain.
- Full WebRTC media path still requires follow-on implementation in client/runtime.

## Alternatives considered
1. Expose `OPENAI_API_KEY` directly in browser.
   - Rejected for security reasons.
2. Build full server-side media relay first.
   - Rejected for phase ordering; too large for initial secure bootstrap step.
3. Skip Realtime and rely only on current local speech APIs.
   - Rejected because project direction is explicit Realtime integration.
