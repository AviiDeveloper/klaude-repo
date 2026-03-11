import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { InMemoryEventBus } from "../events/bus.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { SQLiteTaskStore } from "../storage/sqliteTaskStore.js";
import { SQLiteTraceStore } from "../trace/sqliteTraceStore.js";

async function setup() {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const bus = new InMemoryEventBus();
  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "approval-resolved-contract",
  });

  const orchestrator = new Orchestrator(
    taskStore,
    bus,
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );

  return { testDir, orchestrator, traceStore };
}

test("approved decision resumes awaiting task to completion", async () => {
  const { testDir, orchestrator, traceStore } = await setup();

  const task = await orchestrator.createTask({
    title: "Approval resolved approved",
    objective: "deploy service with shell command",
    constraints: ["single-node"],
    rollback_plan: "revert generated changes",
    stop_conditions: ["none"],
  });

  const awaiting = await orchestrator.executeTask(task.id);
  assert.equal(awaiting.status, "awaiting_approval");

  const completed = await orchestrator.resolveApprovalDecision({
    taskId: task.id,
    approvalId: "approval-approve-1",
    decision: "approved",
  });
  assert.equal(completed.status, "completed");
  assert.ok(
    completed.logs.some((log) =>
      log.includes("Side effect executed with approval token approval-approve-1"),
    ),
  );

  const trace = await traceStore.read(task.id);
  assert.equal(trace.final_state, "completed");
  assert.ok(trace.timeline.some((event) => event.event_type === "approval.resolved"));
  assert.ok(
    trace.side_effects.some(
      (item) => item.approved_by_token_id === "approval-approve-1",
    ),
  );

  await rm(testDir, { recursive: true, force: true });
});

test("denied decision blocks awaiting task", async () => {
  const { testDir, orchestrator, traceStore } = await setup();

  const task = await orchestrator.createTask({
    title: "Approval resolved denied",
    objective: "deploy service with shell command",
    constraints: ["single-node"],
    rollback_plan: "revert generated changes",
    stop_conditions: ["none"],
  });

  const awaiting = await orchestrator.executeTask(task.id);
  assert.equal(awaiting.status, "awaiting_approval");

  const blocked = await orchestrator.resolveApprovalDecision({
    taskId: task.id,
    approvalId: "approval-deny-1",
    decision: "denied",
  });
  assert.equal(blocked.status, "blocked");

  const trace = await traceStore.read(task.id);
  assert.equal(trace.final_state, "blocked");
  assert.ok(trace.timeline.some((event) => event.event_type === "approval.resolved"));
  assert.ok(trace.timeline.some((event) => event.event_type === "notify.requested"));

  await rm(testDir, { recursive: true, force: true });
});
