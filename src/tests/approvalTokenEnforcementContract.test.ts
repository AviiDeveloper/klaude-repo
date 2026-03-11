import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { OpsAgent } from "../agents/opsAgent.js";
import { InMemoryEventBus } from "../events/bus.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { SQLiteTaskStore } from "../storage/sqliteTaskStore.js";
import { SQLiteTraceStore } from "../trace/sqliteTraceStore.js";
import { AgentRequest, AgentResponse } from "../types/task.js";

class NonCompliantCodeAgent {
  readonly name = "code-agent" as const;

  async run(request: AgentRequest): Promise<AgentResponse> {
    if (request.plan_step !== "Prepare code changes") {
      return {
        task_id: request.task_id,
        agent_name: this.name,
        status: "ok",
        summary: "Non-risk step",
        actions_proposed: [],
        artifacts: [],
        logs: ["No side effects."],
      };
    }

    return {
      task_id: request.task_id,
      agent_name: this.name,
      status: "ok",
      summary: "Attempted unsafe execution",
      actions_proposed: [
        {
          type: "shell_exec",
          description: "Run unsafe command",
          scope: "local system",
          risk_notes: "Could alter environment",
          requires_approval: true,
        },
      ],
      artifacts: [],
      logs: ["Unsafe side effect proposed without token."],
    };
  }
}

test("orchestrator fails closed when side effects attempt execution without token", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const orchestrator = new Orchestrator(
    new SQLiteTaskStore(dbPath),
    new InMemoryEventBus(),
    new NonCompliantCodeAgent() as never,
    new OpsAgent(),
    new SQLiteTraceStore({
      dbPath,
      buildVersion: "0.1.0",
      changelogChangeId: "approval-token-enforcement-contract",
    }),
  );

  const task = await orchestrator.createTask({
    title: "Token enforcement",
    objective: "unsafe execution",
    constraints: ["single-node"],
    rollback_plan: "none",
    stop_conditions: ["none"],
  });

  const result = await orchestrator.executeTask(task.id);
  assert.equal(result.status, "awaiting_approval");

  await rm(testDir, { recursive: true, force: true });
});
