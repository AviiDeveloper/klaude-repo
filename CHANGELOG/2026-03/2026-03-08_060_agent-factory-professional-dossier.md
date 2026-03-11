# 2026-03-08_060_agent-factory-professional-dossier

## Summary
Upgraded Agent Factory to generate professional-grade agents by expanding onboarding depth and producing a multi-page reference dossier equivalent to a senior specialist runbook.

## What Changed
- Expanded Agent Factory request model with advanced profile fields:
  - industry context
  - competency profile
  - required knowledge sources
  - quality bar
  - decision framework
  - constraints/policies
  - escalation protocol
  - reporting contract
  - KPI targets
  - learning loop
- Extended onboarding wizard with required steps for those fields.
- Increased generation gating so advanced fields must be completed before final creation.
- Enhanced generated `SOUL.md`, `USER.md`, `AGENTS.md` with professional operating standards.
- Rebuilt reference sheet output into a multi-page dossier structure with strategic charter, competency baseline, execution OS, collaboration/escalation, and performance improvement sections.
- Persisted new advanced metadata fields in `agent_reference_sheets.metadata`.

## Why
Your agents are intended to behave like highly knowledgeable employees. This shift enforces deeper role definition and produces much richer operational documentation per generated agent.

## Files
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `apps/mission-control/src/lib/agent-factory.ts`
- `apps/mission-control/src/lib/types.ts`
- `apps/mission-control/src/app/api/agents/factory/route.ts`
- `TASK_BOARD.md`
