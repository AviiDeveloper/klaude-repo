# 2026-03-11_078_self-improvement-redteam-audit

## Summary
Ran a red-team audit of the current learning/self-improvement loop, documented the exact pipeline it follows, and recorded measured failures showing that keyword stuffing can mislead the scorer and therefore corrupt Charlie's learning-driven delegation mode.

## What Changed
- Added deterministic audit harness:
  - `apps/mission-control/scripts/self-improvement-redteam.ts`
- Added operations report:
  - `OPERATIONS/SELF_IMPROVEMENT_REDTEAM_AUDIT_2026-03-11.md`
- Added root/app npm script:
  - `mc:self-improvement:redteam`
  - `self-improvement:redteam`
- Updated task board with follow-up hardening task:
  - `EXP-010i`

## Why
The current learning loop can influence Charlie's delegation mode. Before trusting that signal, the scorer needed to be attacked with adversarial answers to verify whether failure is correctly detected and whether the system actually improves after failure.

## Validation
- `npm run mc:self-improvement:redteam` passed and produced measured findings.
- `npm run typecheck` passed.

## Files
- `apps/mission-control/scripts/self-improvement-redteam.ts`
- `apps/mission-control/package.json`
- `package.json`
- `OPERATIONS/SELF_IMPROVEMENT_REDTEAM_AUDIT_2026-03-11.md`
- `TASK_BOARD.md`
