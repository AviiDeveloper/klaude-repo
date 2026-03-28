# Production Agent System — Self-Improving Autonomous Multi-Agent Orchestration

## What changed

### New files
- `apps/mission-control/src/lib/production-agent-profiles.ts` — 11 production agent profiles (Charlie, Scout, Builder, Inspector, Sentinel, Trainer, Examiner, Arbiter, Treasurer, Analyst, Auditor)
- `apps/mission-control/scripts/seed-production-agents.ts` — Idempotent agent seeding script using factory
- `apps/mission-control/src/lib/production-pipelines.ts` — 5 autonomous pipeline DAGs
- `apps/mission-control/src/lib/agent-self-improvement.ts` — Performance-driven reference sheet revision proposals
- `apps/mission-control/src/lib/approval-policy.ts` — Auto vs manual approval configuration
- `src/pipeline/productionHandlers.ts` — 10 agent execution handlers with memory integration

### Modified files
- `apps/mission-control/src/lib/evals.ts` — Failure-driven learning questions + self-improvement trigger on eval fail
- `apps/mission-control/src/lib/learning.ts` — `generateLearningQuestionFromFailure()` for agent_error/input_gap/mixed faults
- `apps/mission-control/src/lib/db/migrations.ts` — Migration 017: agent schedule columns (budget_limit_usd, schedule_type, schedule_config)
- `src/pipeline/engine.ts` — Completion hook registry for cross-pipeline triggers
- `src/index.ts` — Register production handlers, wire Sentinel→Training cross-pipeline trigger

## Why
Transform the platform from disconnected components into a genuine autonomous system where 11 agents coordinate without human intervention (except for model deployments), learn from failures, and self-improve through memory-driven decisions and reference sheet revisions.

## Stack
TypeScript, SQLite, Next.js, better-sqlite3, agent factory system

## Integrations
- Agent factory (6-page professional dossiers)
- Memory system (FTS5 retrieval in handlers)
- Pipeline engine (DAG execution with approval gates)
- Learning system (failure-driven question generation)
- Evaluation system (triggers self-improvement)

## How to verify
1. All 11 agents visible at `http://100.93.24.14:3001/api/agents?workspace_id=default`
2. Each agent has READY reference sheet with full 6-page dossier
3. `npm run verify` — 202 pass, 1 pre-existing fail
4. Seed script idempotent: `cd apps/mission-control && npx tsx scripts/seed-production-agents.ts`
5. Pipeline definitions available for scheduler pickup

## Known issues
- Production handlers are stubs — return "ready" status but don't execute real business logic (API credentials needed)
- Pipeline definitions seeded but scheduler doesn't auto-create them yet (needs separate seed call)
- Self-improvement revision proposals require operator approval to activate (by design)
