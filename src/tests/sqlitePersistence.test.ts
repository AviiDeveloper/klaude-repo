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

test("sqlite task + trace stores persist orchestrator execution", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "sqlite-test",
  });

  const orchestrator = new Orchestrator(
    taskStore,
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );

  const task = await orchestrator.createTask({
    title: "SQLite persistence",
    objective: "Verify sqlite-backed persistence",
    constraints: ["single-node"],
    rollback_plan: "none",
    stop_conditions: ["none"],
  });

  const completed = await orchestrator.executeTask(task.id);
  assert.equal(completed.status, "completed");

  const reloadedTask = taskStore.get(task.id);
  assert.ok(reloadedTask);
  assert.equal(reloadedTask?.status, "completed");

  const trace = await traceStore.read(task.id);
  assert.equal(trace.final_state, "completed");
  assert.ok(trace.timeline.length >= 5);

  await rm(testDir, { recursive: true, force: true });
});
