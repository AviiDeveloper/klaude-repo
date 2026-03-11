# 2026-03-08_061_agent-factory-openclaw-ai-draft

## Summary
Connected Agent Factory to OpenClaw for AI-assisted onboarding drafts so advanced profile fields can be generated from mission objective, role, and specialization.

## What Changed
- Added `POST /api/agents/factory/suggest` endpoint.
- Endpoint connects to OpenClaw Gateway, sends a structured prompt, polls response history, and returns parsed JSON suggestions.
- Added robust response parsing for direct JSON or JSON inside markdown blocks.
- Added `AI Draft Profile` action in Agent Factory modal.
- `AI Draft Profile` auto-fills advanced professional fields:
  - industry context
  - competency profile
  - knowledge sources
  - quality bar
  - decision framework
  - constraints and policies
  - escalation protocol
  - reporting contract
  - KPI targets
  - learning loop

## Why
Agent Factory needed to use model intelligence (via OpenClaw) instead of only static templates, so operators can bootstrap high-quality agents faster.

## Files
- `apps/mission-control/src/app/api/agents/factory/suggest/route.ts`
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `TASK_BOARD.md`
