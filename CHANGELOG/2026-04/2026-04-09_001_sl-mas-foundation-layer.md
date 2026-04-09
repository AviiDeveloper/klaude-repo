# SL-MAS Foundation + Evaluation Layers

**Date:** 2026-04-09
**Branch:** feat/sl-mas-foundation
**Audit score before:** 21/54 (39%)
**Audit dimensions flipped:** D1, D2, D4, D5, D6

## What changed

### Foundation Layer (new files)
- `src/runtime/working-memory.ts` — Per-run scratchpad for inter-agent communication
- `src/runtime/agent-registry.ts` — Capability-based agent registry with metadata (cost, reflection, fallback)
- `src/runtime/pipeline-engine.ts` — Unified Pipeline Engine merging Orchestrator + PipelineEngine

### Evaluation Layer (new files)
- `src/evaluation/critic-model.ts` — LLM Critic (Claude via OpenRouter) + HeuristicCritic fallback. Evaluates agent outputs for sales effectiveness with structured critique.
- `src/evaluation/reflection-loop.ts` — Critique→retry cycle. Critic's suggestions injected back into agent input. Max 3 iterations, force-accept with human review flag.
- `src/memory/episodic-store.ts` — SQLite store recording complete pipeline run context. Supports outcome attachment for learning.

### Test battery
- `src/tests/masAudit.test.ts` — 25 audit tests covering D1, D2, D4, D5, D6

### Modified files
- `src/events/bus.ts` — Pipeline lifecycle events + correlation_id
- `src/events/sqliteBus.ts` — correlation_id persisted with index
- `src/agents/outreach/index.ts` — `registerOutreachAgentsWithRegistry()` with capability metadata
- `src/index.ts` — Wired AgentCapabilityRegistry, UnifiedPipelineEngine, LLM Critic, EpisodicStore

### Deprecated (retained for backward compat)
- `src/orchestrator/orchestrator.ts` — Replaced by UnifiedPipelineEngine
- `src/agents/codeAgent.ts` — Replaced by capability registry
- `src/agents/opsAgent.ts` — Replaced by capability-based routing

## Why
Building a genuine Self-Learning Multi-Agent System. The Evaluation layer makes the system AI-native:
1. **LLM Critic** — Claude reviews every agent output like a creative director
2. **Reflection Loop** — bad output gets specific feedback and retries automatically
3. **Episodic Memory** — every run recorded with full context for future learning

## Stack
- TypeScript, better-sqlite3, OpenRouter API (Claude Sonnet 4), Node.js test runner

## Integrations
- OpenRouter API for LLM Critic (OPENROUTER_API_KEY)
- SQLite episodic store (new `episodes` table)
- SQLite event bus (correlation_id column)

## How to verify
```bash
npm run verify                              # 213 tests, 0 failures
npx tsx --test src/tests/masAudit.test.ts   # 25 audit tests
```

## Known issues
- Legacy Orchestrator still used by InterfaceController (migration deferred)
- MissionControlServer still uses old PipelineEngine (will be migrated)
- Outreach agents don't read/write working memory yet (per-agent update needed)
- Strategy layer not yet built (Attribution Engine, Strategy Ranker)
