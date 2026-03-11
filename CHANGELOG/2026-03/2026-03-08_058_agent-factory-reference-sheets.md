# 2026-03-08_058_agent-factory-reference-sheets

## Summary
Added a new Mission Control **Agent Factory** flow to generate advanced agents from a structured template and persist full reference sheets for each generated agent.

## What Changed
- Added a sidebar entry point `Agent Factory` in the workspace `AgentsSidebar`.
- Added `AgentFactoryModal` for high-signal generation inputs:
  - mission objective
  - specialization
  - autonomy/risk profile
  - tool stack
  - handoff targets
  - approval-required actions
  - output contract and cadence
- Added backend generation endpoint:
  - `POST /api/agents/factory`
- Added deterministic artifact generator:
  - `soul_md`
  - `user_md`
  - `agents_md`
  - full generated reference sheet markdown
- Added persistent storage for generated sheets:
  - new table `agent_reference_sheets`
  - index `idx_agent_reference_sheets_agent`
  - migration `005`
- Added retrieval endpoint:
  - `GET /api/agents/:id/reference-sheet`
  - optional `?history=true`

## Why
Mission Control needs a repeatable way to create many specialized agents quickly while preserving governance and transferability. This adds a standard creation contract and a durable reference-sheet audit trail per agent.

## Files
- `apps/mission-control/src/components/AgentsSidebar.tsx`
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `apps/mission-control/src/components/index.ts`
- `apps/mission-control/src/app/api/agents/factory/route.ts`
- `apps/mission-control/src/app/api/agents/[id]/reference-sheet/route.ts`
- `apps/mission-control/src/lib/agent-factory.ts`
- `apps/mission-control/src/lib/types.ts`
- `apps/mission-control/src/lib/db/schema.ts`
- `apps/mission-control/src/lib/db/migrations.ts`
- `TASK_BOARD.md`
