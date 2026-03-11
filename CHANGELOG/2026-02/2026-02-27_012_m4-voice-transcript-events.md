# 2026-02-27 012 M4 Voice Transcript Events

## Date and sequence
- Date: 2026-02-27
- Sequence: 012

## Milestone mapping
- Milestone 4: voice mode foundation
- SPEC references: Section 4.1 (STT/TTS optional), Section 5 (voice requirements), Section 9 (Milestone 4)
- OpenClaw mapping: inbound `voice_transcript_partial`, `voice_transcript_final`

## Summary
- Added payload schema types for voice partial and final transcript events.
- Added OpenClaw adapter handling for `openclaw.voice_transcript_partial`.
- Partial transcript now emits optional live-caption style message and does not create tasks.
- Added OpenClaw adapter handling for `openclaw.voice_transcript_final`.
- Final transcript now routes into standard task creation/execution flow.
- Added adapter contract tests for partial and final voice behavior.

## Files changed
- `src/openclaw/types.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/tests/adapterContract.test.ts`
- `TASK_BOARD.md`

## New components
- No new top-level components; this extends the existing OpenClaw adapter.

## Behavior changes
- Voice partial events produce lightweight outbound status text only.
- Voice final events now trigger full orchestration behavior equivalently to message input.

## Tests or verification
- `npm run typecheck`
- `npm test`
- `INTERFACE_MODE=openclaw npm run dev`

## Rollback steps
1. Revert voice payload types in `src/openclaw/types.ts`.
2. Revert voice event handling logic in `src/openclaw/inboundAdapter.ts`.
3. Remove voice transcript adapter contract tests.
4. Revert task board update.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: noisy partial transcript messages.
- Mitigation: currently text-only and optional; can be throttled in next iteration.
- Risk: final transcript duplicates in noisy streams.
- Mitigation: final-only triggers task path; partial does not create tasks.

## Next steps
- Implement `M4-002` two-phase timing and latency measurement instrumentation.
- Implement `M4-003` progress narration loop when processing exceeds 3 seconds.
- Start `M5-001` model-provider integration after voice timing layer is in place.
