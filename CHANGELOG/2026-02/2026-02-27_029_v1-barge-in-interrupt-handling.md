# 2026-02-27 029 V1 Barge-In Interrupt Handling

## Date and sequence
- Date: 2026-02-27
- Sequence: 029

## Milestone mapping
- Voice mode implementation track (SPEC milestone 4)
- PERFORMANCE reference: avoid awkward stale responses during live voice interaction

## Summary
- Added per-call turn state tracking in bridge runtime.
- Added stale turn suppression when a newer utterance interrupts an in-flight final turn.
- Added explicit `POST /calls/:call_id/interrupt` endpoint to support telephony barge-in signals.
- Updated `/calls/:call_id/final` responses to include `turn_id` and `interrupted` flags.
- Updated partial transcript handling to mark currently processing turn as interrupted.
- Added contract test for concurrent barge-in scenario to ensure interrupted turn output is suppressed.

## Files changed
- `src/openclaw/bridgeServer.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- In-memory per-call turn state (`nextTurn`, `processingTurn`, interrupted turn set).

## Behavior changes
- When a new utterance arrives during an in-flight voice turn, older turn outbound events are dropped.
- Voice integrators can explicitly trigger interruption via dedicated endpoint.
- Final-turn responses now indicate whether output was interrupted/suppressed.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove call turn state tracking and interruption logic from bridge server.
2. Remove `/calls/:call_id/interrupt` endpoint and turn metadata responses.
3. Revert bridge barge-in test additions.
4. Revert docs/task board/index metadata updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: dropped outputs may hide useful assistant details.
- Mitigation: suppression only applies to turns marked interrupted by newer user speech.
- Risk: call-state memory growth.
- Mitigation: call state is removed on `/calls/:call_id/end`.

## Next steps
- Add call reconnect and retry semantics for transport interruptions.
- Add degraded text-fallback mode when voice stream health drops.
