# CLAUDE.md — Project Instructions for Claude Code

## Project Overview
AI Salesperson Platform — a gig-economy system that recruits salespeople to sell
AI-generated websites to local small businesses. Three architectures coexist:
1. **Orchestration System** (`src/`) — OpenClaw multi-agent runtime (TypeScript)
2. **Sales Dashboard** (`apps/sales-dashboard/`) — Next.js + Supabase + Stripe Connect
3. **iOS App** (`apps/ios/salesflow/`) — Native SwiftUI salesperson app

Also: Mission Control (`apps/mission-control/`), Admin Panel (`apps/admin-panel/`),
Mobile App (`apps/mobile/`), Mobile API (`apps/mobile-api/`).

## Source of Truth (read in this order)
1. `SPEC.md` — master specification
2. `CONSTRAINTS.md` — hard limits
3. `OPENCLAW/*` — interface contracts and security
4. `GOVERNANCE/*` — change policy, trace schema, prompt rules
5. `AGENTS/*` — agent contracts and capabilities
6. `OPERATIONS/*` — deployment and observability
7. `ADR/*` — architecture decision records

## Hard Rules
- Do not introduce new services or components not in SPEC.md without an ADR entry
- Do not perform side effects without approval token logic
- Do not store secrets in prompts, logs, or committed files
- Do not expand agent scope beyond their contracts in AGENTS/AGENT_CONTRACTS.md
- Prefer editing existing files over creating new ones

## Changelog Convention
For implementation changes, create a changelog entry:
```
CHANGELOG/YYYY-MM/YYYY-MM-DD_NNN_<shortname>.md
```
- NNN = 3-digit daily sequence number
- Keep existing .json changelog entries; new entries only need .md

## Change Log Requirement
Every completed change MUST be logged in a `.md` file under `CHANGELOG/YYYY-MM/` before the task is considered done. Each log entry must include:
- **What changed** — files created, modified, or deleted
- **Why** — the purpose / user request that triggered it
- **Stack** — technologies, libraries, frameworks involved (e.g., Next.js, SQLite, systemd, Telegram API)
- **Integrations** — external services or systems touched (e.g., OpenRouter, Telegram bot, Tailscale, Pi systemd)
- **How to verify** — how to confirm the change works (API endpoints, Telegram commands, UI locations)
- **Known issues** — any caveats, pre-existing failures, or limitations

## Deploy After Every Change
Every change MUST be deployed to the Pi and verified working via Tailscale before the task is marked complete. The workflow is:
1. Build locally (`npm run mc:build` and/or `npm run build`)
2. Deploy to Pi using the correct worktree source:
   ```bash
   LOCAL_REPO="<worktree-path>" PI_HOST="openclaw@100.93.24.14" bash scripts/pi/mc-push-pi.sh
   LOCAL_REPO="<worktree-path>" PI_HOST="openclaw@100.93.24.14" bash scripts/pi/runtime-push-pi.sh
   ```
3. Verify the service is running on Pi (`systemctl --user status`)
4. Verify the change works at `http://100.93.24.14:3001` (MC) or `http://100.93.24.14:4317` (runtime)

If deployment fails, fix the issue before moving on. The user expects to open the Tailscale URL and see the change working.

## Git Workflow — MUST FOLLOW
- **Never work directly on main.** Main is the stable base.
- **Create a feature branch** from main for every task: `feat/`, `fix/`, `chore/`
- **Use worktrees** for parallel sessions — say "use a worktree" to get isolation
- **Commit after each logical change** — do not batch commits at the end
- Small, focused commits — one concern per commit
- No mixed-scope commits
- Run `npm run verify` before committing when source changes are involved
- When done, the user will review and merge to main

## Key Commands
```bash
npm run verify          # typecheck + build + test
npm run dev             # local runtime (port 4317)
npm run mc:dev          # Next.js Mission Control (port 3000)
npm run mc:dev:safe     # Mission Control localhost-only
npm run mc:build        # build Mission Control
npm run mc:push:pi      # deploy to Pi 400
```

## Current State — What's Built and Where

