import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { InMemoryTaskStore } from "../storage/taskStore.js";
import { SQLiteTaskStore } from "../storage/sqliteTaskStore.js";
import type { Task } from "../types/task.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: randomUUID(),
    title: "Test Task",
    created_at: new Date().toISOString(),
    status: "created",
    objective: "Test objective",
    constraints: ["c1"],
    plan_steps: ["step1", "step2"],
    assigned_agents: [],
    approvals_required: [],
    artifacts: [],
    logs: [],
    side_effects: [],
    rollback_plan: "rollback",
    stop_conditions: ["stop1"],
    ...overrides,
  };
}

function taskStoreTests(name: string, createStore: () => { store: InMemoryTaskStore | SQLiteTaskStore; cleanup: () => Promise<void> }) {
  describe(name, () => {
    let store: InMemoryTaskStore | SQLiteTaskStore;
    let cleanup: () => Promise<void>;

    beforeEach(() => {
      const result = createStore();
      store = result.store;
      cleanup = result.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

    test("save and get a task", () => {
      const task = makeTask();
      store.save(task);
      const retrieved = store.get(task.id);
      assert.ok(retrieved);
      assert.equal(retrieved!.id, task.id);
      assert.equal(retrieved!.title, "Test Task");
      assert.equal(retrieved!.objective, "Test objective");
    });

    test("get returns undefined for unknown id", () => {
      assert.equal(store.get("nonexistent"), undefined);
    });

    test("list returns all tasks", () => {
      store.save(makeTask({ id: "t1" }));
      store.save(makeTask({ id: "t2" }));
      store.save(makeTask({ id: "t3" }));
      const tasks = store.list();
      assert.equal(tasks.length, 3);
    });

    test("list returns empty array when no tasks", () => {
      assert.deepEqual(store.list(), []);
    });

    test("update modifies task via updater function", () => {
      const task = makeTask();
      store.save(task);
      const updated = store.update(task.id, (t) => ({
        ...t,
        status: "completed",
        logs: [...t.logs, "Completed"],
      }));
      assert.equal(updated.status, "completed");
      assert.deepEqual(updated.logs, ["Completed"]);
      const retrieved = store.get(task.id);
      assert.equal(retrieved!.status, "completed");
    });

    test("update throws for unknown task", () => {
      assert.throws(() => store.update("nonexistent", (t) => t));
    });

    test("save overwrites existing task (upsert)", () => {
      const task = makeTask({ id: "t1", title: "Original" });
      store.save(task);
      store.save({ ...task, title: "Updated" });
      const retrieved = store.get("t1");
      assert.equal(retrieved!.title, "Updated");
    });

    test("preserves complex JSON fields", () => {
      const task = makeTask({
        constraints: ["no-external-calls", "max-10-files"],
        plan_steps: ["Analyze", "Implement", "Test"],
        side_effects: [
          { type: "file_write", description: "Write config", scope: "local", risk_notes: "", requires_approval: true },
        ],
        artifacts: ["artifact1.json", "artifact2.ts"],
        logs: ["Log entry 1", "Log entry 2"],
        stop_conditions: ["timeout", "error-rate > 5%"],
      });
      store.save(task);
      const retrieved = store.get(task.id)!;
      assert.deepEqual(retrieved.constraints, task.constraints);
      assert.deepEqual(retrieved.plan_steps, task.plan_steps);
      assert.deepEqual(retrieved.side_effects, task.side_effects);
      assert.deepEqual(retrieved.artifacts, task.artifacts);
      assert.deepEqual(retrieved.logs, task.logs);
      assert.deepEqual(retrieved.stop_conditions, task.stop_conditions);
    });

    test("handles all task statuses", () => {
      const statuses = ["created", "awaiting_approval", "in_progress", "blocked", "failed", "completed"] as const;
      for (const status of statuses) {
        const task = makeTask({ id: `t-${status}`, status });
        store.save(task);
        assert.equal(store.get(`t-${status}`)!.status, status);
      }
    });
  });
}

// Run tests for InMemoryTaskStore
taskStoreTests("InMemoryTaskStore", () => {
  return {
    store: new InMemoryTaskStore(),
    cleanup: async () => {},
  };
});

// Run tests for SQLiteTaskStore
taskStoreTests("SQLiteTaskStore", () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "tasks.sqlite");
  return {
    store: new SQLiteTaskStore(dbPath),
    cleanup: async () => { await rm(testDir, { recursive: true, force: true }); },
  };
});
