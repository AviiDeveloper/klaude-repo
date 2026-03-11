# 2026-02-27 020 M5 Greeting Fast-Path and Trace Metadata Hardening

## Date and sequence
- Date: 2026-02-27
- Sequence: 020

## Milestone mapping
- Milestone 5 hardening (in-track)
- Focus: UX quality for low-intent inputs + audit metadata accuracy

## Summary
- Added greeting-only fast-path in `InterfaceController` to avoid full task orchestration for simple greetings (`hello`, `hi`, etc.).
- Greeting path now returns immediate conversational ack/detail messages with latency metrics.
- Added env-driven build change metadata in runtime (`BUILD_CHANGE_ID`) to avoid stale trace `changelog_change_id` values.
- Added contract test ensuring greeting input does not create task-oriented response output.

## Files changed
- `src/interface/controller.ts`
- `src/index.ts`
- `src/tests/adapterContract.test.ts`

## New components
- None.

## Behavior changes
- Low-intent greeting messages are handled conversationally and quickly.
- Task creation/execution is skipped for greeting-only inputs.
- Trace metadata can now be set per build/session via `BUILD_CHANGE_ID`.

## Tests or verification
- `npm run typecheck`
- `npm test`
- `BUILD_CHANGE_ID=2026-02-27_020_greeting-fastpath-trace-metadata npm run dev`

## Rollback steps
1. Revert greeting fast-path logic in `InterfaceController`.
2. Revert `BUILD_CHANGE_ID` usage in `src/index.ts`.
3. Remove greeting contract test in adapter tests.
4. Remove this changelog `.md` and `.json` pair.

## Risks and mitigations
- Risk: greeting detector might be too narrow or too broad.
- Mitigation: currently exact-match list; can be tuned with tests as new phrases appear.
- Risk: metadata env var omitted in some runs.
- Mitigation: default fallback remains present and explicit.

## Next steps
- Continue `M5-004` with provider timeout/retry/fallback policy.
