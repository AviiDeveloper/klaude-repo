import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { OpsAgent } from "../agents/opsAgent.js";
import { InMemoryEventBus } from "../events/bus.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { InMemoryTaskStore } from "../storage/taskStore.js";
import { FileTraceStore } from "../trace/traceStore.js";
import { AgentRequest, AgentResponse } from "../types/task.js";

class FailingCodeAgent {
  readonly name = "code-agent" as const;

  async run(_request: AgentRequest): Promise<AgentResponse> {
    throw new Error("synthetic code-agent failure");
  }
}

test("orchestrator failure path finalizes trace with failed state", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const traceStore = new FileTraceStore({
    tracesDir,
    buildVersion: "0.1.0",
    changelogChangeId: "test-failure-contract",
  });

  const orchestrator = new Orchestrator(
    new InMemoryTaskStore(),
    new InMemoryEventBus(),
    new FailingCodeAgent() as never,
    new OpsAgent(),
    traceStore,
  );

  const task = await orchestrator.createTask({
    title: "Failure contract",
    objective: "Exercise failed path",
    constraints: ["single-node"],
    rollback_plan: "none",
    stop_conditions: ["none"],
  });

  await assert.rejects(
    orchestrator.executeTask(task.id),
    /synthetic code-agent failure/,
  );

  const trace = await traceStore.read(task.id);
  assert.equal(trace.final_state, "failed");
  assert.ok(trace.timeline.some((event) => event.event_type === "error"));

  await rm(tracesDir, { recursive: true, force: true });
});
