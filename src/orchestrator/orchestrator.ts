import { randomUUID } from "node:crypto";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { EventBus } from "../events/bus.js";
import { SideEffectExecutor } from "../sideEffects/executor.js";
import { TaskStore } from "../storage/taskStore.js";
import { TraceStore } from "../trace/traceStore.js";
import { TraceSideEffect } from "../trace/types.js";
import { AgentRequest, Task } from "../types/task.js";

export interface CreateTaskInput {
  title: string;
  objective: string;
  constraints: string[];
  rollback_plan: string;
  stop_conditions: string[];
}

interface ExecuteTaskOptions {
  approvalToken?: string;
}

export class Orchestrator {
  constructor(
    private readonly taskStore: TaskStore,
    private readonly bus: EventBus,
    private readonly codeAgent: CodeAgent,
    private readonly opsAgent: OpsAgent,
    private readonly traceStore: TraceStore,
    private readonly sideEffectExecutor = new SideEffectExecutor(),
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const planSteps = this.createPlanSteps(input.objective);

    const task: Task = {
      id: randomUUID(),
      title: input.title,
      created_at: new Date().toISOString(),
      status: "created",
      objective: input.objective,
      constraints: input.constraints,
      plan_steps: planSteps,
      assigned_agents: [this.codeAgent.name, this.opsAgent.name],
      approvals_required: [],
      artifacts: [],
      logs: ["Task created by orchestrator."],
      side_effects: [],
      rollback_plan: input.rollback_plan,
      stop_conditions: input.stop_conditions,
    };

    this.taskStore.save(task);
    await this.traceStore.create(task);
    await this.traceStore.appendTimeline(task.id, {
      timestamp: new Date().toISOString(),
      event_type: "task.created",
      component: "orchestrator",
      summary: "Task created.",
      details: { task_id: task.id, title: task.title },
    });
    await this.traceStore.appendTimeline(task.id, {
      timestamp: new Date().toISOString(),
      event_type: "plan.generated",
      component: "orchestrator",
      summary: "Plan generated.",
      details: { plan_steps: planSteps },
    });
    await this.bus.publish("task.created", { task_id: task.id });
    return task;
  }

  getTask(taskId: string): Task | undefined {
    return this.taskStore.get(taskId);
  }

  async executeTask(taskId: string, options: ExecuteTaskOptions = {}): Promise<Task> {
    const task = this.taskStore.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    this.taskStore.update(taskId, (current) => ({
      ...current,
      status: "in_progress",
      logs: [...current.logs, "Execution started."],
    }));

    try {
      for (const [index, step] of task.plan_steps.entries()) {
        const agent = index % 2 === 0 ? this.codeAgent : this.opsAgent;
        const request: AgentRequest = {
          task_id: task.id,
          agent_name: agent.name,
          objective: task.objective,
          plan_step: step,
          constraints: task.constraints,
          inputs: [],
          approval_token: options.approvalToken,
        };

        await this.traceStore.appendTimeline(task.id, {
          timestamp: new Date().toISOString(),
          event_type: "agent.requested",
          component: "orchestrator",
          summary: "Agent requested.",
          details: { agent: agent.name, step },
        });

        await this.bus.publish("agent.requested", {
          task_id: task.id,
          agent: agent.name,
          step,
        });

        const response = await agent.run(request);

        await this.traceStore.appendTimeline(task.id, {
          timestamp: new Date().toISOString(),
          event_type: "agent.completed",
          component: agent.name === "code-agent" ? "agent.code" : "agent.ops",
          summary: "Agent completed.",
          details: { agent: agent.name, status: response.status },
        });

        await this.bus.publish("agent.completed", {
          task_id: task.id,
          agent: agent.name,
          status: response.status,
        });

        const approvals = response.actions_proposed.filter(
          (proposal) => proposal.requires_approval,
        );
        if (
          (approvals.length > 0 || response.status === "needs_approval") &&
          !options.approvalToken
        ) {
          const awaitingApproval = this.taskStore.update(taskId, (current) => ({
            ...current,
            status: "awaiting_approval",
            logs: [...current.logs, ...response.logs, response.summary],
            approvals_required: [...current.approvals_required, ...approvals],
            side_effects: [...current.side_effects, ...response.actions_proposed],
            artifacts: [...current.artifacts, ...response.artifacts],
          }));

          await this.traceStore.appendTimeline(task.id, {
            timestamp: new Date().toISOString(),
            event_type: "approval.requested",
            component: "orchestrator",
            summary: "Approval requested for side effects.",
            details: {
              task_id: task.id,
              side_effects: approvals,
              rollback_plan: awaitingApproval.rollback_plan,
            },
          });

          await this.bus.publish("approval.requested", {
            task_id: task.id,
            side_effects: approvals,
            risks: approvals.map((item) => item.risk_notes),
            rollback_notes: awaitingApproval.rollback_plan,
            decision_options: ["approve", "deny"],
          });

          return awaitingApproval;
        }

        const sideEffectExecution = await this.sideEffectExecutor.execute({
          taskId: task.id,
          actions: response.actions_proposed,
          approvalToken: options.approvalToken,
        });

        this.taskStore.update(taskId, (current) => ({
          ...current,
          logs: [
            ...current.logs,
            ...response.logs,
            ...sideEffectExecution.logs,
            response.summary,
          ],
          side_effects: [...current.side_effects, ...sideEffectExecution.executedActions],
          artifacts: [...current.artifacts, ...response.artifacts],
        }));
      }
    } catch (error) {
      this.taskStore.update(taskId, (current) => ({
        ...current,
        status: "failed",
        logs: [...current.logs, `Execution failed: ${String(error)}`],
      }));
      await this.traceStore.appendTimeline(task.id, {
        timestamp: new Date().toISOString(),
        event_type: "error",
        component: "orchestrator",
        summary: "Task execution failed.",
        details: { error: String(error) },
      });
      await this.traceStore.finalize({
        taskId: task.id,
        finalState: "failed",
        sideEffects: [],
        artifacts: [],
      });
      throw error;
    }

    const completed = this.taskStore.update(taskId, (current) => ({
      ...current,
      status: "completed",
      logs: [...current.logs, "Execution completed."],
    }));

    await this.traceStore.finalize({
      taskId: task.id,
      finalState: "completed",
      sideEffects: this.toTraceSideEffects(
        completed.side_effects,
        options.approvalToken ?? "none",
      ),
      artifacts: completed.artifacts,
    });

    return completed;
  }

