import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { SQLitePipelineStore } from "../pipeline/sqlitePipelineStore.js";

describe("SQLitePipelineStore", () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "pipeline.sqlite");
  let store: SQLitePipelineStore;

  beforeEach(() => {
    store = new SQLitePipelineStore(dbPath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // --- Pipeline Definitions ---

  test("upsert and get a definition", () => {
    store.upsertDefinition({
      id: "pipe1",
      name: "Test Pipeline",
      enabled: true,
      max_retries: 3,
      nodes: [
        { id: "n1", agent_id: "agent-a", depends_on: [] },
        { id: "n2", agent_id: "agent-b", depends_on: ["n1"] },
      ],
    });
    const def = store.getDefinition("pipe1");
    assert.ok(def);
    assert.equal(def!.name, "Test Pipeline");
    assert.equal(def!.enabled, true);
    assert.equal(def!.max_retries, 3);
    assert.equal(def!.nodes.length, 2);
    assert.deepEqual(def!.nodes[1].depends_on, ["n1"]);
  });

  test("getDefinition returns undefined for unknown id", () => {
    assert.equal(store.getDefinition("nonexistent"), undefined);
  });

  test("upsert updates existing definition", () => {
    store.upsertDefinition({ id: "pipe1", name: "V1", enabled: true, max_retries: 1, nodes: [] });
    store.upsertDefinition({ id: "pipe1", name: "V2", enabled: false, max_retries: 2, nodes: [] });
    const def = store.getDefinition("pipe1");
    assert.equal(def!.name, "V2");
    assert.equal(def!.enabled, false);
    assert.equal(def!.max_retries, 2);
  });

  test("patchDefinition updates partial fields", () => {
    store.upsertDefinition({ id: "pipe1", name: "Original", enabled: true, max_retries: 1, nodes: [] });
    store.patchDefinition("pipe1", { enabled: false });
    const def = store.getDefinition("pipe1");
    assert.equal(def!.name, "Original");
    assert.equal(def!.enabled, false);
  });

  test("listDefinitions returns all definitions", () => {
    store.upsertDefinition({ id: "p1", name: "A", enabled: true, max_retries: 1, nodes: [] });
    store.upsertDefinition({ id: "p2", name: "B", enabled: true, max_retries: 1, nodes: [] });
    const list = store.listDefinitions();
    assert.equal(list.length, 2);
  });

  test("listDueDefinitions returns enabled definitions with past next_run_at", () => {
    store.upsertDefinition({
      id: "due", name: "Due", enabled: true, max_retries: 1, nodes: [],
      schedule_rrule: "FREQ=DAILY",
    });
    store.bumpNextRunAt("due", "2020-01-01T00:00:00Z");
    store.upsertDefinition({
      id: "notdue", name: "Not Due", enabled: true, max_retries: 1, nodes: [],
      schedule_rrule: "FREQ=DAILY",
    });
    store.bumpNextRunAt("notdue", "2099-01-01T00:00:00Z");
    store.upsertDefinition({
      id: "disabled", name: "Disabled", enabled: false, max_retries: 1, nodes: [],
      schedule_rrule: "FREQ=DAILY",
    });
    store.bumpNextRunAt("disabled", "2020-01-01T00:00:00Z");

    const due = store.listDueDefinitions(new Date().toISOString());
    assert.equal(due.length, 1);
    assert.equal(due[0].id, "due");
  });

  // --- Pipeline Runs ---

  test("createRun initializes run and nodes", () => {
    store.upsertDefinition({
      id: "pipe1", name: "P", enabled: true, max_retries: 2,
      nodes: [
        { id: "n1", agent_id: "a1", depends_on: [] },
        { id: "n2", agent_id: "a2", depends_on: ["n1"] },
      ],
    });
    const def = store.getDefinition("pipe1")!;
    const run = store.createRun({ definition: def, trigger: "manual" });
    assert.ok(run.id);
    assert.equal(run.status, "pending");
    assert.equal(run.trigger, "manual");

    const nodes = store.listNodeRuns(run.id);
    assert.equal(nodes.length, 2);
    assert.equal(nodes[0].status, "pending");
    assert.equal(nodes[1].status, "pending");
  });

  test("getRun returns run by id", () => {
    store.upsertDefinition({ id: "p", name: "P", enabled: true, max_retries: 1, nodes: [{ id: "n1", agent_id: "a1", depends_on: [] }] });
    const def = store.getDefinition("p")!;
    const run = store.createRun({ definition: def, trigger: "manual" });
    const fetched = store.getRun(run.id);
    assert.ok(fetched);
    assert.equal(fetched!.id, run.id);
  });

  test("setRunStatus updates status", () => {
    store.upsertDefinition({ id: "p", name: "P", enabled: true, max_retries: 1, nodes: [{ id: "n1", agent_id: "a1", depends_on: [] }] });
    const def = store.getDefinition("p")!;
    const run = store.createRun({ definition: def, trigger: "manual" });
    store.setRunStatus(run.id, "running");
    assert.equal(store.getRun(run.id)!.status, "running");
    store.setRunStatus(run.id, "failed", "Something broke");
    const failed = store.getRun(run.id)!;
    assert.equal(failed.status, "failed");
    assert.equal(failed.error_message, "Something broke");
  });

  test("listRuns returns recent runs", () => {
    store.upsertDefinition({ id: "p", name: "P", enabled: true, max_retries: 1, nodes: [] });
    const def = store.getDefinition("p")!;
    store.createRun({ definition: def, trigger: "manual" });
    store.createRun({ definition: def, trigger: "manual" });
    store.createRun({ definition: def, trigger: "scheduler" });
    const runs = store.listRuns(2);
    assert.equal(runs.length, 2);
  });

  // --- Node Runs ---

  test("setNodeStatus updates node state", () => {
    store.upsertDefinition({ id: "p", name: "P", enabled: true, max_retries: 1, nodes: [{ id: "n1", agent_id: "a1", depends_on: [] }] });
    const def = store.getDefinition("p")!;
    const run = store.createRun({ definition: def, trigger: "manual" });

    store.setNodeStatus({ runId: run.id, nodeId: "n1", status: "running", attempts: 1 });
    assert.equal(store.getNodeRun(run.id, "n1")!.status, "running");

    store.setNodeStatus({ runId: run.id, nodeId: "n1", status: "completed", attempts: 1 });
    assert.equal(store.getNodeRun(run.id, "n1")!.status, "completed");
  });

  test("listRunnableNodes returns pending nodes with completed dependencies", () => {
    store.upsertDefinition({
      id: "p", name: "P", enabled: true, max_retries: 1,
      nodes: [
        { id: "n1", agent_id: "a1", depends_on: [] },
        { id: "n2", agent_id: "a2", depends_on: ["n1"] },
        { id: "n3", agent_id: "a3", depends_on: [] },
      ],
    });
    const def = store.getDefinition("p")!;
    const run = store.createRun({ definition: def, trigger: "manual" });

    const runnable = store.listRunnableNodes(run.id);
    const ids = runnable.map((n) => n.node_id);
    assert.ok(ids.includes("n1"));
    assert.ok(ids.includes("n3"));
    assert.ok(!ids.includes("n2"));

    store.setNodeStatus({ runId: run.id, nodeId: "n1", status: "completed", attempts: 1 });
    const runnable2 = store.listRunnableNodes(run.id);
    assert.ok(runnable2.map((n) => n.node_id).includes("n2"));
  });

  test("blockDependents recursively blocks downstream nodes", () => {
    store.upsertDefinition({
      id: "p", name: "P", enabled: true, max_retries: 1,
      nodes: [
        { id: "n1", agent_id: "a1", depends_on: [] },
        { id: "n2", agent_id: "a2", depends_on: ["n1"] },
        { id: "n3", agent_id: "a3", depends_on: ["n2"] },
      ],
    });
    const def = store.getDefinition("p")!;
    const run = store.createRun({ definition: def, trigger: "manual" });

    store.setNodeStatus({ runId: run.id, nodeId: "n1", status: "failed", attempts: 1, error: "boom" });
    store.blockDependents(run.id, "n1", "upstream failed");

    assert.equal(store.getNodeRun(run.id, "n2")!.status, "blocked");
    assert.equal(store.getNodeRun(run.id, "n3")!.status, "blocked");
  });

  // --- Artifacts ---

  test("appendArtifact and listArtifacts", () => {
    store.upsertDefinition({ id: "p", name: "P", enabled: true, max_retries: 1, nodes: [{ id: "n1", agent_id: "a1", depends_on: [] }] });
    const def = store.getDefinition("p")!;
    const run = store.createRun({ definition: def, trigger: "manual" });

    store.appendArtifact({ run_id: run.id, node_id: "n1", kind: "text", value_json: { content: "hello" } });
    store.appendArtifact({ run_id: run.id, node_id: "n1", kind: "image", value_json: { url: "img.png" } });

    const artifacts = store.listArtifacts(run.id);
    assert.equal(artifacts.length, 2);
    assert.equal(artifacts[0].kind, "text");
  });

  // --- Spend Ledger ---

  test("appendSpendLedger and taskSpendUsd", () => {
    const now = new Date().toISOString();
    store.appendSpendLedger({ timestamp: now, scope: "task", reference_id: "run-1", provider: "openai", amount_usd: 0.05 });
    store.appendSpendLedger({ timestamp: now, scope: "task", reference_id: "run-1", provider: "openai", amount_usd: 0.10 });
    store.appendSpendLedger({ timestamp: now, scope: "task", reference_id: "run-2", provider: "openai", amount_usd: 0.50 });

    const run1 = store.taskSpendUsd("run-1");
    assert.ok(Math.abs(run1 - 0.15) < 0.001);
    const run2 = store.taskSpendUsd("run-2");
    assert.ok(Math.abs(run2 - 0.50) < 0.001);
  });

  test("dailySpendUsd aggregates by date prefix", () => {
    const now = new Date().toISOString();
    store.appendSpendLedger({ timestamp: now, scope: "daily", reference_id: "r1", provider: "openai", amount_usd: 1.00 });
    store.appendSpendLedger({ timestamp: now, scope: "daily", reference_id: "r2", provider: "openai", amount_usd: 2.00 });
    const today = new Date().toISOString().slice(0, 10);
    const total = store.dailySpendUsd(today);
    assert.ok(Math.abs(total - 3.00) < 0.001);
  });

  // --- Post Queue ---

  test("enqueuePost and listPostQueue", () => {
    store.enqueuePost({
      run_id: "r1", platform: "tiktok", status: "pending_approval",
      payload_json: { text: "Hello TikTok" },
    });
    store.enqueuePost({
      run_id: "r1", platform: "reels", status: "pending_approval",
      payload_json: { text: "Hello Reels" },
    });
    const queue = store.listPostQueue(10);
    assert.equal(queue.length, 2);
    assert.equal(queue[0].attempts, 0);
    assert.equal(queue[0].status, "pending_approval");
  });

  test("patchPostQueue updates fields", () => {
    store.enqueuePost({ run_id: "r1", platform: "tiktok", status: "pending_approval", payload_json: {} });
    const queue = store.listPostQueue();
    const id = queue[0].id;

    store.patchPostQueue(id, { status: "dispatched", attempts: 1, approved_by: "admin" });
    const updated = store.listPostQueue();
    assert.equal(updated[0].status, "dispatched");
    assert.equal(updated[0].attempts, 1);
    assert.equal(updated[0].approved_by, "admin");
  });

  // --- Agent Tasks ---

  test("appendAgentTask creates task record", () => {
    const record = store.appendAgentTask({
      run_id: "r1", node_id: "n1", agent_id: "code-agent",
      status: "ready", input_json: { objective: "test" },
    });
    assert.ok(record.id);
    assert.equal(record.agent_id, "code-agent");
  });

  // --- Media Jobs ---

  test("createMediaJob creates job record", () => {
    const job = store.createMediaJob({
      run_id: "r1", node_id: "n1", provider: "higgsfield",
      status: "pending", input_json: { prompt: "test" },
    });
    assert.ok(job.id);
    assert.equal(job.provider, "higgsfield");
  });
});
