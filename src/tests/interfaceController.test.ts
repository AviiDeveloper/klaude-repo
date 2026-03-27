import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { InterfaceController } from "../interface/controller.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { CallerModel } from "../caller/callerModel.js";
import { LatencyTracker } from "../metrics/latencyTracker.js";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { InMemoryEventBus } from "../events/bus.js";
import { InMemoryTaskStore } from "../storage/taskStore.js";
import { LocalHeuristicModelProvider } from "../models/provider.js";
import { SQLiteTraceStore } from "../trace/sqliteTraceStore.js";

function createController() {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const provider = new LocalHeuristicModelProvider();
  const taskStore = new InMemoryTaskStore();
  const bus = new InMemoryEventBus();
  const traceStore = new SQLiteTraceStore({
    dbPath: path.join(testDir, "traces.sqlite"),
    buildVersion: "test",
    changelogChangeId: "test-001",
  });
  const codeAgent = new CodeAgent(provider);
  const opsAgent = new OpsAgent(provider);
  const orchestrator = new Orchestrator(taskStore, bus, codeAgent, opsAgent, traceStore);
  const callerModel = new CallerModel(provider);
  const latencyTracker = new LatencyTracker();
  const controller = new InterfaceController(orchestrator, callerModel, "test-001", latencyTracker);
  return { controller, orchestrator, latencyTracker, testDir, taskStore };
}

describe("InterfaceController", () => {
  test("greeting returns ack and detail without creating task", async () => {
    const { controller, testDir, taskStore } = createController();
    try {
      const result = await controller.handleMessage({
        session_id: "s1", user_id: "u1", text: "hello", source: "local",
      });
      assert.ok(result.messages.length >= 1);
      assert.equal(result.approvalRequests.length, 0);
      assert.equal(result.notifications.length, 0);
      // No task should be created for greetings
      assert.equal(taskStore.list().length, 0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("recognizes various greetings", async () => {
    const { controller, testDir } = createController();
    try {
      const greetings = ["hi", "hey", "yo", "sup", "good morning", "good afternoon", "good evening"];
      for (const greeting of greetings) {
        const result = await controller.handleMessage({
          session_id: "s1", user_id: "u1", text: greeting, source: "local",
        });
        assert.ok(result.messages.length >= 1, `Failed for greeting: ${greeting}`);
        assert.equal(result.approvalRequests.length, 0, `Approval for greeting: ${greeting}`);
      }
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("missing input returns notification", async () => {
    const { controller, testDir } = createController();
    try {
      const result = await controller.handleMessage({
        session_id: "s1", user_id: "u1", text: "", source: "local",
      });
      assert.ok(result.notifications.length > 0);
      assert.ok(result.notifications.some((n) => n.reason === "missing_input"));
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("weak input like 'do it' treated as missing", async () => {
    const { controller, testDir } = createController();
    try {
      const result = await controller.handleMessage({
        session_id: "s1", user_id: "u1", text: "do it", source: "local",
      });
      assert.ok(result.notifications.some((n) => n.reason === "missing_input"));
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("single word input treated as missing", async () => {
    const { controller, testDir } = createController();
    try {
      const result = await controller.handleMessage({
        session_id: "s1", user_id: "u1", text: "test", source: "local",
      });
      assert.ok(result.notifications.some((n) => n.reason === "missing_input"));
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("valid objective creates task and returns messages", async () => {
    const { controller, testDir, taskStore } = createController();
    try {
      const result = await controller.handleMessage({
        session_id: "s1", user_id: "u1",
        text: "Build a config parser for YAML files",
        source: "local",
      });
      assert.ok(result.messages.length >= 1);
      assert.ok(result.metrics);
      assert.equal(result.metrics.session_id, "s1");
      // Task should have been created
      assert.ok(taskStore.list().length > 0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("records latency metrics", async () => {
    const { controller, testDir, latencyTracker } = createController();
    try {
      await controller.handleMessage({
        session_id: "s1", user_id: "u1",
        text: "Build a logging utility for the service",
        source: "openclaw",
      });
      const snap = latencyTracker.snapshot();
      assert.equal(snap.count, 1);
      assert.equal(snap.last!.source, "openclaw");
      assert.ok(snap.last!.ack_latency_ms >= 0);
      assert.ok(snap.last!.total_latency_ms >= 0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("risky objective returns approval request", async () => {
    const { controller, testDir } = createController();
    try {
      const result = await controller.handleMessage({
        session_id: "s1", user_id: "u1",
        text: "Deploy the service to production servers",
        source: "local",
      });
      assert.ok(result.approvalRequests.length > 0);
      const approval = result.approvalRequests[0];
      assert.ok(approval.task_id);
      assert.ok(approval.side_effects.length > 0);
      assert.deepEqual(approval.decision_options, ["approve", "deny"]);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handleApprovalDecision with approved resumes task", async () => {
    const { controller, testDir, orchestrator } = createController();
    try {
      // Create a task that needs approval
      const msgResult = await controller.handleMessage({
        session_id: "s1", user_id: "u1",
        text: "Deploy the application to staging",
        source: "local",
      });
      assert.ok(msgResult.approvalRequests.length > 0);
      const taskId = msgResult.approvalRequests[0].task_id;

      // Approve
      const approvalResult = await controller.handleApprovalDecision({
        session_id: "s1", user_id: "u1", task_id: taskId,
        approval_id: "apr-1", decision: "approved",
      });
      assert.ok(approvalResult.messages.length >= 1);
      const task = orchestrator.getTask(taskId);
      assert.ok(task);
      assert.ok(["completed", "in_progress"].includes(task!.status));
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test("handleApprovalDecision with denied blocks task", async () => {
    const { controller, testDir, orchestrator } = createController();
    try {
      const msgResult = await controller.handleMessage({
        session_id: "s1", user_id: "u1",
        text: "Deploy the application now",
        source: "local",
      });
      assert.ok(msgResult.approvalRequests.length > 0);
      const taskId = msgResult.approvalRequests[0].task_id;

      const approvalResult = await controller.handleApprovalDecision({
        session_id: "s1", user_id: "u1", task_id: taskId,
        approval_id: "apr-1", decision: "denied",
      });
      assert.ok(approvalResult.messages.length >= 1);
      assert.ok(approvalResult.notifications.some((n) => n.reason === "approval_denied"));
      const task = orchestrator.getTask(taskId);
      assert.equal(task!.status, "blocked");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
