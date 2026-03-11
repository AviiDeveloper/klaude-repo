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

test("orchestrator moves task to awaiting_approval and logs approval.requested", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const bus = new InMemoryEventBus();
  let approvalRequestedCount = 0;
  bus.subscribe("approval.requested", () => {
    approvalRequestedCount += 1;
  });

  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "approval-contract",
  });

  const orchestrator = new Orchestrator(
    taskStore,
    bus,
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );

  const task = await orchestrator.createTask({
    title: "Approval contract",
    objective: "deploy service with shell command",
    constraints: ["single-node"],
    rollback_plan: "revert generated changes",
    stop_conditions: ["none"],
  });

  const result = await orchestrator.executeTask(task.id);
  assert.equal(result.status, "awaiting_approval");
  assert.ok(result.approvals_required.length > 0);
  assert.equal(approvalRequestedCount, 1);

  const trace = await traceStore.read(task.id);
  assert.equal(trace.final_state, "in_progress");
  assert.ok(trace.timeline.some((event) => event.event_type === "approval.requested"));

  await rm(testDir, { recursive: true, force: true });
});
