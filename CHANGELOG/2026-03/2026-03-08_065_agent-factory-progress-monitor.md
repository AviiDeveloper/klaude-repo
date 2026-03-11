# 2026-03-08_065_agent-factory-progress-monitor

## Summary
Added an Agent Factory in-modal progress monitor to show operation stages, elapsed runtime, and logic trace events during AI Draft and Generate actions.

## What Changed
- Added operation monitor state in Agent Factory modal:
  - operation kind (`draft` / `generate`)
  - current stage string
  - start timestamp + elapsed seconds
  - rolling logic trace entries with timestamp
- Added monitor helpers:
  - `startOperation`
  - `updateOperationStage`
  - `finishOperation`
  - `pushTrace`
- Wired stage updates into both flows:
  - AI Draft lifecycle
  - Generate lifecycle
- Added visible `Progress Monitor` panel with:
  - active stage
  - elapsed timer
  - logic trace feed

## Why
When OpenClaw or network calls are slow, operators need visibility into what the system is doing and where it is waiting/failing instead of seeing only a spinner.

## Files
- `apps/mission-control/src/components/AgentFactoryModal.tsx`
- `TASK_BOARD.md`
