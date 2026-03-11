import assert from "node:assert/strict";
import test from "node:test";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { CallerModel } from "../caller/callerModel.js";
import { ModelProvider } from "../models/provider.js";
import { AgentRequest } from "../types/task.js";

class TestProvider implements ModelProvider {
  readonly name = "test-provider";

  async callerIntent(text: string) {
    return {
      title: `T:${text}`,
      objective: `O:${text}`,
      acknowledgement: "ACK:test-provider",
    };
  }

  async agentOutput(input: { agent: "code-agent" | "ops-agent"; request: AgentRequest }) {
    return {
      summary: `${input.agent}:summary:${input.request.plan_step}`,
      logs: [`${input.agent}:log`],
    };
  }
}

test("caller and agents consume injected model provider", async () => {
  const provider = new TestProvider();
  const caller = new CallerModel(provider);

  const intent = await caller.parseMessage("hello");
  assert.equal(intent.acknowledgement, "ACK:test-provider");

  const request: AgentRequest = {
    task_id: "task-1",
    agent_name: "code-agent",
    objective: "safe task",
    plan_step: "Clarify objective: safe task",
    constraints: [],
    inputs: [],
  };

  const codeAgent = new CodeAgent(provider);
  const codeResult = await codeAgent.run(request);
  assert.equal(codeResult.summary, "code-agent:summary:Clarify objective: safe task");
  assert.equal(codeResult.logs[0], "code-agent:log");

  const opsAgent = new OpsAgent(provider);
  const opsResult = await opsAgent.run({
    ...request,
    agent_name: "ops-agent",
  });
  assert.equal(opsResult.summary, "ops-agent:summary:Clarify objective: safe task");
  assert.equal(opsResult.logs[0], "ops-agent:log");
});
