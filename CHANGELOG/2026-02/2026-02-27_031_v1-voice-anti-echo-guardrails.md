# 2026-02-27 031 V1 Voice Anti-Echo Guardrails

## Date and sequence
- Date: 2026-02-27
- Sequence: 031

## Milestone mapping
- Voice mode implementation track (SPEC milestone 4)
- Performance/reliability polish for live voice interaction

## Summary
- Removed automatic `system.voice_speak` emission on `openclaw.session_started` to prevent immediate startup speech loops.
- Updated browser voice-lab client to suppress TTS playback for progress-phase voice events.
- Updated browser voice-lab client to suppress TTS playback for session-start phrases.
- Added mic/TTS coordination in browser voice-lab: stop recognition while TTS is speaking and auto-resume afterward.
- Updated bridge tests to reflect no startup `voice_speak` on call/session start.

## Files changed
- `src/openclaw/inboundAdapter.ts`
- `src/openclaw/bridgeServer.ts`
- `src/tests/adapterContract.test.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `TASK_BOARD.md`

## New components
- None.

## Behavior changes
- Starting a call/session no longer causes automatic spoken output.
- Progress narration remains visible in logs/text events but is not spoken by browser voice-lab.
- Voice-lab microphone avoids capturing its own synthesized speech in most local-loop conditions.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Re-enable startup voice speak emission in inbound adapter session-start handler.
2. Revert voice-lab TTS filtering and mic pause/resume logic.
3. Revert updated test assertions for startup voice behavior.
4. Revert index/task-board metadata updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: reduced perceived responsiveness without startup greeting.
- Mitigation: startup still emits text message, preserving state confirmation without echo risk.
- Risk: browser recognition restart timing can vary.
- Mitigation: guarded restart logic only triggers if recognition was active before TTS.

## Next steps
- Add transport-level VAD/silence gating hooks for better turn boundary control.
- Add optional user setting to re-enable startup spoken greeting if desired.
