# 2026-02-27 032 V1 Call Idempotent Retries

## Date and sequence
- Date: 2026-02-27
- Sequence: 032

## Milestone mapping
- Voice mode reliability track
- RELIABILITY reference: network/transport interruptions should not duplicate unsafe behavior

## Summary
- Added idempotent retry handling for `POST /calls/:call_id/final` using optional `client_turn_id`.
- Added per-call final-turn response cache with bounded size to safely return prior response on retry.
- Added `retry` flag in final-turn response payload to indicate cached replay.
- Updated browser voice-lab client to attach generated `client_turn_id` values for each final turn.
- Added contract test verifying repeated final request with same `client_turn_id` returns cached response (same `turn_id`, identical outbound).

## Files changed
- `src/openclaw/bridgeServer.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `src/index.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- In-memory per-call final-turn retry cache keyed by client-supplied turn id.

## Behavior changes
- Retries caused by client/network interruption no longer duplicate final-turn orchestration.
- Bridge returns deterministic replay for same `client_turn_id` rather than creating a new turn.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `client_turn_id` handling and retry cache from bridge final-turn path.
2. Revert voice-lab client `client_turn_id` generation.
3. Remove retry contract test.
4. Revert README/task board/index metadata updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: cache memory growth.
- Mitigation: bounded per-call cache size with oldest-entry eviction.
- Risk: stale replay if client mistakenly reuses turn ids.
- Mitigation: `client_turn_id` is optional and should be unique per user final utterance.

## Next steps
- Add explicit call state endpoint for reconnect clients (`/calls/:call_id/state`).
- Add persisted retry cache option if process restarts during active calls.
