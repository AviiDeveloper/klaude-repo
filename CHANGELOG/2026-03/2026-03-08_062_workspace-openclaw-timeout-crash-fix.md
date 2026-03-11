# 2026-03-08_062_workspace-openclaw-timeout-crash-fix

## Summary
Fixed Mission Control workspace runtime crash caused by AbortController timeout handling in OpenClaw status checks.

## What Changed
- Removed timeout-triggered `AbortController` usage from workspace OpenClaw status check path.
- Kept OpenClaw status polling non-blocking and fallback-safe by setting offline state on fetch errors.
- Verified workspace route loads successfully after clean dev restart.

## Why
The browser surfaced `AbortError: signal is aborted without reason` as an unhandled runtime error in the workspace page, interrupting operator flow.

## Files
- `apps/mission-control/src/app/workspace/[slug]/page.tsx`
- `TASK_BOARD.md`
