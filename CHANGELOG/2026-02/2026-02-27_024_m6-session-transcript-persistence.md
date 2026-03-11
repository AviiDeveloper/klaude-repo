# 2026-02-27 024 M6 Session Transcript Persistence

## Date and sequence
- Date: 2026-02-27
- Sequence: 024

## Milestone mapping
- Milestone 6: deployment/runtime integration hardening for real voice usage
- OPENCLAW reference: context continuity and voice/text session observability

## Summary
- Added a SQLite-backed session transcript store for persistent conversation history.
- Persisted inbound OpenClaw events (message, voice partial/final, session start/end, approval decisions) into per-session transcript timeline.
- Persisted outbound assistant events (`system.message_send`, `system.voice_speak`) for full round-trip visibility.
- Added `GET /sessions/:session_id/transcript` endpoint in bridge mode.
- Extended session list state to include `active_task_id` and `changelog_change_id` for context continuity.

## Files changed
- `src/transcript/sessionTranscriptStore.ts`
- `src/transcript/sqliteSessionTranscriptStore.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/openclaw/bridgeServer.ts`
- `src/index.ts`
- `src/tests/openclawBridgeServer.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `SessionTranscriptStore` contract.
- `SQLiteSessionTranscriptStore` implementation using shared runtime DB.

## Behavior changes
- Bridge sessions now expose context continuity metadata in `GET /sessions`.
- Bridge can return chronological transcript entries per session.
- Voice session flows now have durable transcript data suitable for diagnostics and future mission-control UI wiring.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove transcript store files under `src/transcript`.
2. Revert transcript append logic in `src/openclaw/inboundAdapter.ts`.
3. Revert transcript/session-context changes in `src/openclaw/bridgeServer.ts`.
4. Revert index wiring, test updates, docs, and task board updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: transcript growth in long-running sessions.
- Mitigation: indexed per-session queries and SQLite persistence foundation for future pruning policy.
- Risk: duplicate semantic entries between text and voice outputs.
- Mitigation: each transcript row includes event type and kind so consumers can filter by channel.

## Next steps
- Expose transcript history in Mission Control API/UI.
- Add retention controls for transcript volume management.
