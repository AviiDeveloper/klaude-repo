# 2026-03-11_074_learning-loop-page-and-apis

## Summary
Implemented the Mission Control learning loop: question generation from recent architecture decisions, answer scoring, concept guidance, and in-app history visibility.

## What Changed
- Added learning domain service with:
  - decision-log-driven question generation
  - expected-answer spec storage
  - answer scoring with grade (`good`/`partial`/`wrong`)
  - feedback + recommended next resource
  - recent history retrieval
- Added API routes:
  - `POST /api/learning/questions/generate`
  - `GET /api/learning/questions/latest`
  - `POST /api/learning/questions/:id/answer`
  - `GET /api/learning/history`
- Added workspace learning page:
  - route: `/workspace/[slug]/learning`
  - generate question action
  - answer submission and scored result panel
  - recent history sidebar
- Added header navigation entry for Learning page.
- Updated task board:
  - `EXP-010d` marked complete.

## Why
This provides the interview/portfolio-focused learning loop requested in context: understanding architectural tradeoffs from actual project decisions, not function-level trivia.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed.
- `npm run mc:eval:verify` passed all gates after integration.

## Files
- `apps/mission-control/src/lib/learning.ts`
- `apps/mission-control/src/app/api/learning/questions/generate/route.ts`
- `apps/mission-control/src/app/api/learning/questions/latest/route.ts`
- `apps/mission-control/src/app/api/learning/questions/[id]/answer/route.ts`
- `apps/mission-control/src/app/api/learning/history/route.ts`
- `apps/mission-control/src/app/workspace/[slug]/learning/page.tsx`
- `apps/mission-control/src/components/Header.tsx`
- `TASK_BOARD.md`
