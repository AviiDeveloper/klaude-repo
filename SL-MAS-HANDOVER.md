# SL-MAS Implementation Handover

## Branch: `feat/sl-mas-foundation`
**Created from:** `claude/determined-spence` (current worktree)
**Date:** 2026-04-09
**Reference docs:** `/Users/Avii/Desktop/full_production_context/self-learning-mas/`

---

## What exists today (on `claude/determined-spence`)

### Working pipeline
```
Scout → Profiler → Brand Analyser → Brand Intelligence → Qualifier → Assigner
```
- **Scout:** Google Places multi-vertical search + Place Details enrichment (photos, phone, reviews, hours, price level, description)
- **Profiler:** Website scraping (Playwright), Instagram scraping (Apify), merges scout data
- **Brand Analyser:** Photo colour palette from ALL images, font detection, asset inventory
- **Brand Intelligence:** AI analysis via OpenRouter (tone, personality, USPs, headline, services)
- **Qualifier:** Vertical-weighted scoring, chain detection, premises check, new business signals
- **Assigner:** Postcode proximity (needs salespeople in DB)
- **Brief Generator, Site Composer, Site QA:** Code exists but not tested end-to-end with enriched data

### Infrastructure (keep all of this)
- `src/lib/logger.ts` — structured JSON logging
- `src/lib/envValidator.ts` — startup env validation
- `src/lib/sqliteDefaults.ts` — WAL mode, pragmas
- `src/lib/rateLimiter.ts` — sliding window rate limiter
- `src/lib/circuitBreaker.ts` — external API circuit breaker
- `src/lib/concurrency.ts` — `pLimit(n)` concurrency limiter
- `src/lib/validate.ts` — input validation helpers
- `src/events/sqliteBus.ts` — persistent event bus (SQLite-backed)
- `src/missionControl/authMiddleware.ts` — bearer token auth
- `src/learning/decisionStore.ts` — decision journal (precursor to episodic memory)
- `src/learning/learningAgent.ts` — `withLearning()` wrapper (precursor to reflection loop)

### API keys configured
- `OPENROUTER_API_KEY` — Claude/GPT for AI generation + brand intelligence
- `GOOGLE_PLACES_API_KEY` — lead scouting + Place Details
- `APIFY_API_TOKEN` — Instagram profile scraping

### Test suite
- 188 tests passing
- `npm run verify` = typecheck + build + test

---

## What needs to be built (the SL-MAS blueprint)

### Architecture: Four Layers

```
Layer 4: HUMAN INTERFACE — Telegram, Mission Control, approval gates
Layer 3: TRAINING — LoRA fine-tuning, model registry, A/B testing (Phase 3+)
Layer 2: EVALUATION — Critic model, reflection loop, attribution, strategy ranker
Layer 1: RUNTIME — Unified engine, agent registry, dynamic planner, memory system
```

### Implementation order (dependency graph)

```
FOUNDATION (build first, no dependencies):
  ├── 1. Unified Pipeline Engine
  ├── 2. Working Memory
  └── 3. Agent Capability Registry

EVALUATION (requires Foundation):
  ├── 4. Critic Model (HeuristicCritic first)
  ├── 5. Reflection Loop
  └── 6. Episodic Memory

STRATEGY (requires Evaluation):
  ├── 7. Attribution Engine
  ├── 8. Strategy Ranker (nightly)
  └── 9. Strategic Memory + prompt injection

TRAINING (requires 1000+ outcomes, Phase 3+):
  ├── 10. Training Data Builder
  ├── 11. LoRA pipeline (Vast.ai)
  ├── 12. Model Registry + A/B testing
  └── 13. LoRA hot-swap
```

---

## FOUNDATION: Component Specs

### 1. Unified Pipeline Engine

**What:** Replace the dual system (Orchestrator in `src/orchestrator/` + PipelineEngine in `src/pipeline/engine.ts`) with one engine.

**Why:** Currently two separate execution paths. Orchestrator has approval gates but no DAG. PipelineEngine has DAG but weak approval. They don't share memory or events.

**Where:** `src/runtime/pipeline-engine.ts` (new)

