import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { LocalHeuristicModelProvider } from "../models/provider.js";
import type { AgentRequest } from "../types/task.js";

function makeRequest(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    task_id: "t1",
    agent_name: "code-agent",
    objective: "Build a config parser",
    plan_step: "Prepare code changes",
    constraints: [],
    inputs: [],
    ...overrides,
  };
}

describe("CodeAgent", () => {
  const provider = new LocalHeuristicModelProvider();
  const agent = new CodeAgent(provider);

  test("has correct name", () => {
    assert.equal(agent.name, "code-agent");
  });

  test("returns ok for safe objective without approval", async () => {
    const response = await agent.run(makeRequest({
      objective: "Build a config parser",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "ok");
    assert.equal(response.task_id, "t1");
    assert.equal(response.agent_name, "code-agent");
  });

  test("requires approval for deploy objective", async () => {
    const response = await agent.run(makeRequest({
      objective: "deploy the service to production",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
    assert.ok(response.actions_proposed.length > 0);
    assert.equal(response.actions_proposed[0].requires_approval, true);
  });

  test("requires approval for shell command objective", async () => {
    const response = await agent.run(makeRequest({
      objective: "run shell command to clean up",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
  });

  test("requires approval for network call objective", async () => {
    const response = await agent.run(makeRequest({
      objective: "make a network call to the API",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
  });

  test("requires approval for git push objective", async () => {
    const response = await agent.run(makeRequest({
      objective: "git push the changes to remote",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
  });

  test("requires approval for message send objective", async () => {
    const response = await agent.run(makeRequest({
      objective: "message send notification to team",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
  });

  test("requires approval for write file objective", async () => {
    const response = await agent.run(makeRequest({
      objective: "write file to the config directory",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
  });

  test("risky objective with approval token returns ok", async () => {
    const response = await agent.run(makeRequest({
      objective: "deploy the service",
      plan_step: "Prepare code changes",
      approval_token: "tok-123",
    }));
    assert.equal(response.status, "ok");
    assert.ok(response.actions_proposed.length > 0);
    assert.ok(response.logs.some((l) => l.includes("tok-123")));
  });

  test("risky objective on non-prepare step does not require approval", async () => {
    const response = await agent.run(makeRequest({
      objective: "deploy the service",
      plan_step: "Review results",
    }));
    assert.equal(response.status, "ok");
  });

  test("case insensitive risk detection", async () => {
    const response = await agent.run(makeRequest({
      objective: "DEPLOY THE SERVICE",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "needs_approval");
  });
});

describe("OpsAgent", () => {
  const provider = new LocalHeuristicModelProvider();
  const agent = new OpsAgent(provider);

  test("has correct name", () => {
    assert.equal(agent.name, "ops-agent");
  });

  test("returns ok status", async () => {
    const response = await agent.run(makeRequest({
      agent_name: "ops-agent",
      objective: "Check system status",
    }));
    assert.equal(response.status, "ok");
    assert.equal(response.task_id, "t1");
    assert.equal(response.agent_name, "ops-agent");
    assert.ok(response.summary);
  });

  test("returns empty actions_proposed", async () => {
    const response = await agent.run(makeRequest({
      agent_name: "ops-agent",
      objective: "Monitor performance",
    }));
    assert.deepEqual(response.actions_proposed, []);
  });

  test("returns empty artifacts", async () => {
    const response = await agent.run(makeRequest({
      agent_name: "ops-agent",
    }));
    assert.deepEqual(response.artifacts, []);
  });

  test("does not gate on risky objectives (no approval logic)", async () => {
    const response = await agent.run(makeRequest({
      agent_name: "ops-agent",
      objective: "deploy the service to production",
      plan_step: "Prepare code changes",
    }));
    assert.equal(response.status, "ok");
  });
});
