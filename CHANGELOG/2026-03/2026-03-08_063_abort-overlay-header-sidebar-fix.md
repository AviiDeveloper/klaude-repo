# 2026-03-08_063_abort-overlay-header-sidebar-fix

## Summary
Fixed recurring browser runtime abort overlays by removing client-side AbortController timeout abort usage from Header and AgentsSidebar OpenClaw polling helpers.

## What Changed
- Replaced AbortController timeout pattern in `fetchJsonSafely` with Promise.race timeout that returns `null` safely.
- Applied in:
  - `src/components/Header.tsx`
  - `src/components/AgentsSidebar.tsx`
- Preserved offline-safe behavior by returning `null` on timeout/fetch failure.

## Why
Abort-driven fetch timeout handling in client components was surfacing as unhandled `AbortError: signal is aborted without reason` overlays in Next.js dev runtime.

## Files
- `apps/mission-control/src/components/Header.tsx`
- `apps/mission-control/src/components/AgentsSidebar.tsx`
- `TASK_BOARD.md`
