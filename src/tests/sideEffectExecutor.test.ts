import assert from "node:assert/strict";
import test from "node:test";
import { SideEffectExecutor } from "../sideEffects/executor.js";

test("side effect executor requires approval token for protected actions", async () => {
  const executor = new SideEffectExecutor();

  await assert.rejects(
    executor.execute({
      taskId: "task-1",
      actions: [
        {
          type: "shell_exec",
          description: "dangerous",
          scope: "local",
          risk_notes: "high",
          requires_approval: true,
        },
      ],
    }),
    /Approval token required/,
  );

  const success = await executor.execute({
    taskId: "task-1",
    actions: [
      {
        type: "shell_exec",
        description: "dangerous",
        scope: "local",
        risk_notes: "high",
        requires_approval: true,
      },
    ],
    approvalToken: "approval-xyz",
  });

  assert.equal(success.executedActions.length, 1);
  assert.ok(success.logs[0].includes("approval token approval-xyz"));
});
