# ADR-0011 Telephony Gather Conversation Fallback

## Status
Accepted

## Date
2026-02-28

## Context
Phone calls could be dialed and media streams could attach, but full realtime audio bridge (Twilio media <-> model audio) is still in progress. A practical conversation path is needed now for live phone testing.

## Decision
Add a Twilio speech-gather fallback loop:
- `POST /twilio/voice` uses gather mode by default.
- `POST /twilio/gather` accepts speech transcripts from Twilio, routes them through `openclaw.voice_transcript_final`, and returns assistant speech via TwiML `<Say>` + next `<Gather>`.
- Add runtime switch `TELEPHONY_CONVERSATION_MODE` (`gather` default, `stream` optional).

## Consequences
Positive:
- Calls can hold turn-based conversations immediately.
- Reuses existing orchestrator, approvals, notifications, and transcript path.
- No dependency on full duplex realtime audio bridge for baseline phone usability.

Tradeoffs:
- Not low-latency full duplex; this is turn-based.
- Twilio speech recognition quality/latency depends on Twilio gather behavior.

## Alternatives considered
1. Wait for full realtime media bridge before phone conversation support.
   - Rejected for delivery speed and testability.
2. Keep stream-only voice webhook.
   - Rejected because stream path alone does not produce usable conversation yet.
3. Build custom STT/TTS bridge first.
   - Deferred to V3-004 while gather loop provides immediate value.
