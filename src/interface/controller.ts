import { CallerModel } from "../caller/callerModel.js";
import { LatencyRecord, LatencyTracker } from "../metrics/latencyTracker.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";

export interface InterfaceMessageInput {
  session_id: string;
  user_id: string;
  text: string;
  source: "openclaw" | "local";
}

export interface InterfaceApprovalDecisionInput {
  session_id: string;
  user_id: string;
  task_id: string;
  approval_id: string;
  decision: "approved" | "denied";
}

export interface InterfaceMessageOutput {
  text: string;
  active_task_id?: string;
  phase?: "ack" | "progress" | "detail";
  latency_ms?: number;
}

export interface InterfaceApprovalRequest {
  task_id: string;
  side_effects: Array<{
    type: string;
    description: string;
    scope: string;
    risk_notes: string;
  }>;
  risks: string[];
  rollback_notes: string;
  decision_options: ["approve", "deny"];
}

export interface InterfaceNotificationRequest {
  channel: "notify_user" | "call_user";
  reason:
    | "missing_input"
    | "task_blocked"
    | "task_failed"
    | "approval_denied";
  message: string;
  task_id?: string;
  severity: "info" | "warning" | "critical";
}

interface SessionContext {
  session_id: string;
  active_task_id?: string;
  changelog_change_id: string;
}

export class InterfaceController {
  private readonly sessionContext = new Map<string, SessionContext>();

  constructor(
    private readonly orchestrator: Orchestrator,
    private readonly callerModel: CallerModel,
    private readonly changelogChangeId: string,
    private readonly latencyTracker: LatencyTracker,
  ) {}

