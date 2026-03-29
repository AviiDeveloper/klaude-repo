import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { InMemoryEventBus } from "../events/bus.js";
import { DecisionLogger } from "../decisions/decisionLogger.js";
import { InMemoryDecisionStore } from "../decisions/decisionStore.js";
import { SQLiteDecisionStore } from "../decisions/sqliteDecisionStore.js";

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    agent_id: "test-agent",
    decision_type: "test_decision",
    description: "Test decision description",
    rationale: "Because tests need decisions",
    input_data: { key: "value" },
    expected_outcome: "success",
    expected_metric: { score: 0.8 },
    ...overrides,
  };
}

test("log a decision and retrieve it", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id = await logger.log(makeInput());
  assert.ok(id);

  const records = logger.listByAgent("test-agent");
  assert.equal(records.length, 1);
  assert.equal(records[0].decision_id, id);
  assert.equal(records[0].agent_id, "test-agent");
  assert.equal(records[0].decision_type, "test_decision");
  assert.equal(records[0].expected_outcome, "success");
  assert.equal(records[0].actual_outcome, null);
});

test("record outcome against logged decision", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id = await logger.log(makeInput());

  await logger.recordOutcome(id, {
    actual_outcome: "success",
    actual_metric: { score: 0.75 },
  });

  const records = logger.listByAgent("test-agent");
  assert.equal(records[0].actual_outcome, "success");
  assert.ok(records[0].outcome_measured_at);
  assert.ok(records[0].prediction_accuracy !== null);
});

test("prediction accuracy computed from score metrics", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id = await logger.log(
    makeInput({ expected_metric: { score: 0.8 } }),
  );

  await logger.recordOutcome(id, {
    actual_outcome: "success",
    actual_metric: { score: 0.7 },
  });

  const records = logger.listByAgent("test-agent");
  // accuracy = 1 - |0.8 - 0.7| = 0.9
  assert.ok(records[0].prediction_accuracy !== null);
  assert.ok(Math.abs(records[0].prediction_accuracy! - 0.9) < 0.001);
});

test("prediction accuracy falls back to outcome match when no score", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id1 = await logger.log(
    makeInput({ expected_metric: { category: "A" } }),
  );
  await logger.recordOutcome(id1, {
    actual_outcome: "success",
    actual_metric: { category: "B" },
  });

  const id2 = await logger.log(
    makeInput({ agent_id: "agent-2", expected_metric: { category: "A" } }),
  );
  await logger.recordOutcome(id2, {
    actual_outcome: "success",
    actual_metric: { category: "A" },
  });

  const records1 = logger.listByAgent("test-agent");
  assert.equal(records1[0].prediction_accuracy, 1.0); // outcome matches

  const records2 = logger.listByAgent("agent-2");
  assert.equal(records2[0].prediction_accuracy, 1.0); // outcome matches
});

test("null accuracy when no metrics provided", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id = await logger.log(
    makeInput({ expected_metric: undefined }),
  );

  await logger.recordOutcome(id, {
    actual_outcome: "success",
  });

  const records = logger.listByAgent("test-agent");
  assert.equal(records[0].prediction_accuracy, null);
});

test("list pending outcomes", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id1 = await logger.log(makeInput());
  await logger.log(makeInput({ agent_id: "agent-2" }));

  await logger.recordOutcome(id1, { actual_outcome: "done" });

  const pending = logger.listPendingOutcomes();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].agent_id, "agent-2");
});

test("list by agent filtering", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  await logger.log(makeInput({ agent_id: "agent-a" }));
  await logger.log(makeInput({ agent_id: "agent-b" }));
  await logger.log(makeInput({ agent_id: "agent-a" }));

  const agentA = logger.listByAgent("agent-a");
  assert.equal(agentA.length, 2);

  const agentB = logger.listByAgent("agent-b");
  assert.equal(agentB.length, 1);
});

