# CLAUDE.md — Project Instructions for Claude Code

## Project Overview
OpenClaw Local Agent — a single-node, voice-capable, multi-agent orchestration system.
Deployed to a Raspberry Pi 400 via Tailscale. Accessed at the Pi's Tailscale IP.

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

## Commit Discipline
- Small, focused commits — one concern per commit
- No mixed-scope commits
- Run `npm run verify` before committing when source changes are involved

## Key Commands
```bash
npm run verify          # typecheck + build + test
npm run dev             # local runtime (port 4317)
npm run mc:dev          # Next.js Mission Control (port 3000)
npm run mc:dev:safe     # Mission Control localhost-only
npm run mc:build        # build Mission Control
npm run mc:push:pi      # deploy to Pi 400
```

## Architecture Notes
- Runtime: TypeScript, single-process on port 4317
- Mission Control: Next.js app in `apps/mission-control/` on port 3000 (or 3001 on Pi)
- Storage: SQLite at `data/mvp.sqlite`
- Transport-agnostic core via `src/interface/controller.ts`
- OpenClaw is an adapter layer, not a hard dependency
- Pi deployment uses user-level systemd services (`scripts/pi/`)

## Deployment Target
- Raspberry Pi 400, user `openclaw`, repo at `/home/openclaw/klaude-repo`
- Tailscale for remote access
- `scripts/pi/mc-push-pi.sh` handles rsync + build + systemd restart
- `scripts/pi/mc-start.sh` / `mc-stop.sh` for manual control
