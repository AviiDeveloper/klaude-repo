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

## Current State
Business domain, app architecture, API surfaces, and entity definitions are documented
in `knowledge/` (16 atomic notes). Search via the `business-brain` MCP tool or browse
the folder directly. Key areas:
- `knowledge/domain/` — lead lifecycle, payments, demos, training, onboarding
- `knowledge/entities/` — canonical field definitions for leads, salespeople, demo links, training
- `knowledge/contracts/` — auth token format, shared enums, API surface, database architecture
- `knowledge/architecture/` — app overview, cross-app communication, known duplication

## Deployment Target
- Raspberry Pi 400, user `openclaw`, repo at `/home/openclaw/klaude-repo`
- Tailscale for remote access
- Sales Dashboard deployed to Vercel
- `scripts/pi/mc-push-pi.sh` handles rsync + build + systemd restart