### Sales Dashboard (`apps/sales-dashboard/`) — port 4300
Salesperson-facing web app. Next.js 14 on Vercel.
- **Auth**: Custom HMAC token with PIN login (`src/lib/auth.ts`)
- **DB**: SQLite (primary) + Supabase (demo storage only)
- **Pages**: `/dashboard`, `/lead/[id]`, `/map`, `/payouts`, `/profile`, `/settings`, `/referrals`, `/help`, `/demo/[code]`, landing page at `/`
- **Legal**: `/legal/terms`, `/legal/privacy`, `/legal/contractor`
- **Admin section**: `/admin` (upload demos, assign leads) — separate admin auth
- **API routes**:
  - `/api/auth/*` — login, signup, logout, me
  - `/api/leads/*` — CRUD + status + followup
  - `/api/payments/*` — Stripe Connect checkout, webhook, payout
  - `/api/demo-site/[slug]`, `/api/demo-preview/[id]` — serve demos from Supabase
  - `/api/admin/*` — upload, assign, auth
  - `/api/stats`, `/api/activity`, `/api/demo-links`
- **Env vars**: `SD_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Admin Panel (`apps/admin-panel/`) — port 4400
Internal admin interface. Next.js 14.
- **Auth**: Role-based token (owner/manager/viewer) (`src/lib/admin-auth.ts`)
- **DB**: SQLite (shared with sales-dashboard)
- **Pages**: `/dashboard`, `/leads`, `/pipeline`, `/salesforce`, `/login`
- **API routes**: `/api/auth/*`, `/api/leads/*`, `/api/stats`, `/api/team/*`

### Mission Control (`apps/mission-control/`) — port 3000
Orchestration UI for the multi-agent system. Next.js 14.
- **Auth**: Optional bearer token (`MISSION_CONTROL_AGENT_TOKEN`)
- **DB**: SQLite with migrations (`mission-control.db`)
- **Key features**: Workspace management, agent factory, task lifecycle, evaluations, learning system, cost tracking, OpenClaw gateway, cron jobs
- **API routes**: 40+ endpoints under `/api/workspaces`, `/api/agents`, `/api/tasks`, `/api/evals`, `/api/learning`, `/api/costs`, `/api/openclaw`, `/api/lead`

### iOS App (`apps/ios/salesflow/`) — SwiftUI
Native salesperson app.
- **Screens**: Login, mode select, leads list, lead detail, map view, demo share (QR/AirDrop), client presentation, payouts, profile
- **Infra**: `APIClient.swift`, `AuthStore.swift`, `DemoSiteCache.swift`, `Models.swift`
- **Demo sites**: 5 bundled HTML demos in `DemoSites/`

### Mobile App (`apps/mobile/`) — Expo React Native
Cross-platform salesperson app (alternative to iOS native).
- **Screens**: Login, signup, leads tab, map tab, payouts tab, profile tab, lead detail
- **Infra**: `src/api/client.ts`, `src/store/auth.ts`, design tokens in `src/theme/`

### Mobile API (`apps/mobile-api/`) — Express, port 4350
Backend for mobile apps.
- **Auth**: HMAC bearer token (shared `SD_SECRET` with sales-dashboard)
- **DB**: SQLite (shared)
- **Routes**: `/auth`, `/leads`, `/visits`, `/photos`, `/sync`, `/push`, `/health`

### Orchestration Runtime (`src/`) — port 4317
OpenClaw multi-agent system. TypeScript, single-process.
- **Core**: `orchestrator/orchestrator.ts` — task dispatch + approval gating
- **Agents**: `agents/codeAgent.ts`, `agents/opsAgent.ts` + outreach agents (brief generator, site composer, brand analyser)
- **Pipeline**: `pipeline/engine.ts` — DAG execution, budget enforcement, post dispatch
- **OpenClaw**: `openclaw/bridgeServer.ts` — HTTP + WebSocket bridge, Twilio media
- **Storage**: SQLite stores for tasks, traces, transcripts, notifications, pipeline
- **Interface**: `interface/controller.ts` — transport-agnostic message handler
- **Events**: `events/bus.ts` — in-memory pub/sub
- **Tests**: 187 passing (1 pre-existing failure in outreach pipeline)

### Shared Infrastructure
- **Supabase schemas**: `supabase/schema.sql`, `supabase/sales-dashboard-tables.sql`
- **Pi deployment**: `scripts/pi/` — rsync + systemd scripts
- **All apps share SQLite** at `apps/mission-control/mission-control.db` (except root runtime which uses `data/mvp.sqlite`)

## Architecture Notes
- All Next.js apps externalize `better-sqlite3` in `next.config.mjs`
- OpenClaw is an adapter layer, not a hard dependency
- Pi deployment uses user-level systemd services

## Deployment Target
- Raspberry Pi 400, user `openclaw`, repo at `/home/openclaw/klaude-repo`
- Tailscale for remote access
- Sales Dashboard deployed to Vercel
- `scripts/pi/mc-push-pi.sh` handles rsync + build + systemd restart
