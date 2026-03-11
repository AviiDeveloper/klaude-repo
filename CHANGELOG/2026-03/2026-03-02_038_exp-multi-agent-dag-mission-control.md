# 2026-03-02 038 EXP Multi-Agent DAG Mission Control

## Date and sequence
- Date: 2026-03-02
- Sequence: 038

## Milestone mapping
- Expansion track: scheduler foundation + pipeline orchestration
- Mission Control expansion for telephony, jobs, and queue operations

## Summary
- Added SQLite-backed pipeline domain with definitions, runs, nodes, artifacts, media jobs, post queue, spend ledger, and source registry.
- Added 8-agent multi-agent runtime topology and DAG execution engine with dependency-aware node triggering.
- Added retry/blocked behavior for failed nodes and manual retry/override controls.
- Added paid-node approval token gate and budget cap checks before media/publisher steps.
- Added post queue approval/dispatch flow with pluggable dispatch adapters (webhook/noop).
- Added scheduler service for recurring pipeline run triggering (hourly by default).
- Added Mission Control APIs for jobs, runs, graph inspection, node retry/override, media job creation, post queue, and telephony control.
- Expanded Mission Control UI with scheduler controls, run trigger, post queue visibility, and telephony call controls.
- Added telephony bridge control client wiring into mission-control runtime mode.
- Added integration tests validating pipeline run, post queue dispatch, and telephony APIs.

## Files changed
- `src/pipeline/types.ts`
- `src/pipeline/sqlitePipelineStore.ts`
- `src/pipeline/agentRuntime.ts`
- `src/pipeline/engine.ts`
- `src/pipeline/scheduler.ts`
- `src/pipeline/postDispatch.ts`
- `src/telephony/controlClient.ts`
- `src/missionControl/server.ts`
- `src/index.ts`
- `src/notifications/notificationStore.ts`
- `src/tests/missionControlApi.test.ts`
- `TASK_BOARD.md`
- `OPERATIONS/PHONE_CALLING_PLAN.md`
- `README.md`
- `ADR/ADR-0012-multi-agent-dag-scheduler-mission-control.md`

## New components
- Multi-agent pipeline persistence layer and execution engine.
- Scheduler runtime for recurring DAG runs.
- Mission Control API surface for pipeline operations.
- Telephony control client for Mission Control to call bridge endpoints.

## Behavior changes
- Mission Control can now create/update/list recurring pipeline jobs and trigger runs.
- DAG node execution now supports dependency-aware progression, failure blocking, and manual recovery actions.
- Paid nodes are blocked without approval token and budget caps are enforced before cost-incurring actions.
- Post payloads are queued for approval and can be dispatched through adapter transports.
- Mission Control can initiate telephony calls and inspect telephony media sessions through control APIs.

## Tests or verification
- `npm run typecheck`
- `npm test`

## Rollback steps
1. Remove new `src/pipeline/*` modules and `src/telephony/controlClient.ts`.
2. Revert Mission Control API/UI pipeline and telephony-control additions.
3. Revert mission-control runtime wiring in `src/index.ts`.
4. Revert notification reason extension and new API tests.
5. Revert docs/task board/operations and ADR updates.
6. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: scheduler over-trigger or duplicate runs.
- Mitigation: persisted next-run timestamps and per-run node state in SQLite.
- Risk: paid-step costs exceed desired limits.
- Mitigation: hard budget checks and approval-token enforcement for paid nodes.
- Risk: webhook integrations vary by destination implementation.
- Mitigation: adapter abstraction with noop fallback and explicit per-platform config.

## Next steps
- Implement platform-specific OAuth/native publisher adapters for TikTok/Reels/Shorts.
- Deepen content quality controls (source trust scoring, dedupe tuning, balancing policy).
- Complete realtime Twilio media bridge path for low-latency voice transport.
