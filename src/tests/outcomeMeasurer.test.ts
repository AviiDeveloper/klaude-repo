import assert from "node:assert/strict";
import test from "node:test";
import { DecisionLogger } from "../decisions/decisionLogger.js";
import { InMemoryDecisionStore } from "../decisions/decisionStore.js";
import { DemoRecorder } from "../demos/demoRecorder.js";
import { InMemoryDemoRecordStore } from "../demos/demoRecordStore.js";
import { outcomeMeasurerAgent } from "../agents/outreach/outcomeMeasurerAgent.js";
import type { DesignElements } from "../demos/types.js";

function makeDesignElements(): DesignElements {
  return {
    colour_palette: ["#2563eb"],
    colour_source: "scraped",
    layout_type: "card",
    typography_pair: "Inter / Lato",
    hero_style: "gradient",
    section_order: ["hero", "services", "cta"],
    sections_count: 3,
    colour_temperature: "cool",
    density: "minimal",
    has_logo: false,
    has_hero_image: false,
    has_gallery: false,
    has_reviews: false,
    has_map: false,
    has_menu: false,
  };
}

function makeAgentInput(config: Record<string, unknown>) {
  return {
    run_id: "test-run",
    node_id: "measure",
    agent_id: "outcome-measurer-agent" as const,
    config,
    upstreamArtifacts: {},
  };
}

test("measures demo_generated decisions by cross-referencing QA results", async () => {
  const decisionStore = new InMemoryDecisionStore();
  const decisionLogger = new DecisionLogger(decisionStore);
  const demoStore = new InMemoryDemoRecordStore();
  const demoRecorder = new DemoRecorder(demoStore);

  // Create a demo and QA it
  const demoId = await demoRecorder.recordDemo({
    leadId: "lead-001",
    html: "<html>test</html>",
    css: "",
    modelVersion: "v1",
    scrapeQualityScore: 0.8,
    designElements: makeDesignElements(),
  });
  demoRecorder.recordQaResult(demoId, 85, true);

  // Log a demo_generated decision for the same lead
  await decisionLogger.log({
    agent_id: "demo-recorder",
    decision_type: "demo_generated",
    description: "Demo recorded",
    rationale: "test",
    input_data: { lead_id: "lead-001" },
    expected_outcome: "qa_passed",
    expected_metric: { quality_score: 0.7 },
  });

  // Verify it's pending
  assert.equal(decisionLogger.listPendingOutcomes().length, 1);

  // Run the measurer
  const result = await outcomeMeasurerAgent(
    makeAgentInput({ decisionLogger, demoRecorder }),
  );

  assert.equal((result.artifacts as Record<string, unknown>).measured_count, 1);
  assert.equal((result.artifacts as Record<string, unknown>).expired_count, 0);

  // Decision should now have an outcome
  assert.equal(decisionLogger.listPendingOutcomes().length, 0);
  const decisions = decisionLogger.listByAgent("demo-recorder");
  assert.equal(decisions[0].actual_outcome, "qa_passed");
});

test("expires decisions older than 14 days", async () => {
  const decisionStore = new InMemoryDecisionStore();
  const decisionLogger = new DecisionLogger(decisionStore);

  // Log a decision with an old timestamp
  const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  decisionStore.insert({
    decision_id: "old-decision",
    made_at: oldDate,
    agent_id: "test-agent",
    decision_type: "some_type",
    description: "Old decision",
    rationale: "test",
    input_data: {},
    expected_outcome: "success",
    expected_metric: null,
    actual_outcome: null,
    actual_metric: null,
    outcome_measured_at: null,
    prediction_accuracy: null,
    requires_human_review: false,
  });

  assert.equal(decisionLogger.listPendingOutcomes().length, 1);

  const result = await outcomeMeasurerAgent(
    makeAgentInput({ decisionLogger }),
  );

  assert.equal((result.artifacts as Record<string, unknown>).expired_count, 1);
  assert.equal(decisionLogger.listPendingOutcomes().length, 0);

  const decisions = decisionLogger.listByAgent("test-agent");
  assert.equal(decisions[0].actual_outcome, "expired");
});

test("skips already-measured decisions", async () => {
  const decisionStore = new InMemoryDecisionStore();
  const decisionLogger = new DecisionLogger(decisionStore);

  // Log and immediately measure
  const id = await decisionLogger.log({
    agent_id: "test-agent",
    decision_type: "test",
    description: "Already measured",
    rationale: "test",
    input_data: {},
    expected_outcome: "success",
  });
  await decisionLogger.recordOutcome(id, { actual_outcome: "success" });

  // No pending outcomes
  assert.equal(decisionLogger.listPendingOutcomes().length, 0);

  const result = await outcomeMeasurerAgent(
    makeAgentInput({ decisionLogger }),
  );

  assert.equal((result.artifacts as Record<string, unknown>).pending_count, 0);
  assert.equal((result.artifacts as Record<string, unknown>).measured_count, 0);
});

test("computes per-agent accuracy report", async () => {
  const decisionStore = new InMemoryDecisionStore();
  const decisionLogger = new DecisionLogger(decisionStore);

  // Create measured decisions for two agents
  const id1 = await decisionLogger.log({
    agent_id: "agent-a",
    decision_type: "test",
    description: "Decision A",
    rationale: "test",
    input_data: {},
    expected_outcome: "success",
    expected_metric: { score: 0.8 },
  });
  await decisionLogger.recordOutcome(id1, {
    actual_outcome: "success",
    actual_metric: { score: 0.75 },
  });

  const id2 = await decisionLogger.log({
    agent_id: "agent-b",
    decision_type: "test",
    description: "Decision B",
    rationale: "test",
    input_data: {},
    expected_outcome: "success",
    expected_metric: { score: 0.9 },
  });
  await decisionLogger.recordOutcome(id2, {
    actual_outcome: "failed",
    actual_metric: { score: 0.3 },
  });

  // Add a pending decision so the measurer has something to scan
  await decisionLogger.log({
    agent_id: "agent-a",
    decision_type: "pipeline_execution",
    description: "Pending",
    rationale: "test",
    input_data: {},
    expected_outcome: "success",
  });

  const result = await outcomeMeasurerAgent(
    makeAgentInput({ decisionLogger }),
  );

  const reports = (result.artifacts as Record<string, unknown>).accuracy_reports as Array<Record<string, unknown>>;
  assert.ok(reports.length > 0);

  const agentA = reports.find((r) => r.agent_id === "agent-a");
  assert.ok(agentA);
  assert.equal(agentA.measured, 1);
  assert.ok(agentA.accuracy !== null);
});

test("handles empty pending list gracefully", async () => {
  const decisionStore = new InMemoryDecisionStore();
  const decisionLogger = new DecisionLogger(decisionStore);

  const result = await outcomeMeasurerAgent(
    makeAgentInput({ decisionLogger }),
  );

  assert.equal((result.artifacts as Record<string, unknown>).pending_count, 0);
  assert.equal((result.artifacts as Record<string, unknown>).measured_count, 0);
  assert.equal((result.artifacts as Record<string, unknown>).expired_count, 0);
  assert.ok(result.summary.includes("Outcome measurement complete"));
});

test("skips when no DecisionLogger available", async () => {
  const result = await outcomeMeasurerAgent(
    makeAgentInput({}),
  );

  assert.ok(result.summary.includes("skipped"));
  assert.equal((result.artifacts as Record<string, unknown>).skipped, true);
});