**Key interface:**
```typescript
interface UnifiedPipelineEngine {
  startRun(input: StartRunInput): Promise<PipelineRun>;
  resumeRun(runId: string, approvalToken?: ApprovalToken): Promise<PipelineRun>;
  cancelRun(runId: string, reason: string): Promise<void>;
  evaluateNodeOutput(runId: string, nodeId: string): Promise<CriticEvaluation>;
  getWorkingMemory(runId: string): WorkingMemory;
  getRelevantStrategies(vertical: string, region?: string): StrategyEntry[];
}

interface StartRunInput {
  definitionId: string;
  trigger: "scheduler" | "manual" | "retry" | "replan";
  priority?: number;
  memoryContext?: StrategyEntry[];
  parentRunId?: string;  // for replan chains
  correlationId?: string;  // distributed tracing
}
```

**What changes from current:**
- Approval gate logic integrated (from Orchestrator)
- Reflection loop invoked after each node (if `reflection_enabled`)
- Working memory created per run, passed to each agent
- Strategy memory injected into agent inputs
- `correlation_id` on all events
- Priority-based scheduling
- Replanning on failure via Dynamic Planner

**Existing code to reuse:**
- `src/pipeline/engine.ts` — DAG execution logic (`executeRun`, `listRunnableNodes`, `blockDependents`)
- `src/pipeline/sqlitePipelineStore.ts` — all the SQLite schema (keep as-is, add new tables)
- `src/pipeline/agentRuntime.ts` — `MultiAgentRuntime` handler registry (evolves into Agent Registry)

**Existing code to retire:**
- `src/orchestrator/orchestrator.ts` — hardcoded 3-step plans, CodeAgent/OpsAgent alternation
- `src/agents/codeAgent.ts` — keyword-based approval detection
- `src/agents/opsAgent.ts` — pure delegation stub

### 2. Working Memory

**What:** Per-run scratchpad that all agents in a pipeline run can read/write.

**Why:** Currently agents can only communicate via artifacts passed forward in the DAG. No way for Scout to tell Composer "this business has a strong Instagram presence, emphasise social proof."

**Where:** `src/runtime/working-memory.ts` (new)

**Key interface:**
```typescript
interface WorkingMemory {
  runId: string;
  set(key: string, value: unknown): void;
  get<T>(key: string): T | undefined;
  setForAgent(agentId: string, key: string, value: unknown): void;
  getFromAgent(agentId: string, key: string): unknown;
  addNote(note: string, author: string): void;
  getNotes(): Array<{ note: string; author: string; timestamp: string }>;
  flush(): Promise<void>;  // persist to episodes table
  snapshot(): Record<string, unknown>;
}
```

**Implementation:** In-memory Map during run, flushed to SQLite `episodes.working_memory_json` on completion.

**How agents use it:**
```typescript
// AgentExecutionInput gains two new fields:
interface AgentExecutionInput {
  // ... existing fields ...
  workingMemory: WorkingMemory;
  strategyContext: StrategyEntry[];
}
```

**Example usage:**
- Scout: `workingMemory.set("instagram_followers", 54000)` → Composer sees this and emphasises social proof
- Profiler: `workingMemory.addNote("strong food photography on Instagram", "lead-profiler")` → Brief Generator reads notes
- Qualifier: `workingMemory.setForAgent("lead-qualifier", "top_objection", "already has website")` → Brief tailors copy

### 3. Agent Capability Registry

**What:** Replace hardcoded agent names with capability-based routing.

**Why:** Currently `agentRuntime.register("lead-scout-agent", handler)` is a name→function map. No metadata about what agents can do, what they cost, or when to use them.

**Where:** `src/runtime/agent-registry.ts` (new)

**Key interface:**
```typescript
interface AgentCapability {
  id: string;
  name: string;
  description: string;
  capabilities: string[];  // ["html_generation", "lead_scoring", "data_scraping"]
  requires_approval_for: string[];
  model_provider: "claude" | "openrouter" | "local" | "custom_lora";
  max_retries: number;
  timeout_ms: number;
  cost_per_run_estimate_usd: number;
  reflection_enabled: boolean;
  fallback_agent_id?: string;
}
```

**Register existing agents:**
```typescript
registry.register({
  id: "lead-scout-agent",
  name: "Lead Scout",
  capabilities: ["lead_discovery", "data_scraping", "google_places"],
  cost_per_run_estimate_usd: 0.05,
  reflection_enabled: false,  // scouting doesn't need critique
  timeout_ms: 60000,
  // ...
});

registry.register({
  id: "site-composer-agent",
  name: "Site Composer",
  capabilities: ["html_generation", "css_generation", "responsive_design"],
  cost_per_run_estimate_usd: 0.15,
  reflection_enabled: true,  // critic should evaluate generated sites
  fallback_agent_id: "site-composer-template-agent",
  // ...
});
```

