# Phone Calling Plan

## Objective
Enable the assistant to place real phone calls while using Mission Control and the existing call/task orchestration as the control plane.

## Scope
- Outbound phone calls to user devices (PSTN).
- Twilio as first telephony provider.
- Reuse existing bridge session lifecycle and task orchestration.

## Phase 1: Dial + Webhook Bootstrap (done)
1. Add outbound dial endpoint (`POST /telephony/call`) in bridge runtime. ✅
2. Add Twilio voice webhook (`POST /twilio/voice`) returning TwiML `<Connect><Stream>`. ✅
3. Add Twilio status webhook (`POST /twilio/status`) to close session state on terminal call outcomes. ✅
4. Keep all side-effect and notification rules unchanged. ✅

## Phase 2: Live Audio Transport (current)
1. Implement `/twilio/media` websocket stream handler. ✅
2. Add Twilio speech-gather conversation loop fallback (`/twilio/gather`) for immediate turn-based phone conversations. ✅
3. Map Twilio media frames to active call session and realtime voice pipeline.
4. Route assistant audio back to Twilio stream.
5. Preserve barge-in and idempotent turn retry behavior.

## Phase 3: Mission Control Integration (current)
1. Add outbound dial controls in Mission Control UI. ✅
2. Add active call state panel (session id, call sid, status, latency). ✅ (media diagnostics API wired)
3. Add transcript and notification correlation for phone sessions.

## Phase 4: Reliability and Security Hardening
1. Add retry strategy for Twilio API failures.
2. Add webhook signature validation for Twilio callbacks.
3. Add reconnect behavior for media stream interruptions.
4. Add operational runbook for failover/fallback to text-only.

## Required Environment
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TELEPHONY_PUBLIC_BASE_URL` (public HTTPS URL for Twilio webhooks)

## Success Criteria
1. System can place an outbound call to a configured phone number.
2. Twilio fetches voice webhook and receives valid TwiML stream instructions.
3. Session lifecycle is tracked in bridge state and transcripts.
4. Mission Control can observe call-related state and outcomes.
