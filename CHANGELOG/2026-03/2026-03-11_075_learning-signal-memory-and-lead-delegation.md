# 2026-03-11_075_learning-signal-memory-and-lead-delegation

## Summary
Integrated operator learning outcomes into Charlie's memory packet and delegation scoring so Lead behavior adapts between conservative, balanced, and exploratory assignment modes.

## What Changed
- Extended `MemoryPacket` with `learning_context` (scores, grade rates, trend, delegation mode, coaching focus, latest concept tag).
- Added `getLearningSignal(workspaceId)` in memory builder:
  - reads recent `learning_answers` + linked `learning_questions`
  - computes trend (`improving`/`declining`/`stable`/`insufficient_data`)
  - derives delegation mode (`conservative`/`balanced`/`exploratory`)
  - emits coaching guidance text for Charlie.
- Updated `formatMemoryPacketForPrompt(...)` to include learning signal lines in agent/Lead prompts.
- Wired learning mode into Lead worker scoring:
  - conservative mode boosts proven profiles and penalizes unproven workers
  - exploratory mode boosts low-history workers and slightly penalizes overfit incumbents
  - balanced mode remains neutral.
- Added deterministic verification script:
  - `apps/mission-control/scripts/lead-learning-verify.ts`
  - validates memory-mode detection + delegation behavior shift.
- Added npm scripts:
  - app: `lead:learning:verify`
  - root: `mc:lead:learning:verify`
- Updated task board:
  - `EXP-010f` marked complete.

## Why
Charlie previously used eval/profile signals but did not consume the operator learning loop as a control input. This change closes that gap so delegation reflects operator understanding maturity and supports safer governance-first orchestration.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed.
- `npm run mc:eval:verify` passed.
- `npm run mc:lead:learning:verify` passed.

## Files
- `apps/mission-control/src/lib/types.ts`
- `apps/mission-control/src/lib/memory/packet.ts`
- `apps/mission-control/src/lib/lead-orchestrator.ts`
- `apps/mission-control/scripts/lead-learning-verify.ts`
- `apps/mission-control/package.json`
- `package.json`
- `TASK_BOARD.md`
