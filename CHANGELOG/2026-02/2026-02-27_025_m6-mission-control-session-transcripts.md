# 2026-02-27 025 M6 Mission Control Session Transcripts

## Date and sequence
- Date: 2026-02-27
- Sequence: 025

## Milestone mapping
- Milestone 6: runtime integration and inspection hardening
- SPEC reference: Mission Control minimal panel and OpenClaw voice/text context continuity

## Summary
- Added session listing capability to transcript storage contract and SQLite implementation.
- Added Mission Control API endpoints for session-level conversation inspection.
- Wired transcript storage into Mission Control runtime so APIs return persisted session history.
- Added Mission Control API tests covering session list and transcript retrieval endpoints.
- Updated docs and task board for the new endpoints.

## Files changed
- `src/transcript/sessionTranscriptStore.ts`
- `src/transcript/sqliteSessionTranscriptStore.ts`
- `src/missionControl/server.ts`
- `src/index.ts`
- `src/tests/missionControlApi.test.ts`
- `README.md`
- `TASK_BOARD.md`

## New components
- `SessionTranscriptSession` summary shape for mission-control usage.

## Behavior changes
- Mission Control now exposes `GET /api/sessions` and `GET /api/sessions/:session_id`.
- Runtime mission-control mode now reads from persisted session transcript data.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Revert session summary method additions in transcript store interfaces/implementations.
2. Remove Mission Control `/api/sessions` and `/api/sessions/:session_id` endpoints.
3. Revert mission-control transcript store wiring in `src/index.ts`.
4. Revert mission-control API tests and docs/task board updates.
5. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: transcript endpoint volume grows for long sessions.
- Mitigation: endpoints are session-scoped and backed by indexed SQLite queries.
- Risk: API path overlap with future nested resources.
- Mitigation: current routes are explicit and covered by contract tests.

## Next steps
- Add session transcript panel in Mission Control UI.
- Add transcript retention policy controls.
