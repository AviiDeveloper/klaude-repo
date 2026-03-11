# 2026-03-11 079 Cost Observatory Page And Agent Breakdown

## Why
- Operators need a visible view of what is likely costing money inside Mission Control/OpenClaw workflows.
- The current system stores orchestration/eval/learning/reference-sheet activity, but does not persist exact OpenRouter billing per request locally.
- A first-pass observability layer is needed now so you can see which workspaces, agents, and actions are driving estimated spend.

## What Changed
- Added cost observability library for estimated AI action spend aggregation:
  - `apps/mission-control/src/lib/cost-observability.ts`
- Added API endpoint:
  - `GET /api/costs/overview`
- Added workspace Cost Observatory page:
  - `/workspace/[slug]/costs`
- Added header navigation link to Cost Observatory.
- Added agent-level estimated cost summary and action breakdown to Agent Modal performance tab.

## Estimation Model
- This slice is explicitly **estimated** spend, not exact external billing.
- Estimates are derived from workflow counts already stored in Mission Control:
  - planning sessions
  - lead delegations
  - progress requests
  - learning question generation
  - learning scoring
  - Agent Factory profile generation
  - eval runs
- Each workflow type uses a documented unit-cost heuristic and is aggregated into:
  - workspace summary
  - per-agent summary
  - action breakdown rows

## Operator Impact
- You can now inspect likely cost drivers without leaving Mission Control.
- Workspace-level visibility helps compare projects.
- Agent-level visibility helps identify which agents/actions are likely burning the most AI budget.

## Validation
- `npm run typecheck`
- `npm run mc:build`

## Follow-up
- Persist exact OpenClaw/OpenRouter request telemetry locally so estimated spend can be compared against real billing.
- Add task-level cost badges and per-task cost timeline.
