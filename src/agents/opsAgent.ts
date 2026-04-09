/**
 * @deprecated Use AgentCapabilityRegistry from src/runtime/agent-registry.ts instead.
 * OpsAgent was a minimal delegation stub. The unified engine routes to agents
 * by capability rather than alternating between two hardcoded agent types.
 */
import { AgentRequest, AgentResponse } from "../types/task.js";
import { ModelProvider, createModelProvider } from "../models/provider.js";

export class OpsAgent {
  readonly name = "ops-agent" as const;
  constructor(private readonly provider: ModelProvider = createModelProvider()) {}

  async run(request: AgentRequest): Promise<AgentResponse> {
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
