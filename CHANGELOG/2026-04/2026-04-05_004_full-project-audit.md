# 2026-04-05_004 — Full Project Audit & Remediation

## What changed

Comprehensive audit of the entire monorepo: 3 parallel deep scans (builds, docs, cross-app consistency) + 2 code-vs-docs audits. Found and fixed **30+ issues**.

### Knowledge Base Fixes (6 files)
- `auth-contract.md` — marked token expiry bug as fixed (was claiming it was still broken)
- `api-surface.md` — complete rewrite: added 60+ mission-control endpoints, fixed wrong endpoint paths, added missing sales-dashboard admin routes, noted mobile-api dead payments route
- `lead-lifecycle.md` — corrected status transitions (pitched→visited and rejected→new are allowed), documented unenforced max_active_leads, documented hardcoded commission
- `payment-flow.md` — fixed endpoint name (connect not connect-onboard)
- `database-architecture.md` — added 21 undocumented mission-control tables, updated schema duplication notes
- `mobile-api/CLAUDE.md` — removed stale token expiry bug reference

### Governance & ADR Fixes (7 files)
- `CONSTRAINTS.md` — noted 8-agent expansion (was "max 2 agents")
- `ADR-0002` — status changed from Proposed → Superseded by ADR-0005
- `ADR-0006` — status changed from Proposed → Accepted (fully implemented)
- `AGENT_PIPELINES_DRAFT.md` — renamed to `AGENT_PIPELINES.md`, removed "draft" label
- `OPERATIONS/DEPLOYMENT.md` — full rewrite for current 8-agent architecture with deploy commands
- `TASK_BOARD.md` — moved 13 completed items from Active to Done section
- `CLAUDE.md` (root) — updated project overview to list all 7 components with ports

### Code Fixes (10 files)
- `mobile-api/src/index.ts` — wired dead payments route (was never imported)
- `mobile-api/src/db.ts` — added CHECK constraint on lead_assignments.status and demo_links.status, added missing columns (follow_up_at, follow_up_note, contact_name, contact_role)
- `mobile-api/package.json` — bumped better-sqlite3 from ^11.0.0 to ^11.7.0
- All 5 `package.json` files — added `"engines": {"node": ">=18"}`
- Created `.env.example` for sales-dashboard, mobile-api, admin-panel

### Audit Reconciliation: Previously Unlogged Features

These features were implemented but never received CHANGELOG entries:

**Knowledge & Memory Systems** (Feb-Apr 2026):
- Business brain MCP system (knowledge/, kb-lookup.sh, auto-retrieval hook)
- Per-app CLAUDE.md files for sales-dashboard, admin-panel, mobile-api
- Decision journal system (klaude-vault/ convention)
- MSA memory system with FTS5 and BM25 scoring

**Agent & Pipeline Systems** (Feb-Mar 2026):
- Production agent system with self-improvement & approval policy
- Memory system integration into runtime
- Runtime pipeline seed script for production DAGs
- RRULE fixes, memory-driven delegation scoring

**Self-Learning Data Layer** (Mar 2026):
- Decision Logger foundation
- Demo record logging with screenshot capture
- Outcome Measurer nightly feedback loop
- Self-learning data pipeline audit fixes
- AI-powered brand intelligence agent
- CLI test harness for end-to-end demo generation

**Mission Control Extensions** (Mar-Apr 2026):
- Site generation system (migrations 014-015, site_templates, generated_sites)
- Brand asset scraping columns (brand_assets_json, brand_colours_json, etc.)
- Audit trail system + real agent execution engine
- AI request telemetry table

**Database Migrations 011-015** (Mar-Apr 2026):
- 011: Audit log and telemetry tables
- 012: Outreach campaign tables
- 013: Agent eval specs and performance profiles
- 014: Site templates and generated sites
- 015: Brand asset scraping columns

## Why
Solo developer working non-linearly across 6 apps. Documentation and code drifted apart over 2 months of rapid development. This audit brings everything back into sync so the Vault Viewer and Project Pulse dashboard show accurate, complete information.

## Stack
All apps: Next.js 14, Express, better-sqlite3, TypeScript, SwiftUI

## How to verify
1. Read any knowledge file — claims should match current source code
2. ADR statuses should match implementation reality
3. TASK_BOARD.md Active section should only have genuinely active items (EXP-005, EXP-007)
4. `npm run build` passes for mission-control, mobile-api compiles with `tsc`
5. All package.json files have `"engines"` field
6. .env.example files exist for sales-dashboard, mobile-api, admin-panel

## Known issues
- 40+ feature commits still lack individual CHANGELOG entries (covered by this reconciliation entry)
- No CI/CD automation — builds are manual
- No test suites in any app (test infrastructure exists but no tests written)
- `apps/mobile/` is a placeholder — not deployed or actively developed
