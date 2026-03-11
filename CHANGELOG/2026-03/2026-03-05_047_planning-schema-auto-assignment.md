# 2026-03-05 047 Planning Schema + Auto Assignment

## Date and sequence
- Date: 2026-03-05
- Sequence: 047

## Milestone mapping
- Expansion track: Mission Control planning and execution reliability

## Summary
- Replaced ambiguous planning completion handling with a normalized structured schema aligned to `SPEC.md` and `PROMPT_GOVERNANCE.md`.
- Enforced mandatory planning fields at completion (`objective`, `plan_steps`, `assigned_agents`, `side_effects`, `approvals_required`, `rollback_plan`, `stop_conditions`, `inputs_needed`).
- Added deterministic agent auto-assignment and auto-dispatch behavior on planning completion, including fallback to default Code/Ops agent templates when planner output is underspecified.
- Removed dependency on missing `PLANNING.md` by embedding required planning rules directly in planning prompts.

## Files changed
- `apps/mission-control/src/lib/planning-schema.ts`
- `apps/mission-control/src/app/api/tasks/[id]/planning/answer/route.ts`
- `apps/mission-control/src/app/api/tasks/[id]/planning/route.ts`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- Planning completion now persists a normalized, spec-shaped `planning_spec` payload even when raw model output is partially incomplete.
- Workspace agent records are reused by name+role before creating new agents, reducing duplicate agent rows.
- Task assignment now targets preferred agent alias from `assigned_agents[0]` when present, then falls back to first normalized agent.
- If no agent payload is provided by planner, Code/Ops defaults are injected so assignment and execution can continue.

## Tests or verification
- `npm run mc:build`

## Rollback steps
1. Revert `apps/mission-control/src/lib/planning-schema.ts` and planning route changes.
2. Restore previous planning completion persistence/assignment behavior.
3. Revert `TASK_BOARD.md` and `src/index.ts` updates.
4. Delete this changelog pair.

## Next steps
- Add UI surfacing for normalized plan fields (`objective`, `plan_steps`, `rollback_plan`) on task details view.
- Add route-level tests for planning completion normalization edge cases.
