import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { InMemoryEventBus } from "../events/bus.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { InMemoryTaskStore } from "../storage/taskStore.js";
import { FileTraceStore } from "../trace/traceStore.js";

test("persists immutable trace record with required fields", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const traceStore = new FileTraceStore({
    tracesDir,
    buildVersion: "0.1.0",
    changelogChangeId: "test-change-id",
  });

  const orchestrator = new Orchestrator(
    new InMemoryTaskStore(),
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );

  const task = await orchestrator.createTask({
    title: "Trace test",
    objective: "Verify trace schema fields",
    constraints: ["single-node"],
    rollback_plan: "none",
    stop_conditions: ["none"],
  });

  await orchestrator.executeTask(task.id);

  const trace = await traceStore.read(task.id);
  assert.equal(trace.task_id, task.id);
  assert.equal(trace.objective, "Verify trace schema fields");
  assert.equal(trace.build_version, "0.1.0");
  assert.equal(trace.changelog_change_id, "test-change-id");
  assert.equal(trace.final_state, "completed");
  assert.ok(Array.isArray(trace.timeline));
  assert.ok(trace.timeline.length >= 5);

  const eventTypes = trace.timeline.map((entry) => entry.event_type);
  assert.ok(eventTypes.includes("task.created"));
  assert.ok(eventTypes.includes("plan.generated"));
  assert.ok(eventTypes.includes("agent.requested"));
  assert.ok(eventTypes.includes("agent.completed"));

  await rm(tracesDir, { recursive: true, force: true });
});
