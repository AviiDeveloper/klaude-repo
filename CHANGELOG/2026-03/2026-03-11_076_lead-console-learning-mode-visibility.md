# 2026-03-11_076_lead-console-learning-mode-visibility

## Summary
Added a dedicated learning-mode visibility block in Lead Console so Charlie’s delegation posture is readable without inspecting raw memory JSON.

## What Changed
- Extended Lead Console memory typing to read `learning_context`.
- Added a new **Learning Delegation Mode** panel in `/workspace/[slug]/lead` showing:
  - delegation mode (`conservative` / `balanced` / `exploratory`)
  - trend (`improving` / `declining` / `stable` / `insufficient_data`)
  - avg score, latest score, good/wrong rates, sample counts
  - coaching focus text
  - latest concept tag (when available)
- Added color-coded mode badge to make current control posture obvious at a glance.
- Updated task board:
  - `EXP-010g` marked complete.

## Why
Lead orchestration now adapts using learning signals (EXP-010f), so operator trust requires visible “why” telemetry. This panel makes Charlie behavior explainable in the console and supports governance-first decision review.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed.

## Files
- `apps/mission-control/src/components/LeadControlConsole.tsx`
- `TASK_BOARD.md`