test("human review flag filtering", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  await logger.log(makeInput({ requires_human_review: true }));
  await logger.log(makeInput({ requires_human_review: false }));

  const needsReview = logger.query({ requires_human_review: true });
  assert.equal(needsReview.length, 1);
  assert.equal(needsReview[0].requires_human_review, true);
});

test("getAccuracy report", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  const id1 = await logger.log(makeInput({ expected_metric: { score: 0.8 } }));
  const id2 = await logger.log(makeInput({ expected_metric: { score: 0.6 } }));
  await logger.log(makeInput()); // no outcome yet

  await logger.recordOutcome(id1, {
    actual_outcome: "success",
    actual_metric: { score: 0.7 },
  });
  await logger.recordOutcome(id2, {
    actual_outcome: "success",
    actual_metric: { score: 0.5 },
  });

  const report = logger.getAccuracy("test-agent");
  assert.equal(report.total_decisions, 3);
  assert.equal(report.measured_decisions, 2);
  // avg accuracy = (0.9 + 0.9) / 2 = 0.9
  assert.ok(report.average_accuracy !== null);
  assert.ok(Math.abs(report.average_accuracy! - 0.9) < 0.001);
});

test("recordOutcome throws on unknown decision", async () => {
  const store = new InMemoryDecisionStore();
  const logger = new DecisionLogger(store);

  await assert.rejects(
    () => logger.recordOutcome("nonexistent", { actual_outcome: "nope" }),
    { message: /not found/i },
  );
});

test("event bus emits decision.logged and decision.outcome_measured", async () => {
  const store = new InMemoryDecisionStore();
  const bus = new InMemoryEventBus();
  const logger = new DecisionLogger(store, bus);

  const events: Array<{ name: string; payload: unknown }> = [];
  bus.subscribe("decision.logged", (e) => {
    events.push({ name: e.name, payload: e.payload });
  });
  bus.subscribe("decision.outcome_measured", (e) => {
    events.push({ name: e.name, payload: e.payload });
  });

  const id = await logger.log(makeInput());
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "decision.logged");

  await logger.recordOutcome(id, { actual_outcome: "done", actual_metric: { score: 0.8 } });
  assert.equal(events.length, 2);
  assert.equal(events[1].name, "decision.outcome_measured");
});

test("SQLite persistence survives reload", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "test-decisions.sqlite");

  try {
    const store1 = new SQLiteDecisionStore(dbPath);
    const logger1 = new DecisionLogger(store1);

    const id = await logger1.log(makeInput({ description: "persisted decision" }));
    await logger1.recordOutcome(id, {
      actual_outcome: "success",
      actual_metric: { score: 0.85 },
    });

    // Create new store from same db path (simulates restart)
    const store2 = new SQLiteDecisionStore(dbPath);
    const logger2 = new DecisionLogger(store2);

    const records = logger2.listByAgent("test-agent");
    assert.equal(records.length, 1);
    assert.equal(records[0].decision_id, id);
    assert.equal(records[0].description, "persisted decision");
    assert.equal(records[0].actual_outcome, "success");
    assert.ok(records[0].prediction_accuracy !== null);
    // accuracy = 1 - |0.8 - 0.85| = 0.95
    assert.ok(Math.abs(records[0].prediction_accuracy! - 0.95) < 0.001);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("SQLite query with multiple filters", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "test-query.sqlite");

  try {
    const store = new SQLiteDecisionStore(dbPath);
    const logger = new DecisionLogger(store);

    await logger.log(makeInput({ agent_id: "a1", decision_type: "qc_check" }));
    await logger.log(makeInput({ agent_id: "a1", decision_type: "assignment" }));
    await logger.log(makeInput({ agent_id: "a2", decision_type: "qc_check" }));

    const results = logger.query({ agent_id: "a1", decision_type: "qc_check" });
    assert.equal(results.length, 1);
    assert.equal(results[0].agent_id, "a1");
    assert.equal(results[0].decision_type, "qc_check");

    const all = logger.query({});
    assert.equal(all.length, 3);

    const limited = logger.query({ limit: 2 });
    assert.equal(limited.length, 2);
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});
