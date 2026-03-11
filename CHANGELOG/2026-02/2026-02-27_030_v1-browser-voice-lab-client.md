# 2026-02-27 030 V1 Browser Voice Lab Client

## Date and sequence
- Date: 2026-02-27
- Sequence: 030

## Milestone mapping
- Voice mode implementation track (SPEC milestone 4)
- OpenClaw interface integration validation tooling

## Summary
- Added bridge-hosted browser page at `GET /voice-lab` for local voice interaction testing.
- Implemented mic input via Web Speech Recognition with partial and final transcript streaming to `/calls/*` endpoints.
- Implemented assistant playback via browser SpeechSynthesis for `system.voice_speak` outbound events.
- Added manual text fallback in the same page for browsers without speech recognition support.
- Added UI controls for call lifecycle (`start`, `interrupt`, `end`) and live event log.
- Added bridge contract test asserting `/voice-lab` route availability and expected wiring markers.

## Files changed
- `src/openclaw/bridgeServer.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- Bridge-hosted browser voice lab page (`/voice-lab`).

## Behavior changes
- You can now speak to the system locally in a browser without building a separate client app.
- Voice lab streams partial/final utterances into live call endpoints and plays returned voice responses.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `/voice-lab` route and page renderer from bridge server.
2. Revert bridge route test additions for voice-lab page.
3. Revert docs/task board/index metadata updates.
4. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: browser SpeechRecognition support is inconsistent.
- Mitigation: manual final-transcript text fallback is built into the page.
- Risk: local browser TTS voices differ by OS/device.
- Mitigation: voice lab is intended as integration test client, not production voice frontend.

## Next steps
- Add reconnect/retry handling for call transport interruptions.
- Add mission-control live call diagnostics panel.
