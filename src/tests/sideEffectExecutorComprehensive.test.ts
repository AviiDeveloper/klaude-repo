import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { SideEffectExecutor } from "../sideEffects/executor.js";

describe("SideEffectExecutor comprehensive", () => {
  const executor = new SideEffectExecutor();

  test("executes actions that do not require approval", async () => {
    const result = await executor.execute({
      taskId: "t1",
      actions: [
        { type: "file_write", description: "Write config", scope: "local", risk_notes: "", requires_approval: false },
      ],
    });
    assert.equal(result.executedActions.length, 1);
    assert.ok(result.logs.length > 0);
  });

  test("throws when approval required but no token", async () => {
    await assert.rejects(
      () => executor.execute({
        taskId: "t1",
        actions: [
          { type: "deploy", description: "Deploy", scope: "prod", risk_notes: "risky", requires_approval: true },
        ],
      }),
      (err: Error) => {
        assert.ok(err.message.includes("Approval token required"));
        return true;
      },
    );
  });

  test("executes with approval token when required", async () => {
    const result = await executor.execute({
      taskId: "t1",
      approvalToken: "tok-123",
      actions: [
        { type: "deploy", description: "Deploy", scope: "prod", risk_notes: "", requires_approval: true },
      ],
    });
    assert.equal(result.executedActions.length, 1);
    assert.ok(result.logs.some((l) => l.includes("tok-123")));
  });

  test("executes multiple actions", async () => {
    const result = await executor.execute({
      taskId: "t1",
      approvalToken: "tok-multi",
      actions: [
        { type: "file_write", description: "Write A", scope: "local", risk_notes: "", requires_approval: false },
        { type: "shell_exec", description: "Run B", scope: "local", risk_notes: "", requires_approval: true },
        { type: "network_call", description: "Call C", scope: "external", risk_notes: "", requires_approval: false },
      ],
    });
    assert.equal(result.executedActions.length, 3);
    assert.equal(result.logs.length, 3);
  });

  test("handles all side effect types", async () => {
    const types = ["file_write", "shell_exec", "network_call", "git_push", "message_send", "deploy"] as const;
    for (const type of types) {
      const result = await executor.execute({
        taskId: "t1",
        approvalToken: "tok",
        actions: [
          { type, description: `Action ${type}`, scope: "test", risk_notes: "", requires_approval: true },
        ],
      });
      assert.equal(result.executedActions.length, 1);
      assert.ok(result.logs[0].includes(type));
    }
  });

  test("stops at first approval-required action without token", async () => {
    await assert.rejects(
      () => executor.execute({
        taskId: "t1",
        actions: [
          { type: "file_write", description: "Safe", scope: "local", risk_notes: "", requires_approval: false },
          { type: "deploy", description: "Risky", scope: "prod", risk_notes: "", requires_approval: true },
          { type: "file_write", description: "After", scope: "local", risk_notes: "", requires_approval: false },
        ],
      }),
    );
  });

  test("empty actions list returns empty result", async () => {
    const result = await executor.execute({ taskId: "t1", actions: [] });
    assert.deepEqual(result.executedActions, []);
    assert.deepEqual(result.logs, []);
  });
});
