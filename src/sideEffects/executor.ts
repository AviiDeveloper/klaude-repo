import { SideEffectProposal } from "../types/task.js";

export interface ExecuteSideEffectsInput {
  taskId: string;
  actions: SideEffectProposal[];
  approvalToken?: string;
}

export interface ExecuteSideEffectsResult {
  executedActions: SideEffectProposal[];
  logs: string[];
}

export class SideEffectExecutor {
  async execute(input: ExecuteSideEffectsInput): Promise<ExecuteSideEffectsResult> {
    const logs: string[] = [];

    for (const action of input.actions) {
      if (action.requires_approval && !input.approvalToken) {
        throw new Error(
          `Approval token required for side effect execution: ${action.type}`,
        );
      }

      if (action.requires_approval) {
        logs.push(
          `Side effect executed with approval token ${input.approvalToken}: ${action.type} (${action.description})`,
        );
      } else {
        logs.push(`Side effect executed: ${action.type} (${action.description})`);
      }
    }

    return {
      executedActions: input.actions,
      logs,
    };
  }
}
