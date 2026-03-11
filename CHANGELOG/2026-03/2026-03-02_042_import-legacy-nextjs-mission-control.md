# 2026-03-02 042 Import Legacy Next.js Mission Control

## Date and sequence
- Date: 2026-03-02
- Sequence: 042

## Milestone mapping
- Expansion track: Mission Control full UI integration

## Summary
- Imported the exact legacy Next.js Mission Control project into this repo at `apps/mission-control`.
- Added root scripts so the imported app can be installed/run/built from `klaude-repo` without changing directories.
- Updated runtime build change id and board/docs to track this integration step.

## Files changed
- `apps/mission-control/*` (imported from `/Users/Avii/mission-control`, excluding `.git`, `.next`, `node_modules`)
- `package.json`
- `README.md`
- `TASK_BOARD.md`
- `src/index.ts`

## Behavior changes
- You can now run the original Next.js UI/API stack directly from this repository:
  - `npm run mc:install`
  - `npm run mc:dev`
  - open `http://127.0.0.1:3000`

## Tests or verification
- `npm run typecheck` (core runtime)
- `npm run mc:install`
- `npm run mc:build`

## Rollback steps
1. Remove `apps/mission-control`.
2. Remove `mc:*` scripts from root `package.json`.
3. Revert README/TASK_BOARD/index build id updates.
4. Remove this changelog pair.

## Next steps
- Wire mission-control Next.js routes to `klaude-repo` runtime endpoints where desired.
- Add unified dev runner for both services (3000 + 4317) if you want one-command launch.
