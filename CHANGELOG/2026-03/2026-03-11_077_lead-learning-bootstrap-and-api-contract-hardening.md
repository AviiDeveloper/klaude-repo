# 2026-03-11_077_lead-learning-bootstrap-and-api-contract-hardening

## Summary
Improved learning-loop operability from Lead Console by adding in-app learning bootstrap controls and hardened learning API response contracts with automated verification.

## What Changed
- Lead Console:
  - added Learning Bootstrap action (`Generate Question`) directly in `/workspace/[slug]/lead`
  - added latest learning-question preview block in console
  - improved no-learning fallback messaging with explicit bootstrap instruction.
- Learning API response contract hardening:
  - `POST /api/learning/questions/generate` now returns wrapped + top-level payload via `question_record` + flattened fields
  - `POST /api/learning/questions/:id/answer` now returns wrapped + top-level payload via `result_record` + flattened fields
  - clients updated to accept both wrapped and legacy flat response shapes.
- Added deterministic API contract verification script:
  - `apps/mission-control/scripts/learning-api-contract-verify.ts`
  - verifies nested record + top-level field parity for both learning endpoints.
- Added npm script hooks:
  - app: `learning:api:verify`
  - root: `mc:learning:api:verify`
- Updated task board:
  - `EXP-010h` marked complete.

## Why
Manual terminal bootstrapping slowed testing and response-shape drift caused integration ambiguity. This slice provides direct in-app bootstrap and locks API shape with repeatable tests.

## Validation
- `npm run typecheck` passed.
- `npm run mc:build` passed.
- `npm run mc:learning:api:verify` passed.
- `npm run mc:lead:learning:verify` passed.

## Files
- `apps/mission-control/src/components/LeadControlConsole.tsx`
- `apps/mission-control/src/app/api/learning/questions/generate/route.ts`
- `apps/mission-control/src/app/api/learning/questions/[id]/answer/route.ts`
- `apps/mission-control/src/app/workspace/[slug]/learning/page.tsx`
- `apps/mission-control/scripts/learning-api-contract-verify.ts`
- `apps/mission-control/package.json`
- `package.json`
- `TASK_BOARD.md`
