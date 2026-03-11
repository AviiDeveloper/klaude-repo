# 2026-02-27 028 V1 Voice Call Session Loop

## Date and sequence
- Date: 2026-02-27
- Sequence: 028

## Milestone mapping
- Voice mode implementation track (SPEC milestone 4 alignment)
- OpenClaw interface layer call-control wiring

## Summary
- Added dedicated bridge endpoints for voice-call session lifecycle and transcript ingestion.
- Implemented `POST /calls/start` to create a voice session and emit `openclaw.session_started`.
- Implemented `POST /calls/:call_id/partial` to ingest streaming partial transcript events.
- Implemented `POST /calls/:call_id/final` to ingest final transcript events and return voice/text outbound responses.
- Implemented `POST /calls/:call_id/end` to close call session and emit `openclaw.session_ended`.
- Added bridge contract test for start -> partial -> final -> end voice call loop.

## Files changed
- `src/openclaw/bridgeServer.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- Dedicated call-loop HTTP route set under `/calls/*` in bridge runtime.

## Behavior changes
- Voice frontends can now integrate without constructing raw OpenClaw events manually.
- Call sessions can stream partial/final transcripts and immediately receive assistant outbound events.
- Bridge session state remains consistent between `/sessions/*` and `/calls/*` flows.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `/calls/*` route handling from bridge server.
2. Revert voice-call bridge contract test additions.
3. Revert README/task board/index metadata updates.
4. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: duplicate session controls across `/sessions/*` and `/calls/*` routes.
- Mitigation: both routes emit canonical OpenClaw events and use shared session tracking.
- Risk: malformed transcript payloads in live streams.
- Mitigation: route-level `call_id` and `text` validation with explicit 400 responses.

## Next steps
- Add barge-in/interrupt handling (`V1-002`).
- Add call reliability and reconnect/degraded handling (`V1-003`).
