# 2026-03-09_066_agent-factory-suggest-time-window-fix

## Summary
Fixed premature AI Draft failures in Agent Factory by extending OpenClaw suggestion polling windows and frontend timeout windows.

## What Changed
- Increased backend suggestion polling horizon in `factory/suggest` route:
  - longer attempt count
  - longer interval
  - parse-as-soon-as-valid strategy across polling loop
- Increased frontend AI Draft request timeout from `12s` to `30s`.
- Verified on Pi runtime that `/api/agents/factory/suggest` returns a populated JSON suggestion instead of early `504` for the same prompt.

## Why
OpenClaw often returns valid model output after 6-15+ seconds. Previous windows could terminate early and report "No model response yet" despite the model finishing shortly after.

## Files
- `apps/mission-control/src/app/api/agents/factory/suggest/route.ts`
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `TASK_BOARD.md`
