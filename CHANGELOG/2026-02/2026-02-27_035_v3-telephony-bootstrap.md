# 2026-02-27 035 V3 Telephony Bootstrap

## Date and sequence
- Date: 2026-02-27
- Sequence: 035

## Milestone mapping
- Voice mode expansion (PSTN telephony bootstrap)
- Mission Control operational expansion (phone-call control plane prep)

## Summary
- Added a telephony plan doc to define phased delivery from dial bootstrap through live media transport.
- Added a Twilio dialer abstraction and implementation for outbound PSTN call initiation.
- Added bridge runtime endpoint `POST /telephony/call` to create a voice session and place an outbound call.
- Added Twilio webhook handlers `POST /twilio/voice` and `POST /twilio/status` for TwiML stream setup and terminal lifecycle closure.
- Wired telephony dialer and public webhook base URL configuration in `index.ts`.
- Added bridge tests for telephony success path and unavailable dialer (`503`) behavior.
- Added ADR documenting telephony outbound bootstrap decision and contract boundary.
- Updated task board and README to reflect telephony bootstrap capability and required environment variables.

## Files changed
- `OPERATIONS/PHONE_CALLING_PLAN.md`
- `src/telephony/twilioDialer.ts`
- `src/openclaw/bridgeServer.ts`
- `src/index.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `README.md`
- `TASK_BOARD.md`
- `ADR/ADR-0009-telephony-outbound-bootstrap.md`

## New components
- Telephony dialer abstraction and Twilio implementation.
- Bridge telephony endpoints for call start and Twilio callbacks.

## Behavior changes
- Bridge can now initiate outbound PSTN calls when Twilio credentials and webhook base URL are configured.
- Bridge returns TwiML stream instructions to Twilio voice webhook.
- Bridge closes active session/call state on terminal Twilio call statuses.
- Bridge returns explicit `503` for telephony call attempts when telephony is not configured.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove telephony dialer implementation and bridge telephony endpoints.
2. Remove telephony wiring from runtime bootstrap (`index.ts`).
3. Revert bridge telephony tests.
4. Revert README, task board, and ADR updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: webhook URL misconfiguration causes Twilio callback failures.
- Mitigation: explicit `TELEPHONY_PUBLIC_BASE_URL` requirement documented and enforced at runtime.
- Risk: unauthenticated webhook callbacks in early bootstrap.
- Mitigation: Phase 4 includes Twilio signature validation hardening.
- Risk: no live audio transport yet.
- Mitigation: Phase 2 `/twilio/media` stream bridge is now tracked as active next implementation.

## Next steps
- Implement `/twilio/media` websocket handler and realtime audio bridge.
- Add Mission Control dial controls and active call state panel.
- Add Twilio webhook signature validation.
