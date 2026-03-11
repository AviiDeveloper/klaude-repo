# 2026-02-27 013 M4 Two-Phase Latency Metrics

## Date and sequence
- Date: 2026-02-27
- Sequence: 013

## Milestone mapping
- Milestone 4: voice mode performance instrumentation
- SPEC references: Section 5 (latency targets and two-phase response), Section 9 (Milestone 4)

## Summary
- Added `LatencyTracker` component to capture ack and total response latency.
- Updated interface controller to produce two-phase message metadata (`phase`, `latency_ms`).
- Added metrics recording for each message/voice-triggered request path.
- Propagated phase/latency metadata through OpenClaw outbound message payloads.
- Added Mission Control `/api/metrics` endpoint and message-response metrics output.
- Extended tests to assert phase metadata and metrics endpoint behavior.

## Files changed
- `src/metrics/latencyTracker.ts`
- `src/interface/controller.ts`
- `src/openclaw/inboundAdapter.ts`
- `src/missionControl/server.ts`
- `src/index.ts`
- `src/tests/adapterContract.test.ts`
- `src/tests/missionControlApi.test.ts`
- `TASK_BOARD.md`

## New components
- `LatencyTracker` in-memory rolling latency metrics store.

## Behavior changes
- Outbound message payloads now include optional `phase` (`ack` or `detail`) and `latency_ms`.
- Mission Control now exposes aggregate latency snapshot data at `/api/metrics`.
- Controller now records ack latency vs total response latency for each interaction.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove `src/metrics/latencyTracker.ts`.
2. Revert controller latency tracking and message phase metadata.
3. Revert outbound payload metadata in OpenClaw adapter.
4. Remove Mission Control `/api/metrics` endpoint and related test assertions.
5. Revert task board update.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: metrics currently in-memory only (reset on restart).
- Mitigation: lightweight by design for MVP; can persist to DB in next observability pass.
- Risk: two-phase currently measured in single request lifecycle.
- Mitigation: explicit `phase` and latency metadata now available for stricter async delivery later.

## Next steps
- Implement `M4-003` progress narration/callback loop for operations exceeding 3 seconds.
- Integrate real model providers (`M5-001`) after voice loop behavior is complete.
