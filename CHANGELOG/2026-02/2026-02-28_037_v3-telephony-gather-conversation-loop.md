# 2026-02-28 037 V3 Telephony Gather Conversation Loop

## Date and sequence
- Date: 2026-02-28
- Sequence: 037

## Milestone mapping
- Voice mode expansion (phone conversation usability)
- Telephony integration progression before full realtime audio bridge

## Summary
- Added configurable telephony conversation mode (`gather` or `stream`) with `gather` default.
- Updated `POST /twilio/voice` to initialize telephony sessions and return gather TwiML when in gather mode.
- Added `POST /twilio/gather` webhook that accepts Twilio speech transcripts and routes turns through existing voice final event flow.
- Added TwiML loop generation (`<Say>` + next `<Gather>`) to hold ongoing turn-based phone conversation.
- Added user-ended call phrase detection (`bye`, `goodbye`, `hang up`, `stop call`) with session close and TwiML `<Hangup/>`.
- Added tests validating gather conversation loop while preserving stream-mode behavior.
- Wired `TELEPHONY_CONVERSATION_MODE` environment setting in runtime bootstrap.
- Updated phone plan, task board, README, and ADRs for the new conversation capability and remaining realtime gap.

## Files changed
- `src/openclaw/bridgeServer.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `OPERATIONS/PHONE_CALLING_PLAN.md`
- `TASK_BOARD.md`
- `README.md`
- `ADR/ADR-0011-telephony-gather-conversation-fallback.md`

## New components
- Twilio gather conversation webhook handler (`POST /twilio/gather`).
- Telephony conversation mode switch (`gather`/`stream`).

## Behavior changes
- Outbound phone calls can now run a turn-based speech conversation over Twilio without full realtime media-audio bridging.
- `/twilio/voice` now defaults to gather conversation mode unless explicitly set to stream mode.
- Phone call session state is initialized consistently for Twilio webhooks.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `/twilio/gather` route and gather TwiML helper logic.
2. Revert `/twilio/voice` gather-mode branching.
3. Remove telephony conversation mode env wiring in `src/index.ts`.
4. Revert gather conversation tests.
5. Revert plan/task board/README/ADR updates.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: gather loop is not full-duplex realtime audio.
- Mitigation: keep `stream` mode available and track V3-004 realtime bridge as next step.
- Risk: false user-end phrase detection.
- Mitigation: only explicit phrase matches trigger hangup.

## Next steps
- Implement V3-004: realtime audio bridge from Twilio media frames to model audio output.
- Implement V3-003: Mission Control dial controls and active call panel.
- Add Twilio webhook signature validation.
