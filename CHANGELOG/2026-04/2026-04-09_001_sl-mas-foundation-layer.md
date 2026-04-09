# SL-MAS Foundation Layer

**Date:** 2026-04-09
**Branch:** feat/sl-mas-foundation
**Audit score before:** 21/54 (39%)
**Audit score target:** D1, D2, D4 flipped from FAIL to PASS

## What changed

### New files
- `src/runtime/working-memory.ts` — Per-run scratchpad for inter-agent communication (WorkingMemory interface + InMemoryWorkingMemory)
- `src/runtime/agent-registry.ts` — Capability-based agent registry with metadata (cost, reflection, fallback, timeout)
- `src/runtime/pipeline-engine.ts` — Unified Pipeline Engine merging Orchestrator approval gates + PipelineEngine DAG execution
- `src/tests/masAudit.test.ts` — 15 audit tests for D1, D2, D4

### Modified files
- `src/events/bus.ts` — Added pipeline lifecycle event types + correlation_id on Event interface
- `src/events/sqliteBus.ts` — correlation_id column persisted to SQLite with index
- `src/agents/outreach/index.ts` — Added `registerOutreachAgentsWithRegistry()` with full capability metadata
- `src/index.ts` — Wired AgentCapabilityRegistry + UnifiedPipelineEngine alongside legacy pipeline

### Deprecated (retained for backward compat)
- `src/orchestrator/orchestrator.ts` — Replaced by UnifiedPipelineEngine
- `src/agents/codeAgent.ts` — Replaced by capability registry (requires_approval_for)
- `src/agents/opsAgent.ts` — Replaced by capability-based routing

## Why
Building the Self-Learning Multi-Agent System. Foundation layer provides:
1. **Working Memory** — agents in a pipeline run can share observations (Scout → Composer)
2. **Agent Capability Registry** — route by what agents can do, not by hardcoded name maps
3. **Unified Pipeline Engine** — single execution path with approval gates, reflection hooks, budget enforcement, working memory injection, correlation_id tracing

## Stack
- TypeScript, better-sqlite3, Node.js test runner

## Integrations
- SQLite event bus (correlation_id column)
- Pipeline store (existing schema, no migrations needed)

## How to verify
```bash
npm run verify                          # 203 tests, 0 failures
npx tsx --test src/tests/masAudit.test.ts  # 15 audit-specific tests
```

Check specific audit dimensions:
- D1: `AgentCapabilityRegistry.findByCapability()` routes by capability
- D2: `InMemoryWorkingMemory` enables inter-agent communication
- D4: Working memory per-run isolation + SQLite persistence

## Known issues
- Legacy Orchestrator still used by InterfaceController (migration deferred)
- MissionControlServer still uses old PipelineEngine (will be migrated in Evaluation layer)
- Reflection hook interface exists but no CriticModel yet (next: Evaluation layer)