---

## EVALUATION: Component Specs

### 4. Critic Model

**What:** Scores agent outputs to predict "will this close a sale?"

**Why:** Currently no quality scoring. QA agent checks HTML validity but not business quality.

**Where:** `src/evaluation/critic-model.ts` (new)

**Three implementations (swap via config):**

```typescript
interface CriticModel {
  evaluate(input: CriticInput): Promise<CriticEvaluation>;
  getActiveModelVersion(): string;
  swapModel(newVersionId: string): Promise<void>;
}

interface CriticEvaluation {
  score: number;  // 0.0-1.0
  prediction: "likely_close" | "unlikely_close" | "uncertain";
  critique: {
    strengths: string[];
    weaknesses: string[];
    specific_suggestions: string[];
  };
  confidence: number;
  model_version: string;
}
```

**Phase 1 — HeuristicCritic (build now, no ML):**
Rule-based scoring: has_reviews (+0.1), has_gallery (+0.05), brand_colors_real (+0.1), hero_image_quality (+0.1), etc. Use as baseline.

**Phase 2 — LLMCritic (when testing with real pitches):**
Claude API call with screenshot + metadata. Expensive but smart.

**Phase 3 — TrainedCritic (when 1000+ outcomes exist):**
CLIP ViT-L/14 + LoRA fine-tuned on close-rate data. The competitive moat.

### 5. Reflection Loop

**What:** Wraps agent execution with critique→retry cycle.

**Why:** Currently if Site Composer generates a bad site, it passes through. No feedback loop.

**Where:** `src/evaluation/reflection-loop.ts` (new)

```typescript
// Agent runs → Critic scores → Below threshold? → Inject critique → Retry
interface ReflectionLoop {
  executeWithReflection(input: ReflectionInput): Promise<ReflectionOutput>;
}

interface ReflectionOutput {
  finalOutput: AgentExecutionOutput;
  iterations: ReflectionIteration[];
  accepted: boolean;
  finalScore: number;
}
```

**Config:** `CRITIC_THRESHOLD=0.7`, `CRITIC_MAX_RETRIES=3`

**How it works:**
1. Agent produces output
2. Critic evaluates: score + critique (strengths, weaknesses, suggestions)
3. If score >= 0.7: accept, continue pipeline
4. If score < 0.7 and attempts < 3: inject critique into agent input, retry
5. If score < 0.7 and attempts >= 3: force accept best output, flag for human review

### 6. Episodic Memory

**What:** Records every pipeline run with all context, later linked to pitch outcomes.

**Why:** The `decisions` table in DecisionStore is per-agent. We need per-run records that capture the full story.

**Where:** `src/memory/episodic-store.ts` (new)

