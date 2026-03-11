# ADR-0009 Telephony Outbound Bootstrap

## Status
Accepted

## Date
2026-02-27

## Context
Project direction requires the assistant to call the user’s phone while keeping Mission Control and existing bridge orchestration as the source of truth. This adds a telephony interface contract at the bridge boundary.

## Decision
Introduce initial Twilio telephony bootstrap endpoints in bridge mode:
- `POST /telephony/call` for outbound call creation.
- `POST /twilio/voice` webhook returning TwiML stream instructions.
- `POST /twilio/status` webhook for terminal call state handling.

Use a provider abstraction (`TelephonyDialer`) with first implementation `TwilioTelephonyDialer`, built with standard HTTP `fetch` (no additional dependency).

## Consequences
Positive:
- Enables immediate outbound call capability.
- Maintains provider abstraction for future telephony backends.
- Avoids adding package dependency for first pass.

Tradeoffs:
- Twilio media websocket path remains a follow-on phase.
- Webhook signature validation is still pending hardening work.

## Alternatives considered
1. Implement full Twilio media stream first.
   - Rejected for scope and iteration speed.
2. Integrate SIP provider directly before outbound bootstrap.
   - Rejected to keep path to first phone call shortest.
3. Add Twilio SDK dependency now.
   - Rejected; HTTP API is sufficient for current phase.
