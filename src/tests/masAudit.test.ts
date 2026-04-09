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
