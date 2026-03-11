# 2026-03-08_059_agent-factory-onboarding-wizard

## Summary
Converted Agent Factory from a flat form into a guided onboarding planner that asks structured questions first, then unlocks one-click generation for advanced agents and reference sheets.

## What Changed
- Reworked `AgentFactoryModal` into a step-based onboarding flow.
- Added explicit guided questions for identity, mission, specialization, autonomy, risk, tools, handoffs, approval gates, output contract, and cadence.
- Added progress UI (`Step x/y` and completion bar).
- Added per-step validation and next/back controls.
- Added final-step generation gate so agent creation only runs after required onboarding answers are complete.
- Added right-side onboarding summary with completion indicators and pending fields.
- Kept existing backend generation endpoint unchanged (`POST /api/agents/factory`).

## Why
You need to onboard many agents quickly with consistent quality. A guided planner prevents under-specified agents and ensures reference sheets are generated from complete operational context.

## Files
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `TASK_BOARD.md`