  async handleMessage(
    input: InterfaceMessageInput,
  ): Promise<{
    messages: InterfaceMessageOutput[];
    approvalRequests: InterfaceApprovalRequest[];
    notifications: InterfaceNotificationRequest[];
    metrics: LatencyRecord;
  }> {
    const startedAt = Date.now();
    const normalized = input.text.trim().toLowerCase();
    if (this.isGreetingOnly(normalized)) {
      const ackLatencyMs = Date.now() - startedAt;
      const metrics = this.latencyTracker.record({
        sessionId: input.session_id,
        source: input.source,
        ackLatencyMs,
        totalLatencyMs: ackLatencyMs,
      });

      return {
        messages: [
          {
            text: "Hey. I am online and ready when you are.",
            phase: "ack",
            latency_ms: ackLatencyMs,
          },
          {
            text: "Tell me what you want to build next.",
            phase: "detail",
            latency_ms: ackLatencyMs,
          },
        ],
        approvalRequests: [],
        notifications: [],
        metrics,
      };
    }

    if (this.isMissingInput(normalized)) {
      const ackLatencyMs = Date.now() - startedAt;
      const metrics = this.latencyTracker.record({
        sessionId: input.session_id,
        source: input.source,
        ackLatencyMs,
        totalLatencyMs: ackLatencyMs,
      });

      return {
        messages: [
          {
            text: "I need a bit more detail before I can create a task.",
            phase: "ack",
            latency_ms: ackLatencyMs,
          },
          {
            text: "Please include the goal and any constraints (for example: target platform, deadline, or tools).",
            phase: "detail",
            latency_ms: ackLatencyMs,
          },
        ],
        approvalRequests: [],
        notifications: [
          {
            channel: "call_user",
            reason: "missing_input",
            message: "Request is ambiguous or missing required inputs.",
            severity: "warning",
          },
        ],
        metrics,
      };
    }

    const intent = await this.callerModel.parseMessage(input.text);
    const ackLatencyMs = Date.now() - startedAt;

    const task = await this.orchestrator.createTask({
      title: intent.title,
      objective: intent.objective,
      constraints: [
        "Single node only",
        "No side effects without explicit approval token",
        "Max two agents",
      ],
      rollback_plan: "Rollback by reverting changes tied to task artifacts.",
      stop_conditions: ["Ambiguous objective", "Missing required input"],
    });

    this.sessionContext.set(input.session_id, {
      session_id: input.session_id,
      active_task_id: task.id,
      changelog_change_id: this.changelogChangeId,
    });

    const progressMessages: InterfaceMessageOutput[] = [];
    const executionPromise = this.orchestrator.executeTask(task.id);
    const executionWithFlag = executionPromise.then(() => true);
    let completed = false;

    while (!completed) {
      const result = await Promise.race([
        executionWithFlag,
        this.sleep(3000).then(() => false),
      ]);
      if (result) {
        completed = true;
        break;
      }

      const elapsedMs = Date.now() - startedAt;
      progressMessages.push({
        text: `Progress update: still working (${Math.round(elapsedMs / 1000)}s elapsed).`,
        active_task_id: task.id,
        phase: "progress",
        latency_ms: elapsedMs,
      });
    }

    let latest = this.orchestrator.getTask(task.id) ?? task;
    let failedError: unknown;
    try {
      await executionPromise;
      latest = this.orchestrator.getTask(task.id) ?? latest;
    } catch (error) {
      failedError = error;
      latest = this.orchestrator.getTask(task.id) ?? {
        ...latest,
        status: "failed",
      };
    }

    const totalLatencyMs = Date.now() - startedAt;
    const metrics = this.latencyTracker.record({
      sessionId: input.session_id,
      source: input.source,
      ackLatencyMs,
      totalLatencyMs,
    });

    const approvalRequests: InterfaceApprovalRequest[] =
      latest.status === "awaiting_approval"
        ? [
            {
              task_id: latest.id,
              side_effects: latest.approvals_required.map((proposal) => ({
                type: proposal.type,
                description: proposal.description,
                scope: proposal.scope,
                risk_notes: proposal.risk_notes,
              })),
              risks: latest.approvals_required.map((proposal) => proposal.risk_notes),
              rollback_notes: latest.rollback_plan,
              decision_options: ["approve", "deny"],
            },
          ]
        : [];

    const notifications: InterfaceNotificationRequest[] = [];
    if (failedError || latest.status === "failed") {
      notifications.push({
        channel: "call_user",
        reason: "task_failed",
        message: `Task ${task.id} failed: ${String(failedError ?? "unknown error")}`,
        task_id: task.id,
        severity: "critical",
      });
    } else if (latest.status === "blocked") {
      notifications.push({
        channel: "notify_user",
        reason: "task_blocked",
        message: `Task ${task.id} is blocked and needs user action.`,
        task_id: task.id,
        severity: "warning",
      });
    }

    return {
      messages: [
        {
          text: `${intent.acknowledgement} Task ID: ${task.id}`,
          active_task_id: task.id,
          phase: "ack",
          latency_ms: ackLatencyMs,
        },
        ...progressMessages,
        {
          text:
            latest.status === "awaiting_approval"
              ? "Task is awaiting approval before side effects can run."
              : latest.status === "failed"
                ? "Task failed during execution. I have escalated this via callback."
              : "Execution completed for your request.",
          active_task_id: task.id,
          phase: "detail",
          latency_ms: totalLatencyMs,
        },
      ],
      approvalRequests,
      notifications,
      metrics,
    };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isGreetingOnly(text: string): boolean {
    const greetings = new Set([
      "hi",
      "hello",
      "hey",
      "yo",
      "sup",
      "good morning",
      "good afternoon",
      "good evening",
    ]);
    return greetings.has(text);
  }

  async handleApprovalDecision(
    input: InterfaceApprovalDecisionInput,
  ): Promise<{
    messages: InterfaceMessageOutput[];
    notifications: InterfaceNotificationRequest[];
  }> {
    const task = await this.orchestrator.resolveApprovalDecision({
      taskId: input.task_id,
      approvalId: input.approval_id,
      decision: input.decision,
    });

    return {
      messages: [
        {
          text:
            input.decision === "approved"
              ? `Approval accepted. Task ${task.id} resumed and is ${task.status}.`
              : `Approval denied. Task ${task.id} is now blocked.`,
          active_task_id: task.id,
        },
      ],
      notifications:
        input.decision === "denied"
          ? [
              {
                channel: "notify_user",
                reason: "approval_denied",
                message: `Task ${task.id} is blocked because approval was denied.`,
                task_id: task.id,
                severity: "warning",
              },
            ]
          : [],
    };
  }

  private isMissingInput(text: string): boolean {
    if (!text) {
      return true;
    }

    const weakPhrases = new Set([
      "do it",
      "do this",
      "same",
      "idk",
      "not sure",
      "whatever",
    ]);
    if (weakPhrases.has(text)) {
      return true;
    }

    const words = text.split(/\s+/).filter(Boolean);
    return words.length <= 1;
  }
}
