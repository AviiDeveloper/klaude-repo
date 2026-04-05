# 2026-04-05_003 — Project Pulse Dashboard

## What changed
New route `/workspace/[slug]/pulse` in Mission Control — a "where did I leave off?" dashboard that scans the entire monorepo and tells you what's unfinished, what happened recently, and what's blocking launch.

**Files created:**
- `src/lib/pulse/types.ts` — type definitions for all pulse data
- `src/lib/pulse/scanner.ts` — server-side git, TODO, changelog, ADR, task board scanner
- `src/lib/pulse-store.ts` — Zustand store with next-steps algorithm
- `src/app/api/pulse/unfinished/route.ts` — git + code + task board signals API
- `src/app/api/pulse/activity/route.ts` — git log grouped by app API
- `src/app/api/pulse/checklist/route.ts` — launch checklist GET + PATCH API
- `src/app/workspace/[slug]/pulse/page.tsx` — page shell
- `src/components/pulse/NextSteps.tsx` — algorithmic priority suggestions
- `src/components/pulse/UnfinishedWork.tsx` — collapsible git/code/task sections
- `src/components/pulse/RecentActivity.tsx` — app activity cards with dormancy dots
- `src/components/pulse/LaunchChecklist.tsx` — interactive checklist with progress bars

**Files modified:**
- `src/lib/db/migrations.ts` — migration 016: launch_checklist table + 15 seed items
- `src/components/Header.tsx` — added Pulse nav link (pink, Activity icon)

## Why
Solo developer loses track of project state when jumping between apps. Needs a single page that shows what's dangling, what changed recently, and what's left before launch — without having to reconstruct context from memory.

## Stack
Next.js 14, React 18, Zustand, better-sqlite3, child_process (git), date-fns, Tailwind CSS

## Integrations
- Git CLI (status, for-each-ref, rev-list, log) via child_process.execSync
- TASK_BOARD.md parser (markdown checkbox extraction)
- CHANGELOG/ directory scanner (known issues extraction)
- ADR/ directory scanner (proposed status detection)
- SQLite launch_checklist table (new)

## How to verify
1. `npm run build` in apps/mission-control/ — passes
2. Navigate to `/workspace/default/pulse`
3. "Suggested Next Steps" shows active task board items + dormant apps
4. "Unfinished Work" expands to show git branches, TODOs by app, changelog issues
5. "Recent Activity" shows 6 app cards with green/yellow/red dormancy dots
6. "Launch Readiness" shows 15 checklist items across 6 apps, clicking toggles status
7. Header shows pink "Pulse" button

## Known issues
- Dormancy detection uses git log `--all` which includes all branches — may overcount activity for apps with many feature branches
- TODO scanner walks all source files synchronously — fast for current codebase (~130 files) but could be slow if significantly more code is added
- Launch checklist items are seeded once in migration; adding new items requires a SQL insert