  private createPlanSteps(objective: string): string[] {
    return [
      `Clarify objective: ${objective}`,
      "Break objective into implementation tasks",
      "Prepare code changes",
    ];
  }

  async resolveApprovalDecision(input: {
    taskId: string;
    approvalId: string;
    decision: "approved" | "denied";
  }): Promise<Task> {
    const task = this.taskStore.get(input.taskId);
    if (!task) {
      throw new Error(`Task not found: ${input.taskId}`);
    }
    if (task.status !== "awaiting_approval") {
      throw new Error(`Task is not awaiting approval: ${input.taskId}`);
    }

    await this.traceStore.appendTimeline(task.id, {
      timestamp: new Date().toISOString(),
      event_type: "approval.resolved",
      component: "openclaw",
      summary: "Approval decision received.",
      details: {
        task_id: task.id,
        approval_id: input.approvalId,
        decision: input.decision,
      },
    });

    await this.bus.publish("approval.resolved", {
      task_id: task.id,
      approval_id: input.approvalId,
      decision: input.decision,
    });

    if (input.decision === "denied") {
      const blocked = this.taskStore.update(task.id, (current) => ({
        ...current,
        status: "blocked",
        logs: [
          ...current.logs,
          `Approval denied (${input.approvalId}). Side effects canceled.`,
        ],
      }));

      await this.traceStore.appendTimeline(task.id, {
        timestamp: new Date().toISOString(),
        event_type: "notify.requested",
        component: "orchestrator",
        summary: "User notification requested for denied approval.",
        details: { task_id: task.id, approval_id: input.approvalId },
      });

      await this.bus.publish("notify.requested", {
        task_id: task.id,
        reason: "approval_denied",
      });

      await this.traceStore.finalize({
        taskId: task.id,
        finalState: "blocked",
        sideEffects: this.toTraceSideEffects(
          blocked.side_effects,
          input.approvalId,
        ),
        artifacts: blocked.artifacts,
      });
      return blocked;
    }

    this.taskStore.update(task.id, (current) => ({
      ...current,
      status: "in_progress",
      approvals_required: [],
      logs: [...current.logs, `Approval granted (${input.approvalId}). Resuming.`],
    }));

    return this.executeTask(task.id, { approvalToken: input.approvalId });
  }

  private toTraceSideEffects(
    sideEffects: Task["side_effects"],
    approvalTokenId = "none",
  ): TraceSideEffect[] {
    return sideEffects.map((sideEffect) => ({
      type: sideEffect.type,
      description: sideEffect.description,
      approved_by_token_id: approvalTokenId,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      result: "proposed_only",
    }));
  }
}
