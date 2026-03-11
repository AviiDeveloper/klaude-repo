import { AgentRequest, AgentResponse } from "../types/task.js";
import { ModelProvider, createModelProvider } from "../models/provider.js";

export class CodeAgent {
  readonly name = "code-agent" as const;
  constructor(private readonly provider: ModelProvider = createModelProvider()) {}

  async run(request: AgentRequest): Promise<AgentResponse> {
    if (
      /slow|long running|heavy/i.test(request.objective) &&
      request.plan_step === "Prepare code changes"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 3200));
    }

    const riskyObjective = /deploy|shell|network|write file|git push|message send/i.test(
      request.objective,
    );
    const isExecutionStep = request.plan_step === "Prepare code changes";
    const requiresApproval = riskyObjective && isExecutionStep;

    if (requiresApproval && request.approval_token) {
      return {
        task_id: request.task_id,
        agent_name: this.name,
        status: "ok",
        summary: `Prepared approved side effect execution for step: ${request.plan_step}`,
        actions_proposed: [
          {
            type: "file_write",
            description: "Write generated code artifacts to workspace.",
            scope: "project repository",
            risk_notes: "Code changes may alter behavior; review before apply.",
            requires_approval: true,
          },
        ],
        artifacts: [],
        logs: [`CodeAgent prepared approved side effect with token ${request.approval_token}.`],
      };
    }

    if (requiresApproval) {
      return {
        task_id: request.task_id,
        agent_name: this.name,
        status: "needs_approval",
        summary: `Proposed side effect for approval: ${request.plan_step}`,
        actions_proposed: [
          {
            type: "file_write",
            description: "Write generated code artifacts to workspace.",
            scope: "project repository",
            risk_notes: "Code changes may alter behavior; review before apply.",
            requires_approval: true,
          },
        ],
        artifacts: [],
        logs: ["CodeAgent proposed side effect and requested approval."],
      };
    }

    const providerOutput = await this.provider.agentOutput({
      agent: this.name,
      request,
    });

    return {
      task_id: request.task_id,
      agent_name: this.name,
      status: "ok",
      summary: providerOutput.summary,
      actions_proposed: [],
      artifacts: [],
      logs: providerOutput.logs,
    };
  }
}
