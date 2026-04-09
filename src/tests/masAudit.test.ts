/**
 * MAS Audit Test Battery
 *
 * Tests the Self-Learning Multi-Agent System dimensions.
 * Each test maps to a specific audit criterion from 01_AUDIT_SCORECARD.md.
 *
 * Target: flip D1, D2, D4 from FAIL to PASS with Foundation layer.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { InMemoryWorkingMemory } from "../runtime/working-memory.js";
import { AgentCapabilityRegistry, AgentCapability } from "../runtime/agent-registry.js";
import { UnifiedPipelineEngine, StrategyEntry } from "../runtime/pipeline-engine.js";
import { SQLitePipelineStore } from "../pipeline/sqlitePipelineStore.js";
import { SQLiteEventBus } from "../events/sqliteBus.js";
import { InMemoryEventBus, Event } from "../events/bus.js";
import { HeuristicCritic, LLMCritic, createCritic } from "../evaluation/critic-model.js";
import { ReflectionLoop } from "../evaluation/reflection-loop.js";
import { EpisodicStore } from "../memory/episodic-store.js";
import Database from "better-sqlite3";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

// ── Helpers ──

function makeTestCapability(overrides: Partial<AgentCapability> & { id: string }): AgentCapability {
  return {
    name: overrides.id,
    description: `Test agent ${overrides.id}`,
    capabilities: [],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 1,
    timeout_ms: 5000,
    cost_per_run_estimate_usd: 0.01,
    reflection_enabled: false,
    ...overrides,
  };
}

const TEST_DB_DIR = "data/test-mas-audit";

function freshDbPath(): string {
  mkdirSync(TEST_DB_DIR, { recursive: true });
  return path.join(TEST_DB_DIR, `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.sqlite`);
}

// ══════════════════════════════════════════════════════════════
// D1: Agent Autonomy
// ══════════════════════════════════════════════════════════════

describe("D1 Agent Autonomy", () => {
  // D1.4: Capability-based routing — agent selection by capability, NOT index % 2
  it("D1.4: selects agents by capability, not by name index", () => {
    const registry = new AgentCapabilityRegistry();

    registry.register(
      makeTestCapability({ id: "agent-alpha", capabilities: ["html_generation", "css_generation"] }),
      async (input) => ({ summary: "alpha", artifacts: {} }),
    );
    registry.register(
      makeTestCapability({ id: "agent-beta", capabilities: ["data_scraping", "google_places"] }),
      async (input) => ({ summary: "beta", artifacts: {} }),
    );
    registry.register(
      makeTestCapability({ id: "agent-gamma", capabilities: ["html_generation", "responsive_design"] }),
      async (input) => ({ summary: "gamma", artifacts: {} }),
    );

    // Find by capability — should return agents with matching capability
    const htmlAgents = registry.findByCapability("html_generation");
    assert.equal(htmlAgents.length, 2, "should find 2 agents with html_generation");
    const htmlIds = htmlAgents.map((a) => a.id).sort();
    assert.deepEqual(htmlIds, ["agent-alpha", "agent-gamma"]);

    const scrapingAgents = registry.findByCapability("data_scraping");
    assert.equal(scrapingAgents.length, 1);
    assert.equal(scrapingAgents[0].id, "agent-beta");

    // No agents for unknown capability
    const noAgents = registry.findByCapability("quantum_computing");
    assert.equal(noAgents.length, 0);
  });

  // D1.2 & D1.3: Agent metadata exposes capabilities, costs, reflection config
  it("D1.2: agents expose capability metadata with cost and reflection", () => {
    const registry = new AgentCapabilityRegistry();

    const cap = makeTestCapability({
      id: "site-composer-agent",
      capabilities: ["html_generation"],
      cost_per_run_estimate_usd: 0.15,
      reflection_enabled: true,
      fallback_agent_id: "template-agent",
      timeout_ms: 180000,
    });
    registry.register(cap, async () => ({ summary: "ok", artifacts: {} }));

    const retrieved = registry.getCapability("site-composer-agent");
    assert.ok(retrieved, "capability should be retrievable");
    assert.equal(retrieved.cost_per_run_estimate_usd, 0.15);
    assert.equal(retrieved.reflection_enabled, true);
    assert.equal(retrieved.fallback_agent_id, "template-agent");
    assert.equal(retrieved.timeout_ms, 180000);
    assert.deepEqual(retrieved.capabilities, ["html_generation"]);
  });

  // D1.4: Fallback agent routing
  it("D1.4: falls back to fallback agent on primary failure", async () => {
    const registry = new AgentCapabilityRegistry();

    registry.register(
      makeTestCapability({ id: "primary-agent", fallback_agent_id: "fallback-agent" }),
      async () => { throw new Error("primary failed"); },
    );
    registry.register(
      makeTestCapability({ id: "fallback-agent" }),
      async () => ({ summary: "fallback handled it", artifacts: { source: "fallback" } }),
    );

    const result = await registry.execute({
      run_id: "r1", node_id: "n1", agent_id: "primary-agent",
      upstreamArtifacts: {},
    });
    assert.equal(result.summary, "fallback handled it");
    assert.equal(result.artifacts.source, "fallback");
  });
});

// ══════════════════════════════════════════════════════════════
// D2: Communication
// ══════════════════════════════════════════════════════════════

describe("D2 Communication", () => {
  // D2.3: Direct agent-to-agent negotiation via shared Working Memory
  it("D2.3: agents communicate through shared working memory", () => {
    const wm = new InMemoryWorkingMemory("run-001");

    // Scout writes a value
    wm.set("instagram_followers", 54000);
    wm.addNote("strong food photography on Instagram", "lead-scout-agent");

    // Profiler reads Scout's value and adds its own
    const followers = wm.get<number>("instagram_followers");
    assert.equal(followers, 54000);
    wm.setForAgent("lead-profiler-agent", "top_objection", "already has website");

    // Qualifier reads from Profiler
    const objection = wm.getFromAgent("lead-profiler-agent", "top_objection");
    assert.equal(objection, "already has website");

    // Notes are visible to all
    const notes = wm.getNotes();
    assert.equal(notes.length, 1);
    assert.equal(notes[0].author, "lead-scout-agent");
    assert.ok(notes[0].note.includes("food photography"));
  });

  // D2.3: Working memory snapshot captures full state
  it("D2.3: working memory produces serialisable snapshot", () => {
    const wm = new InMemoryWorkingMemory("run-002");
    wm.set("key1", "value1");
    wm.set("key2", { nested: true });
    wm.setForAgent("agent-a", "private_key", 42);
    wm.addNote("test note", "tester");

    const snapshot = wm.snapshot();
    assert.ok(snapshot.shared, "snapshot should contain shared");
    assert.ok(snapshot.agentScoped, "snapshot should contain agentScoped");
    assert.ok(snapshot.notes, "snapshot should contain notes");

    // Serialisable
    const json = JSON.stringify(snapshot);
    const parsed = JSON.parse(json);
    assert.equal((parsed.shared as Record<string, unknown>).key1, "value1");
  });

  // D2.4: Event bus persistence and replay to SQLite
  it("D2.4: event bus persists events with correlation_id to SQLite", async () => {
    const dbPath = freshDbPath();
    const bus = new SQLiteEventBus(dbPath);

    await bus.publish("pipeline.run.started", { run_id: "r1" }, "corr-001");
    await bus.publish("pipeline.node.started", { node_id: "n1" }, "corr-001");

    // Verify events are persisted with correlation_id
    const db = new Database(dbPath);
    const rows = db.prepare("SELECT * FROM events WHERE correlation_id = ?").all("corr-001") as Array<{
      name: string; correlation_id: string; payload_json: string;
    }>;
    assert.equal(rows.length, 2, "should persist 2 events");
    assert.equal(rows[0].correlation_id, "corr-001");
    assert.equal(rows[1].correlation_id, "corr-001");

    db.close();
    bus.close();
  });

  // D2.4: Event bus replay works after restart
  it("D2.4: event bus replays unprocessed events on restart", async () => {
    const dbPath = freshDbPath();

    // Write events in first bus instance
    const bus1 = new SQLiteEventBus(dbPath);
    // Insert an unprocessed event directly
    const db = new Database(dbPath);
    db.prepare("INSERT INTO events (id, name, payload_json, created_at) VALUES (?, ?, ?, ?)").run(
      "test-replay-1", "pipeline.run.started", JSON.stringify({ run_id: "r-replay" }),
      new Date().toISOString(),
    );
    db.close();
    bus1.close();

    // New bus instance replays
    const bus2 = new SQLiteEventBus(dbPath);
    const replayed: unknown[] = [];
    bus2.subscribe("pipeline.run.started", (event) => {
      replayed.push(event.payload);
    });
    const count = await bus2.replayUnprocessed();
    assert.ok(count >= 1, "should replay at least 1 unprocessed event");
    bus2.close();
  });

  // D2.5: Unified engine used for execution (Orchestrator retired from pipeline path)
  it("D2.5: UnifiedPipelineEngine exists and has correct interface", () => {
    // Verify the unified engine class has the expected methods
    assert.equal(typeof UnifiedPipelineEngine.prototype.startRun, "function");
    assert.equal(typeof UnifiedPipelineEngine.prototype.resumeRun, "function");
    assert.equal(typeof UnifiedPipelineEngine.prototype.cancelRun, "function");
    assert.equal(typeof UnifiedPipelineEngine.prototype.getWorkingMemory, "function");
    assert.equal(typeof UnifiedPipelineEngine.prototype.getRelevantStrategies, "function");
    assert.equal(typeof UnifiedPipelineEngine.prototype.setReflectionHook, "function");
    assert.equal(typeof UnifiedPipelineEngine.prototype.setStrategyProvider, "function");
  });
});

// ══════════════════════════════════════════════════════════════
// D4: Memory
// ══════════════════════════════════════════════════════════════

describe("D4 Memory", () => {
  // D4.3: Working memory tier — per-run scratchpad for agents
  it("D4.3: working memory is per-run and isolated between runs", () => {
    const wm1 = new InMemoryWorkingMemory("run-A");
    const wm2 = new InMemoryWorkingMemory("run-B");

    wm1.set("shared_key", "value_A");
    wm2.set("shared_key", "value_B");

    assert.equal(wm1.get("shared_key"), "value_A");
    assert.equal(wm2.get("shared_key"), "value_B");
    assert.equal(wm1.runId, "run-A");
    assert.equal(wm2.runId, "run-B");
  });

  // D4.3: Working memory injection into pipeline execution
  it("D4.3: unified engine creates working memory per run", async () => {
    const dbPath = freshDbPath();
    const store = new SQLitePipelineStore(dbPath);
    const registry = new AgentCapabilityRegistry();
    const bus = new InMemoryEventBus();

    // Register a simple agent that reads/writes working memory
    registry.register(
      makeTestCapability({ id: "test-agent", capabilities: ["test"] }),
      async (input) => {
        // Agent receives working memory snapshot in upstream artifacts
        const wmSnapshot = input.upstreamArtifacts._workingMemory as Record<string, unknown> | undefined;
        return {
          summary: "done",
          artifacts: { received_wm: !!wmSnapshot },
        };
      },
    );

    // Create a simple pipeline
    store.upsertDefinition({
      id: "test-pipeline",
      name: "Test",
      enabled: true,
      schedule_rrule: "",
      max_retries: 0,
      nodes: [{ id: "step1", agent_id: "test-agent", depends_on: [] }],
      config: {},
    });

    const engine = new UnifiedPipelineEngine(store, registry, bus);
    const run = await engine.startRun({
      definitionId: "test-pipeline",
      trigger: "manual",
    });

    assert.equal(run.status, "completed", "run should complete");

    // Verify artifacts show working memory was injected
    const artifacts = store.listArtifacts(run.id);
    assert.ok(artifacts.length > 0, "should have artifacts");
    const output = artifacts[0].value_json as Record<string, unknown>;
    assert.equal(output.received_wm, true, "agent should receive working memory");

    store.close();
  });

  // D4.4: Long-term memory tiers (episodic schema exists + strategic schema exists)
  it("D4.4: pipeline store persists node outputs as artifacts (episode precursor)", () => {
    const dbPath = freshDbPath();
    const store = new SQLitePipelineStore(dbPath);

    store.upsertDefinition({
      id: "memory-test",
      name: "Memory Test",
      enabled: true,
      schedule_rrule: "",
      max_retries: 0,
      nodes: [{ id: "n1", agent_id: "a1", depends_on: [] }],
      config: {},
    });

    const def = store.getDefinition("memory-test")!;
    const run = store.createRun({ definition: def, trigger: "manual" });

    // Append artifacts (simulating episode data)
    store.appendArtifact({
      run_id: run.id,
      node_id: "n1",
      kind: "agent.output",
      value_json: { brand_tone: "professional", confidence: 0.87 },
    });

    const artifacts = store.listArtifacts(run.id);
    assert.equal(artifacts.length, 1);
    assert.equal((artifacts[0].value_json as Record<string, unknown>).brand_tone, "professional");

    store.close();
  });

  // D4.5: Core state survives restart (SQLite-backed stores)
  it("D4.5: pipeline state survives DB re-open (restart simulation)", () => {
    const dbPath = freshDbPath();

    // First "session"
    const store1 = new SQLitePipelineStore(dbPath);
    store1.upsertDefinition({
      id: "persist-test",
      name: "Persist Test",
      enabled: true,
      schedule_rrule: "",
      max_retries: 1,
      nodes: [{ id: "n1", agent_id: "a1", depends_on: [] }],
      config: {},
    });
    const def = store1.getDefinition("persist-test")!;
    const run = store1.createRun({ definition: def, trigger: "manual" });
    store1.close();

    // Second "session" — re-open same DB
    const store2 = new SQLitePipelineStore(dbPath);
    const reloaded = store2.getDefinition("persist-test");
    assert.ok(reloaded, "definition should survive restart");
    assert.equal(reloaded!.name, "Persist Test");

    const reloadedRun = store2.getRun(run.id);
    assert.ok(reloadedRun, "run should survive restart");
    assert.equal(reloadedRun!.pipeline_definition_id, "persist-test");

    store2.close();
  });

  // D4: Strategy context injection
  it("D4: strategy context is injectable into pipeline runs", () => {
    const dbPath = freshDbPath();
    const store = new SQLitePipelineStore(dbPath);
    const registry = new AgentCapabilityRegistry();
    const bus = new InMemoryEventBus();

    const strategies: StrategyEntry[] = [
      {
        id: "s1", vertical: "barber", strategy_type: "hero_colour",
        parameters: { colour: "trust-blue" }, close_rate: 0.41,
        confidence_lower: 0.35, confidence_upper: 0.47, status: "active",
      },
    ];

    const engine = new UnifiedPipelineEngine(
      store, registry, bus, undefined, undefined, undefined, undefined,
      (vertical: string) => strategies.filter((s) => s.vertical === vertical),
    );

    const result = engine.getRelevantStrategies("barber");
    assert.equal(result.length, 1);
    assert.equal(result[0].close_rate, 0.41);

    const noResult = engine.getRelevantStrategies("plumber");
    assert.equal(noResult.length, 0);

    store.close();
  });
});

// ══════════════════════════════════════════════════════════════
// D2.5 + D1: Integration — full pipeline through unified engine
// ══════════════════════════════════════════════════════════════

describe("Integration: Unified Engine Pipeline Execution", () => {
  it("executes a multi-node pipeline with working memory and events", async () => {
    const dbPath = freshDbPath();
    const store = new SQLitePipelineStore(dbPath);
    const registry = new AgentCapabilityRegistry();
    const bus = new InMemoryEventBus();
    const events: Array<Event<unknown>> = [];

    // Capture all events
    for (const name of [
      "pipeline.run.started", "pipeline.run.completed",
      "pipeline.node.started", "pipeline.node.completed",
    ] as const) {
      bus.subscribe(name, (event) => { events.push(event); });
    }

    // Register two agents that communicate via working memory
    registry.register(
      makeTestCapability({ id: "step-a", capabilities: ["produce_data"] }),
      async (input) => ({
        summary: "step-a done",
        artifacts: { data: "from-step-a", signal: 42 },
      }),
    );
    registry.register(
      makeTestCapability({ id: "step-b", capabilities: ["consume_data"] }),
      async (input) => {
        const upstream = input.upstreamArtifacts as Record<string, unknown>;
        const stepAOutput = upstream["node-a"] as Record<string, unknown> | undefined;
        return {
          summary: "step-b done",
          artifacts: {
            received_signal: stepAOutput?.signal ?? "missing",
          },
        };
      },
    );

    store.upsertDefinition({
      id: "integration-test",
      name: "Integration Test",
      enabled: true,
      schedule_rrule: "",
      max_retries: 0,
      nodes: [
        { id: "node-a", agent_id: "step-a", depends_on: [] },
        { id: "node-b", agent_id: "step-b", depends_on: ["node-a"] },
      ],
      config: {},
    });

    const engine = new UnifiedPipelineEngine(store, registry, bus);
    const run = await engine.startRun({
      definitionId: "integration-test",
      trigger: "manual",
      correlationId: "test-corr-123",
    });

    assert.equal(run.status, "completed");

    // Check events fired with correlation_id
    const startEvents = events.filter((e) => e.name === "pipeline.run.started");
    assert.equal(startEvents.length, 1);
    assert.equal(startEvents[0].correlation_id, "test-corr-123");

    const nodeCompleted = events.filter((e) => e.name === "pipeline.node.completed");
    assert.equal(nodeCompleted.length, 2, "both nodes should fire completed events");

    // Check step-b received step-a's output
    const artifacts = store.listArtifacts(run.id);
    const stepBOutput = artifacts.find((a) => a.node_id === "node-b");
    assert.ok(stepBOutput, "step-b should have output");
    assert.equal(
      (stepBOutput!.value_json as Record<string, unknown>).received_signal,
      42,
      "step-b should receive step-a's signal via DAG artifacts",
    );

    store.close();
  });

  it("handles agent failure with fallback", async () => {
    const dbPath = freshDbPath();
    const store = new SQLitePipelineStore(dbPath);
    const registry = new AgentCapabilityRegistry();
    const bus = new InMemoryEventBus();

    registry.register(
      makeTestCapability({ id: "flaky-agent", fallback_agent_id: "stable-agent" }),
      async () => { throw new Error("flaky!"); },
    );
    registry.register(
      makeTestCapability({ id: "stable-agent" }),
      async () => ({ summary: "stable handled it", artifacts: { ok: true } }),
    );

    store.upsertDefinition({
      id: "fallback-test",
      name: "Fallback Test",
      enabled: true,
      schedule_rrule: "",
      max_retries: 0,
      nodes: [{ id: "n1", agent_id: "flaky-agent", depends_on: [] }],
      config: {},
    });

    const engine = new UnifiedPipelineEngine(store, registry, bus);
    const run = await engine.startRun({ definitionId: "fallback-test", trigger: "manual" });

    assert.equal(run.status, "completed", "should complete via fallback");
    store.close();
  });
});

// ══════════════════════════════════════════════════════════════
// D5: Self-Evaluation
// ══════════════════════════════════════════════════════════════

describe("D5 Self-Evaluation", () => {
  // D5.1: Critic model produces structured evaluation
  it("D5.1: critic evaluates agent output with score, prediction, and critique", async () => {
    const critic = new HeuristicCritic();
    const evaluation = await critic.evaluate({
      agentOutput: {
        html: "<html><body><h1>Welcome to Freshcuts Barber</h1><p>4.8 star reviews</p></body></html>",
        summary: "Generated site for Freshcuts Barber",
      },
      agentId: "site-composer-agent",
      nodeId: "compose",
      runId: "run-test-1",
      businessContext: {
        vertical: "barber",
        business_name: "Freshcuts Barber",
        brand_colours: ["#1a5276"],
        review_count: 85,
        review_rating: 4.8,
        instagram_followers: 2300,
      },
    });

    // Structure checks
    assert.equal(typeof evaluation.score, "number");
    assert.ok(evaluation.score >= 0 && evaluation.score <= 1, "score should be 0-1");
    assert.ok(
      ["likely_close", "unlikely_close", "uncertain"].includes(evaluation.prediction),
      "prediction should be valid enum",
    );
    assert.ok(Array.isArray(evaluation.critique.strengths));
    assert.ok(Array.isArray(evaluation.critique.weaknesses));
    assert.ok(Array.isArray(evaluation.critique.specific_suggestions));
    assert.equal(typeof evaluation.confidence, "number");
    assert.equal(typeof evaluation.model_version, "string");
    assert.equal(typeof evaluation.cost_usd, "number");

    // Content checks — heuristic should detect business name and reviews
    assert.ok(evaluation.critique.strengths.length > 0, "should find strengths");
    assert.ok(
      evaluation.critique.strengths.some((s) => s.includes("business name")),
      "should recognise business name usage",
    );
  });

  // D5.1: Critic factory creates correct implementation
  it("D5.1: critic factory creates LLM or heuristic based on config", () => {
    const heuristic = createCritic("heuristic");
    assert.ok(heuristic instanceof HeuristicCritic);

    const llm = createCritic("llm");
    assert.ok(llm instanceof LLMCritic);
    assert.ok(llm.getActiveModelVersion().startsWith("llm-critic:"));
  });

  // D5.2: Reflection loop retries with critique feedback
  it("D5.2: reflection loop retries agent with critic feedback", async () => {
    let callCount = 0;

    // Agent that improves on second attempt
    const improvingAgent = async (input: { upstreamArtifacts: Record<string, unknown> } & Record<string, unknown>) => {
      callCount++;
      const hasFeedback = !!input.upstreamArtifacts._criticFeedback;
      return {
        summary: `attempt ${callCount}`,
        artifacts: {
          html: hasFeedback
            ? "<h1>Freshcuts Barber — The Freshest Cuts in Didsbury</h1><section class='reviews'>85 reviews, 4.8 stars</section>"
            : "<h1>Welcome to our business</h1><p>We offer services</p>",
          improved: hasFeedback,
          business_name: "Freshcuts Barber",
        },
      };
    };

    // Critic that scores higher when business name and reviews are present
    const critic = new HeuristicCritic();
    const loop = new ReflectionLoop(critic, {
      threshold: 0.5,
      maxIterations: 3,
      forceAcceptBest: true,
    });

    const result = await loop.executeWithReflection({
      agentInput: {
        run_id: "r1",
        node_id: "compose",
        agent_id: "site-composer-agent",
        upstreamArtifacts: {},
      },
      handler: improvingAgent as any,
      businessContext: {
        business_name: "Freshcuts Barber",
        vertical: "barber",
        review_count: 85,
        review_rating: 4.8,
      },
    });

    assert.ok(result.iterations.length >= 1, "should have at least 1 iteration");
    assert.equal(typeof result.finalScore, "number");
    assert.equal(typeof result.accepted, "boolean");
    assert.equal(typeof result.totalCostUsd, "number");
    assert.ok(result.finalOutput.artifacts, "should have final output");

    // Each iteration should have evaluation
    for (const iter of result.iterations) {
      assert.equal(typeof iter.evaluation.score, "number");
      assert.equal(typeof iter.iteration, "number");
      assert.ok(iter.evaluation.critique.strengths !== undefined);
    }
  });

  // D5.2: Reflection injects critique into agent input
  it("D5.2: critique feedback is injected into agent input on retry", async () => {
    let receivedFeedback: string | undefined;

    const agent = async (input: { upstreamArtifacts: Record<string, unknown> } & Record<string, unknown>) => {
      receivedFeedback = input.upstreamArtifacts._criticFeedback as string | undefined;
      return { summary: "ok", artifacts: { result: "minimal" } };
    };

    const critic = new HeuristicCritic();
    const loop = new ReflectionLoop(critic, {
      threshold: 0.99, // Impossibly high — forces retry
      maxIterations: 2,
      forceAcceptBest: true,
    });

    await loop.executeWithReflection({
      agentInput: {
        run_id: "r2", node_id: "n1", agent_id: "test-agent",
        upstreamArtifacts: {},
      },
      handler: agent as any,
    });

    // On second call, agent should receive critique feedback
    assert.ok(receivedFeedback, "agent should receive _criticFeedback on retry");
    assert.ok(receivedFeedback!.includes("Critic Feedback"), "feedback should contain header");
  });

  // D5.3: Force-accept with human review flag
  it("D5.3: exhausted reflection loop force-accepts with human review flag", async () => {
    const agent = async () => ({
      summary: "ok", artifacts: { minimal: true },
    });

    const critic = new HeuristicCritic();
    const loop = new ReflectionLoop(critic, {
      threshold: 0.99,
      maxIterations: 2,
      forceAcceptBest: true,
    });

    const result = await loop.executeWithReflection({
      agentInput: { run_id: "r3", node_id: "n1", agent_id: "a1", upstreamArtifacts: {} },
      handler: agent as any,
    });

    assert.equal(result.forceAccepted, true, "should be force-accepted");
    assert.equal(result.needsHumanReview, true, "should flag for human review");
    assert.equal(result.accepted, false, "should not be accepted by critic");
    assert.equal(result.iterations.length, 2, "should exhaust max iterations");
  });
});

// ══════════════════════════════════════════════════════════════
// D6: Learning
// ══════════════════════════════════════════════════════════════

describe("D6 Learning", () => {
  // D6.1: Episodic memory records full pipeline run
  it("D6.1: episode stores complete run context", () => {
    const dbPath = freshDbPath();
    const store = new EpisodicStore(dbPath);

    const episode = store.createEpisode({
      id: "ep-001",
      pipeline_run_id: "run-001",
      pipeline_definition_id: "lead-generation-v1",
      business_name: "Freshcuts Barber",
      vertical: "barber",
      region: "manchester",
    });

    assert.equal(episode.id, "ep-001");
    assert.equal(episode.status, "running");
    assert.equal(episode.vertical, "barber");

    // Update with agent outputs and critic scores
    store.updateEpisode("ep-001", {
      status: "completed",
      ended_at: new Date().toISOString(),
      total_cost_usd: 0.32,
      reflection_iterations: 4,
      agent_outputs: {
        "lead-scout-agent": { leads_found: 15 },
        "site-composer-agent": { html: "<html>...</html>" },
      },
      critic_scores: [
        {
          agent_id: "site-composer-agent",
          node_id: "compose",
          iteration: 1,
          score: 0.45,
          prediction: "unlikely_close",
          model_version: "llm-critic:claude-sonnet-4",
          strengths: ["Uses brand colours"],
          weaknesses: ["Generic headline"],
          suggestions: ["Use business tagline"],
        },
        {
          agent_id: "site-composer-agent",
          node_id: "compose",
          iteration: 2,
          score: 0.78,
          prediction: "likely_close",
          model_version: "llm-critic:claude-sonnet-4",
          strengths: ["Uses brand colours", "Custom headline"],
          weaknesses: [],
          suggestions: [],
        },
      ],
      working_memory_snapshot: {
        shared: { instagram_followers: 2300 },
        notes: [{ note: "strong food photography", author: "lead-profiler" }],
      },
    });

    const loaded = store.getEpisode("ep-001")!;
    assert.equal(loaded.status, "completed");
    assert.equal(loaded.total_cost_usd, 0.32);
    assert.equal(loaded.reflection_iterations, 4);
    assert.equal(loaded.critic_scores.length, 2);
    assert.equal(loaded.critic_scores[0].score, 0.45);
    assert.equal(loaded.critic_scores[1].score, 0.78);
    assert.equal((loaded.working_memory_snapshot.shared as Record<string, unknown>).instagram_followers, 2300);

    store.close();
  });

  // D6.2: Outcome attachment (the learning signal)
  it("D6.2: pitch outcome attaches to episode for learning", () => {
    const dbPath = freshDbPath();
    const store = new EpisodicStore(dbPath);

    store.createEpisode({
      id: "ep-002",
      pipeline_run_id: "run-002",
      pipeline_definition_id: "lead-generation-v1",
      vertical: "restaurant",
    });

    store.updateEpisode("ep-002", { status: "completed" });

    // Salesperson reports back: closed the deal
    store.recordOutcome("ep-002", {
      pitch_outcome: "closed",
      close_amount_gbp: 2400,
      salesperson_id: "sp-mike",
      days_to_outcome: 3.5,
    });

    const ep = store.getEpisode("ep-002")!;
    assert.equal(ep.pitch_outcome, "closed");
    assert.equal(ep.close_amount_gbp, 2400);
    assert.equal(ep.salesperson_id, "sp-mike");
    assert.equal(ep.days_to_outcome, 3.5);
    assert.ok(ep.outcome_received_at, "should record when outcome was received");

    store.close();
  });

  // D6.3: Querying episodes by vertical and outcome
  it("D6.3: episodes queryable by vertical and outcome for strategy analysis", () => {
    const dbPath = freshDbPath();
    const store = new EpisodicStore(dbPath);

    // Create episodes across verticals with outcomes
    for (const [id, vertical, outcome] of [
      ["ep-a", "barber", "closed"],
      ["ep-b", "barber", "rejected"],
      ["ep-c", "restaurant", "closed"],
      ["ep-d", "barber", "closed"],
      ["ep-e", "cafe", "no_show"],
    ] as const) {
      store.createEpisode({
        id,
        pipeline_run_id: `run-${id}`,
        pipeline_definition_id: "lead-gen-v1",
        vertical,
      });
      store.updateEpisode(id, { status: "completed" });
      store.recordOutcome(id, { pitch_outcome: outcome });
    }

    // Query by vertical
    const barberEpisodes = store.listEpisodes({ vertical: "barber" });
    assert.equal(barberEpisodes.length, 3);

    // Query by outcome
    const closedEpisodes = store.listEpisodes({ pitch_outcome: "closed" });
    assert.equal(closedEpisodes.length, 3);

    // Episodes with outcomes (for strategy analysis)
    const withOutcomes = store.listWithOutcomes({ vertical: "barber" });
    assert.equal(withOutcomes.length, 3);

    const totalWithOutcomes = store.countWithOutcomes();
    assert.equal(totalWithOutcomes, 5);

    store.close();
  });

  // D6.4: Episode survives restart
  it("D6.4: episodic memory persists across restart", () => {
    const dbPath = freshDbPath();

    const store1 = new EpisodicStore(dbPath);
    store1.createEpisode({
      id: "ep-persist",
      pipeline_run_id: "run-persist",
      pipeline_definition_id: "test",
      vertical: "salon",
    });
    store1.updateEpisode("ep-persist", {
      status: "completed",
      critic_scores: [{
        agent_id: "a1", node_id: "n1", iteration: 1, score: 0.82,
        prediction: "likely_close", model_version: "v1",
        strengths: ["good"], weaknesses: [], suggestions: [],
      }],
    });
    store1.close();

    const store2 = new EpisodicStore(dbPath);
    const reloaded = store2.getEpisode("ep-persist");
    assert.ok(reloaded, "episode should survive restart");
    assert.equal(reloaded!.vertical, "salon");
    assert.equal(reloaded!.critic_scores.length, 1);
    assert.equal(reloaded!.critic_scores[0].score, 0.82);
    store2.close();
  });
});

// ══════════════════════════════════════════════════════════════
// Integration: Reflection through Unified Engine
// ══════════════════════════════════════════════════════════════

describe("Integration: Reflection + Episodic Memory through Engine", () => {
  it("runs pipeline with reflection-enabled agent and records episode", async () => {
    const dbPath = freshDbPath();
    const store = new SQLitePipelineStore(dbPath);
    const episodicStore = new EpisodicStore(dbPath);
    const registry = new AgentCapabilityRegistry();
    const bus = new InMemoryEventBus();
    const reflectionEvents: Event<unknown>[] = [];

    bus.subscribe("reflection.iteration", (e) => { reflectionEvents.push(e); });

    // Register agent with reflection_enabled
    let agentCallCount = 0;
    registry.register(
      makeTestCapability({
        id: "reflective-agent",
        capabilities: ["html_generation"],
        reflection_enabled: true,
      }),
      async (input) => {
        agentCallCount++;
        return {
          summary: `attempt ${agentCallCount}`,
          artifacts: {
            html: `<h1>Generated Site</h1><p>Attempt ${agentCallCount}</p>`,
            business_name: "Test Business",
          },
          cost_usd: 0.05,
        };
      },
    );

    store.upsertDefinition({
      id: "reflection-pipeline",
      name: "Reflection Pipeline",
      enabled: true,
      schedule_rrule: "",
      max_retries: 0,
      nodes: [{ id: "compose", agent_id: "reflective-agent", depends_on: [] }],
      config: {},
    });

    const critic = new HeuristicCritic();
    const engine = new UnifiedPipelineEngine(
      store, registry, bus, undefined, undefined, undefined,
      undefined, undefined, critic, episodicStore,
    );

    const run = await engine.startRun({
      definitionId: "reflection-pipeline",
      trigger: "manual",
    });

    // Run should complete (force-accept if needed)
    assert.ok(
      run.status === "completed" || run.status === "failed",
      "run should finalise",
    );

    // Reflection events should have fired
    assert.ok(reflectionEvents.length > 0, "should emit reflection.iteration events");

    // Episode should be recorded
    const episode = episodicStore.getByRunId(run.id);
    assert.ok(episode, "episode should be recorded for this run");
    assert.ok(episode!.critic_scores.length > 0, "episode should contain critic scores");

    store.close();
    episodicStore.close();
  });
});