**SQL schema:**
```sql
CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  pipeline_run_id TEXT NOT NULL UNIQUE,
  pipeline_definition_id TEXT NOT NULL,
  lead_id TEXT,
  business_name TEXT,
  vertical TEXT,
  region TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  total_cost_usd REAL DEFAULT 0,
  reflection_iterations INTEGER DEFAULT 0,
  agent_outputs_json TEXT,
  critic_scores_json TEXT,
  working_memory_json TEXT,
  strategies_used_json TEXT,
  plan_json TEXT,
  -- Outcome (filled later when pitch result arrives)
  pitch_outcome TEXT,  -- closed | rejected | no_show
  outcome_received_at TEXT,
  close_amount_gbp REAL,
  salesperson_id TEXT,
  days_to_outcome REAL,
  attribution_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Existing code to evolve:**
- `src/learning/decisionStore.ts` → per-agent decisions feed into episodes
- `src/learning/learningAgent.ts` → `withLearning()` becomes part of reflection loop

---

## STRATEGY: Component Specs

### 7. Attribution Engine

**What:** When a pitch outcome arrives, traces credit/blame back through the pipeline.

**Where:** `src/evaluation/attribution-engine.ts` (new)

**How:** Each agent's output was scored by the critic. Attribution weight = critic score × outcome.

### 8. Strategy Ranker (nightly)

**What:** Analyses all episodes with outcomes, groups by design parameters, calculates close rates.

**Where:** `src/evaluation/strategy-ranker.ts` (new)

**Strategy lifecycle:** new → testing (20+ pitches) → active (significant result) → champion (best for vertical) → deprecated (underperforms 2 cycles)

### 9. Strategic Memory

**What:** Cross-run knowledge: "barbers with trust-blue hero and reviews close at 41%"

**Where:** `src/memory/strategic-store.ts` (new)

**SQL schema:**
```sql
CREATE TABLE strategies (
  id TEXT PRIMARY KEY,
  vertical TEXT NOT NULL,
  region TEXT,
  strategy_type TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  sample_size INTEGER DEFAULT 0,
  close_rate REAL,
  confidence_lower REAL,
  confidence_upper REAL,
  status TEXT NOT NULL DEFAULT 'new',
  last_evaluated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**How agents use strategies:**
Injected into agent prompts via `strategyContext` field. Not forced — agents see "this approach works 41% of the time" and factor it into decisions.

---

## Files to create

```
src/runtime/
  pipeline-engine.ts      — Unified Pipeline Engine
  working-memory.ts       — Per-run scratchpad
  agent-registry.ts       — Capability-based agent registry

src/evaluation/
  critic-model.ts         — CriticModel interface + HeuristicCritic
  reflection-loop.ts      — Critique→retry wrapper
  attribution-engine.ts   — Outcome→agent credit/blame
  strategy-ranker.ts      — Nightly strategy analysis

src/memory/
  episodic-store.ts       — Episode recording + outcome attachment
  strategic-store.ts      — Strategy CRUD + lifecycle management
```

## Files to modify

```
src/index.ts                    — Wire new components, retire Orchestrator
src/pipeline/agentRuntime.ts    — Evolve into Agent Registry
src/pipeline/engine.ts          — Merge approval + reflection into execution
src/events/sqliteBus.ts         — Add correlation_id support
src/agents/outreach/*.ts        — Accept WorkingMemory + strategyContext in input
```

## Files to retire

```
src/orchestrator/orchestrator.ts  — Replaced by Unified Pipeline Engine
src/agents/codeAgent.ts           — No longer needed
src/agents/opsAgent.ts            — No longer needed
src/caller/callerModel.ts         — Replaced by Dynamic Planner (later)
```

---

## Current audit score: 21/54 (39%)

Target with Foundation + Evaluation layers: **~38/54 (70%)**

| Dimension | Now | After Foundation+Evaluation |
|-----------|-----|---------------------------|
| D1 Agent Autonomy | 1/4 | 3/4 |
| D2 Communication | 2/5 | 4/5 |
| D3 Planning | 0/3 | 1/3 (basic replan) |
| D4 Memory | 2/5 | 4/5 |
| D5 Self-Evaluation | 0/3 | 2/3 |
| D6 Learning | 0/4 | 2/4 |
| D7 Error Recovery | 2/5 | 3/5 |
| D8 Observability | 3/5 | 4/5 |
| D9 Safety | 4/7 | 5/7 |
| D10 Resources | 2/4 | 3/4 |
| D11 Scalability | 2/5 | 3/5 |
| D12 Human-in-Loop | 2/4 | 3/4 |

---

## How to verify progress

Run the audit test battery:
```bash
npx tsx tests/masAudit.test.ts
```

Each dimension has specific test cases. As components are built, tests flip from FAIL-EXPECTED to PASS.

---

## Key env vars needed

```bash
OPENROUTER_API_KEY=sk-or-v1-...     # AI generation + brand intelligence
GOOGLE_PLACES_API_KEY=AIzaSy...     # Lead scouting + Place Details
APIFY_API_TOKEN=apify_api_...       # Instagram scraping
CRITIC_IMPLEMENTATION=heuristic     # heuristic | llm | trained
CRITIC_THRESHOLD=0.7                # Minimum score to accept
CRITIC_MAX_RETRIES=3                # Reflection loop iterations
```

---

## Reference documents

All at `/Users/Avii/Desktop/full_production_context/self-learning-mas/`:

| Doc | What it contains |
|-----|-----------------|
| `00_MASTER_REFERENCE.md` | Complete architecture, all interfaces, implementation guide |
| `01_AUDIT_SCORECARD.md` | 54-test audit with current scores and fix instructions |
| `02_COMPONENT_SPECS.md` | TypeScript interfaces for every component |
| `03_DATA_FLOWS.md` | Event types, data flow diagrams |
| `04_TRAINING_LOOP.md` | LoRA training pipeline spec (Phase 3+) |
| `05_MEMORY_ARCHITECTURE.md` | Three-tier memory SQL schemas + lifecycle |
| `06_COMPARISON_MATRIX.md` | SOTA comparison against other MAS frameworks |

**Read `00_MASTER_REFERENCE.md` first.** It's the single source of truth.
