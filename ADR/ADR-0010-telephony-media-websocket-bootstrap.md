# ADR-0010 Telephony Media WebSocket Bootstrap

## Status
Accepted

## Date
2026-02-28

## Context
Outbound call bootstrap is complete, but Twilio media streams need a websocket target to keep calls connected and observable while realtime audio routing is being built.

## Decision
Add bridge websocket handling for `GET /twilio/media` (upgrade path) and a debugging/status API `GET /telephony/media/sessions`.

Behavior in this phase:
- Accept Twilio websocket upgrades for media stream sessions.
- Parse Twilio `start`, `media`, and `stop` events.
- Track per-session stream metadata (call sid, stream sid, frame count, byte count, connection state).
- Do not yet perform realtime transcription or assistant-audio return on this path.

Use `ws` package for server-side websocket support under Node.

## Consequences
Positive:
- Twilio stream target now exists and can be validated in integration tests.
- Operators can inspect live/disconnected stream sessions via API.
- Provides stable base for next phase realtime audio bridge.

Tradeoffs:
- Media frames are observed but not yet mapped into conversational realtime pipeline.
- Adds new dependency (`ws`) and type package.

## Alternatives considered
1. Delay websocket handler until full realtime bridge is ready.
   - Rejected; prevented incremental testing of Twilio media attachment.
2. Implement custom websocket framing over raw `upgrade` socket.
   - Rejected due to avoidable complexity and higher protocol risk.
3. Add Mission Control dial UI first.
   - Deferred; media path readiness is prerequisite for practical phone session behavior.
