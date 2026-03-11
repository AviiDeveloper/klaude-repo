# 2026-03-08_064_agent-factory-stuck-request-timeouts

## Summary
Fixed Agent Factory stuck UI states by adding hard request timeouts and preventing simultaneous AI Draft + Generate actions.

## What Changed
- Added server-side timeout wrappers in `factory/suggest` route for:
  - OpenClaw connect
  - `chat.send`
  - `chat.history`
- Added client-side fetch timeout wrapper in Agent Factory modal.
- Added timeout-specific user-facing error messages for draft/generate actions.
- Enforced mutual exclusion:
  - cannot Generate while Drafting
  - cannot Draft while Generating
- Prevented indefinite spinner states by guaranteeing timeout exits.

## Why
`/api/agents/factory/suggest` could hang when OpenClaw was slow/unavailable, causing the UI to remain in perpetual `Drafting...`/`Generating...` state.

## Files
- `apps/mission-control/src/app/api/agents/factory/suggest/route.ts`
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `TASK_BOARD.md`
