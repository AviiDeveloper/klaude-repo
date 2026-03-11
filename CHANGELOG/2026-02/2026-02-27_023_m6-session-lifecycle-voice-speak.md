# 2026-02-27 023 M6 Session Lifecycle and Voice Speak

## Date and sequence
- Date: 2026-02-27
- Sequence: 023

## Milestone mapping
- Milestone 6: deployment/runtime integration hardening for real voice flows
- OPENCLAW reference: inbound session events and outbound voice behavior

## Summary
- Extended OpenClaw inbound adapter to accept `openclaw.session_started` and `openclaw.session_ended` events.
- Added outbound `system.voice_speak` event support for voice-first responses.
- Routed `voice_transcript_final` handling through normal message pipeline with optional voice output.
- Added bridge session orchestration endpoints (`POST /sessions/start`, `POST /sessions/end`, `GET /sessions`).
- Updated runtime logging path to support outbound voice events without assuming task ids.
- Added contract tests for session lifecycle and voice speak behavior.

## Files changed
- `src/openclaw/types.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/openclaw/bridgeServer.ts`
- `src/tests/adapterContract.test.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- Session registry within bridge runtime for active session visibility.
- Outbound `system.voice_speak` event payload contract.

## Behavior changes
- Session start/end can be explicitly driven through the bridge without direct OpenClaw SDK coupling.
- Final voice transcripts now produce both text output and voice speak output for assistant playback.
- Bridge can report active sessions, enabling downstream supervision and diagnostics.

## Tests or verification
- `npm run typecheck`
- `npm test`
- `INTERFACE_MODE=openclaw-bridge npm run dev`
- `POST /sessions/start`
- `POST /events` with `openclaw.voice_transcript_final`

## Rollback steps
1. Revert session event handlers and voice speak output wiring in `inboundAdapter.ts`.
2. Revert bridge session endpoints and in-memory session registry in `bridgeServer.ts`.
3. Revert index logging update for `system.voice_speak`.
4. Remove session/voice contract test additions.
5. Revert README/task board updates.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: session state drift between OpenClaw source and bridge memory.
- Mitigation: explicit start/end endpoints and listable session state for diagnostics.
- Risk: duplicate audio/text behavior in some clients.
- Mitigation: separate outbound event types (`message_send` vs `voice_speak`) so client can choose playback policy.

## Next steps
- Add transcript persistence stream for session timelines (voice partial/final plus assistant outputs).
- Connect mission-control scheduler paths to session-aware agent routing.
