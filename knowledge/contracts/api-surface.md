---
tags: [api, routes, endpoints, apps]
related: [../architecture/app-overview.md, ../architecture/cross-app-communication.md]
---

# API Surface

Which app serves which endpoints. All use JSON request/response bodies.

## Sales Dashboard (Next.js App Router, port 4300)

Auth:
- `POST /api/auth/login` — name + PIN → token
- `POST /api/auth/signup` — create new salesperson
- `POST /api/auth/logout` — clear session cookie
- `GET /api/auth/me` — current user info

Leads:
- `GET /api/leads` — list salesperson's assigned leads
- `GET /api/leads/:id` — full lead detail with enrichment
- `PATCH /api/leads/:id/status` — update lead status
- `PATCH /api/leads/:id/followup` — schedule follow-up (date + note)

Payments:
- `POST /api/payments/create-checkout` — Stripe checkout session
- `POST /api/payments/webhook` — Stripe webhook handler
- `POST /api/payments/connect` — Stripe Connect onboarding
- `POST /api/payments/payout` — initiate commission transfer

Demos:
- `GET /api/demo-site/[slug]` — serve demo from Supabase
- `GET /api/demo-preview/[id]` — preview demo
- `POST /api/demo-links` — create shareable link
- `GET /api/demo-links/:code` — get link by code

Admin:
- `POST /api/admin/auth` — admin login (password-based, not PIN)
- `GET /api/admin/salespeople` — list all salespeople
- `POST /api/admin/assign` — assign leads to salespeople
- `GET /api/admin/demos` — list demos
- `POST /api/admin/upload` — upload demo sites

Other:
- `GET /api/stats` — salesperson dashboard stats
- `GET /api/activity` — activity feed
- `POST /api/activity` — log activity

## Mobile API (Express, port 4350)

iOS app hits this API exclusively. Uses Bearer token auth.

Auth:
- `POST /auth/login`, `POST /auth/register`, `GET /auth/me`

Leads:
- `GET /leads`, `GET /leads/:id`, `PATCH /leads/:id/status`
- `POST /leads/:id/intel` — generate talking points (mobile-only)
- `GET /leads/:id/brief` — get sales brief (mobile-only)

Visits & Photos:
- `POST /visits`, `GET /visits/:id` (GPS-tracked visit sessions)
- `POST /photos`, `GET /photos/:id` (lead/storefront photos)

Payments:
- `POST /payments/checkout-url`, `GET /payments/status/:demo_id`
- `POST /payments/connect-onboard`

Training:
- `GET /training/units`, `GET /training/units/:id`
- `POST /training/progress`, `POST /training/responses`

Sync & Push:
- `POST /sync`, `GET /sync/status` (offline sync)
- `POST /push/register` (push notification tokens)

**Note**: payments routes file exists (`src/routes/payments.ts`) but is not wired in `index.ts` — these endpoints are currently unreachable dead code.

## Admin Panel (Next.js App Router, port 4400)

- `POST /api/auth/login` — admin login (role-based, not PIN)
- `GET /api/leads` — all leads across all salespeople
- `GET /api/stats` — team-wide statistics
- `GET /api/team` — list salespeople with computed stats
- `PATCH /api/team/:id` — update salesperson settings

## Mission Control (Next.js App Router, port 3000)

Internal orchestration dashboard. No external auth — local access only.

Workspaces:
- `GET/POST /api/workspaces`, `GET/PATCH /api/workspaces/:id`
- `GET /api/workspaces/:id/codex`

Agents:
- `GET/POST /api/agents`, `GET/PATCH /api/agents/:id`
- `POST /api/agents/factory`, `POST /api/agents/factory/suggest`
- `GET /api/agents/:id/reference-sheet`
- `GET /api/agents/:id/openclaw`, `GET /api/agents/runtime`

Tasks:
- `GET/POST /api/tasks`, `GET/PATCH /api/tasks/:id`
- `POST /api/tasks/:id/dispatch`, `POST /api/tasks/:id/subagent`
- `POST /api/tasks/:id/test`, `POST /api/tasks/:id/progress-request`
- `GET /api/tasks/:id/activities`, `GET /api/tasks/:id/deliverables`
- `GET/POST /api/tasks/:id/planning`, `POST /api/tasks/:id/planning/answer`
- `POST /api/tasks/:id/planning/approve`

Lead Orchestration:
- `POST /api/lead/tasks/intake`, `GET /api/lead/queue`
- `POST /api/lead/commands`
- `POST /api/lead/tasks/:id/delegate`, `GET /api/lead/tasks/:id/findings`
- `POST /api/lead/tasks/:id/approval-request`, `POST /api/lead/tasks/:id/approval-decision`
- `GET /api/lead/tasks/:id/decision-log`
- `GET /api/lead/memory/packet`

Evals:
- `GET/POST /api/evals/specs`, `GET /api/evals/specs/:id`
- `POST /api/evals/run`, `GET /api/evals/task/:task_id`
- `GET /api/evals/agent/:agent_id/profile`

Learning:
- `POST /api/learning/questions/generate`, `GET /api/learning/questions/latest`
- `POST /api/learning/questions/:id/answer`, `GET /api/learning/history`

Costs:
- `GET /api/costs/overview`, `GET /api/costs/telemetry`

OpenClaw:
- `GET /api/openclaw/status`, `GET /api/openclaw/config`
- `GET/POST /api/openclaw/sessions`, `GET /api/openclaw/sessions/:id`
- `GET /api/openclaw/sessions/:id/history`
- `GET/POST /api/openclaw/cron`, `GET /api/openclaw/cron/:id`

Outreach:
- `GET/POST /api/outreach/campaigns`, `GET /api/outreach/campaigns/:id`
- `POST /api/outreach/campaigns/:id/run`
- `GET /api/outreach/campaigns/:id/leads`
- `GET /api/outreach/sites`, `GET /api/outreach/sites/:id`
- `GET /api/outreach/templates`

Files:
- `GET /api/files/download`, `GET /api/files/preview`
- `POST /api/files/upload`, `POST /api/files/reveal`

Vault:
- `GET /api/vault/tree`, `GET /api/vault/file`
- `GET /api/vault/search`, `GET /api/vault/graph`
- `POST /api/vault/index`

Pulse:
- `GET /api/pulse/unfinished`, `GET /api/pulse/activity`
- `GET/PATCH /api/pulse/checklist`

Events & Memory:
- `GET /api/events`, `GET /api/events/stream` (SSE)
- `GET /api/memory/operator`, `GET /api/memory/packet`

Webhooks:
- `POST /api/webhooks/agent-completion`

## How iOS Communicates

iOS app → mobile-api (Express). Uses Bearer token auth. Base URL configured in `APIClient.swift`. Does NOT talk to sales-dashboard or admin-panel directly.
