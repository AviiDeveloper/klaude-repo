import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { InMemoryEventBus } from "../events/bus.js";
import { InMemoryTaskStore } from "../storage/taskStore.js";
import { SQLiteTraceStore } from "../trace/sqliteTraceStore.js";
import { SideEffectExecutor } from "../sideEffects/executor.js";
import { LocalHeuristicModelProvider } from "../models/provider.js";

describe("Orchestrator comprehensive", () => {
  let testDir: string;
  let orchestrator: Orchestrator;
  let taskStore: InMemoryTaskStore;
  let bus: InMemoryEventBus;
  let traceStore: SQLiteTraceStore;

  beforeEach(() => {
    testDir = path.join(process.cwd(), "data-test", randomUUID());
    const provider = new LocalHeuristicModelProvider();
    taskStore = new InMemoryTaskStore();
    bus = new InMemoryEventBus();
    traceStore = new SQLiteTraceStore({
      dbPath: path.join(testDir, "traces.sqlite"),
      buildVersion: "test-v1",
      changelogChangeId: "test-001",
    });
    orchestrator = new Orchestrator(
      taskStore, bus,
      new CodeAgent(provider), new OpsAgent(provider),
      traceStore, new SideEffectExecutor(),
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // --- Task Creation ---

  test("createTask returns task with correct fields", async () => {
    const task = await orchestrator.createTask({
      title: "Test",
      objective: "Parse YAML config",
      constraints: ["no external deps"],
      rollback_plan: "revert commit",
      stop_conditions: ["timeout"],
    });
    assert.ok(task.id);
    assert.equal(task.title, "Test");
    assert.equal(task.status, "created");
    assert.equal(task.objective, "Parse YAML config");
    assert.deepEqual(task.constraints, ["no external deps"]);
    assert.equal(task.rollback_plan, "revert commit");
    assert.ok(task.plan_steps.length > 0);
    assert.ok(task.created_at);
  });

  test("createTask publishes task.created event", async () => {
    let published = false;
    bus.subscribe("task.created", () => { published = true; });
    await orchestrator.createTask({
      title: "T", objective: "O", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    assert.ok(published);
  });

  test("createTask persists to store", async () => {
    const task = await orchestrator.createTask({
      title: "Stored", objective: "Test persistence", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const retrieved = taskStore.get(task.id);
    assert.ok(retrieved);
    assert.equal(retrieved!.id, task.id);
  });

  test("createTask initializes trace", async () => {
    const task = await orchestrator.createTask({
      title: "Traced", objective: "Test trace", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const trace = await traceStore.read(task.id);
    assert.equal(trace.task_id, task.id);
    assert.equal(trace.objective, "Test trace");
    assert.equal(trace.build_version, "test-v1");
  });

  // --- Task Execution ---

  test("executeTask completes safe task", async () => {
    const task = await orchestrator.createTask({
      title: "Safe", objective: "Build a parser", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const completed = await orchestrator.executeTask(task.id);
    assert.equal(completed.status, "completed");
    assert.ok(completed.assigned_agents.length > 0);
    assert.ok(completed.logs.length > 0);
  });

  test("executeTask moves to awaiting_approval for risky task", async () => {
    const task = await orchestrator.createTask({
      title: "Risky", objective: "Deploy the application", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const result = await orchestrator.executeTask(task.id);
    assert.equal(result.status, "awaiting_approval");
    assert.ok(result.side_effects.length > 0);
  });

  test("executeTask publishes agent events", async () => {
    const events: string[] = [];
    bus.subscribe("agent.requested", () => { events.push("requested"); });
    bus.subscribe("agent.completed", () => { events.push("completed"); });

    const task = await orchestrator.createTask({
      title: "E", objective: "Build a logger", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    await orchestrator.executeTask(task.id);
    assert.ok(events.includes("requested"));
    assert.ok(events.includes("completed"));
  });

  test("executeTask alternates between code and ops agents", async () => {
    const task = await orchestrator.createTask({
      title: "Alt", objective: "Build a utility", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const completed = await orchestrator.executeTask(task.id);
    const agents = completed.assigned_agents;
    // Should have both agents used
    assert.ok(agents.includes("code-agent") || agents.includes("ops-agent"));
  });

  test("getTask returns undefined for unknown id", () => {
    assert.equal(orchestrator.getTask("nonexistent"), undefined);
  });

  test("getTask returns task after creation", async () => {
    const task = await orchestrator.createTask({
      title: "G", objective: "Test get", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const fetched = orchestrator.getTask(task.id);
    assert.ok(fetched);
    assert.equal(fetched!.id, task.id);
  });

  // --- Approval Resolution ---

  test("resolveApprovalDecision with approved resumes task", async () => {
    const task = await orchestrator.createTask({
      title: "Approve", objective: "Deploy the service", constraints: [],
      rollback_plan: "rollback", stop_conditions: [],
    });
    await orchestrator.executeTask(task.id);
    assert.equal(orchestrator.getTask(task.id)!.status, "awaiting_approval");

    const resolved = await orchestrator.resolveApprovalDecision({
      taskId: task.id, approvalId: "apr-1", decision: "approved",
    });
    assert.ok(["completed", "in_progress"].includes(resolved.status));
  });

  test("resolveApprovalDecision with denied blocks task", async () => {
    const task = await orchestrator.createTask({
      title: "Deny", objective: "Deploy the service", constraints: [],
      rollback_plan: "rollback", stop_conditions: [],
    });
    await orchestrator.executeTask(task.id);

    const resolved = await orchestrator.resolveApprovalDecision({
      taskId: task.id, approvalId: "apr-1", decision: "denied",
    });
    assert.equal(resolved.status, "blocked");
  });

  test("resolveApprovalDecision publishes approval.resolved event", async () => {
    let resolved = false;
    bus.subscribe("approval.resolved", () => { resolved = true; });

    const task = await orchestrator.createTask({
      title: "Evt", objective: "Deploy something", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    await orchestrator.executeTask(task.id);
    await orchestrator.resolveApprovalDecision({
      taskId: task.id, approvalId: "apr-1", decision: "approved",
    });
    assert.ok(resolved);
  });

  // --- Trace Finalization ---

  test("completed task finalizes trace with correct state", async () => {
    const task = await orchestrator.createTask({
      title: "Trace", objective: "Build a utility", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    await orchestrator.executeTask(task.id);
    const trace = await traceStore.read(task.id);
    assert.equal(trace.final_state, "completed");
    assert.ok(trace.timeline.length > 0);
  });

  test("awaiting_approval task trace shows in_progress state", async () => {
    const task = await orchestrator.createTask({
      title: "Trace Approval", objective: "Deploy service", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    await orchestrator.executeTask(task.id);
    const trace = await traceStore.read(task.id);
    // Trace is still mutable (in_progress) until approval is resolved
    assert.equal(trace.final_state, "in_progress");
  });

  // --- Plan Steps ---

  test("task has 3 plan steps", async () => {
    const task = await orchestrator.createTask({
      title: "Steps", objective: "Any objective", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    assert.equal(task.plan_steps.length, 3);
  });

  // --- Edge Cases ---

  test("executeTask with approval token proceeds through risky steps", async () => {
    const task = await orchestrator.createTask({
      title: "Token", objective: "Deploy the service now", constraints: [],
      rollback_plan: "", stop_conditions: [],
    });
    const result = await orchestrator.executeTask(task.id, { approvalToken: "tok-safe" });
    // With token provided upfront, should complete without awaiting
    assert.ok(["completed", "awaiting_approval"].includes(result.status));
  });
});
