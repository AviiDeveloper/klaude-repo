import { randomUUID } from "node:crypto";
import { NotificationStore } from "../notifications/notificationStore.js";
import { MultiAgentRuntime } from "./agentRuntime.js";
import { DispatchReasonCode, PostDispatchAdapter } from "./postDispatch.js";
import { SQLitePipelineStore } from "./sqlitePipelineStore.js";
import { PipelineBudgetPolicy, PipelineNodeRun, PipelineRun } from "./types.js";

export class PipelineEngine {
  constructor(
    private readonly store: SQLitePipelineStore,
    private readonly runtime: MultiAgentRuntime,
    private readonly notificationStore?: NotificationStore,
    private readonly budgetPolicy: PipelineBudgetPolicy = {
      max_cost_per_task_usd: Number(process.env.HIGGSFIELD_MAX_COST_PER_TASK_USD ?? "10"),
      max_cost_per_day_usd: Number(process.env.HIGGSFIELD_MAX_COST_PER_DAY_USD ?? "50"),
    },
    private readonly dispatchAdapters?: Map<string, PostDispatchAdapter>,
  ) {}

  createDefaultDefinition(): ReturnType<SQLitePipelineStore["upsertDefinition"]> {
    return this.store.upsertDefinition({
      id: "content-automation-default",
      name: "Content Automation Default",
      enabled: true,
      schedule_rrule: "FREQ=HOURLY;INTERVAL=1",
      max_retries: 1,
      nodes: [
        { id: "trend-scout", agent_id: "trend-scout-agent", depends_on: [] },
        {
          id: "research-verify",
          agent_id: "research-verifier-agent",
          depends_on: ["trend-scout"],
        },
        {
          id: "idea-rank",
          agent_id: "idea-ranker-agent",
          depends_on: ["research-verify"],
        },
        {
          id: "script-write",
          agent_id: "script-writer-agent",
          depends_on: ["idea-rank"],
        },
        {
          id: "media-generate",
          agent_id: "media-generator-agent",
          depends_on: ["script-write"],
          paid_action: true,
        },
        {
          id: "compliance-review",
          agent_id: "compliance-reviewer-agent",
          depends_on: ["media-generate"],
        },
        {
          id: "publisher",
          agent_id: "publisher-agent",
          depends_on: ["compliance-review"],
          paid_action: true,
        },
        {
          id: "performance-analyze",
          agent_id: "performance-analyst-agent",
          depends_on: ["publisher"],
        },
      ],
      config: {
        platforms: ["tiktok", "reels", "shorts"],
      },
    });
  }

  createLeadGenerationDefinition(): ReturnType<SQLitePipelineStore["upsertDefinition"]> {
    return this.store.upsertDefinition({
      id: "lead-generation-v1",
      name: "Lead Generation Pipeline",
      enabled: true,
      schedule_rrule: "FREQ=DAILY;INTERVAL=1",
      max_retries: 1,
      nodes: [
        { id: "scout", agent_id: "lead-scout-agent", depends_on: [] },
        {
          id: "profile",
          agent_id: "lead-profiler-agent",
          depends_on: ["scout"],
        },
        {
          id: "qualify",
          agent_id: "lead-qualifier-agent",
          depends_on: ["profile"],
        },
      ],
      config: {},
    });
  }

  createSiteGenerationDefinition(): ReturnType<SQLitePipelineStore["upsertDefinition"]> {
    return this.store.upsertDefinition({
      id: "site-generation-v1",
      name: "Site Generation Pipeline",
      enabled: true,
      schedule_rrule: "",
      max_retries: 1,
      nodes: [
        { id: "compose", agent_id: "site-composer-agent", depends_on: [] },
        {
          id: "qa",
          agent_id: "site-qa-agent",
          depends_on: ["compose"],
        },
      ],
      config: {},
    });
  }

  async startRun(input: {
    definitionId: string;
    trigger: PipelineRun["trigger"];
    approval_token?: string;
  }): Promise<PipelineRun> {
    const definition = this.store.getDefinition(input.definitionId);
    if (!definition) {
      throw new Error(`pipeline definition not found: ${input.definitionId}`);
    }
    const run = this.store.createRun({
      definition,
      trigger: input.trigger,
      approval_token: input.approval_token,
    });
    await this.executeRun(run.id);
    this.store.bumpNextRunAt(definition.id, new Date().toISOString());
    const updated = this.store.getRun(run.id);
    if (!updated) {
      throw new Error(`pipeline run not found: ${run.id}`);
    }
    return updated;
  }

  async executeRun(runId: string): Promise<void> {
    this.store.setRunStatus(runId, "running");
    let safety = 0;
    while (safety < 200) {
      safety += 1;
      const runnable = this.store.listRunnableNodes(runId);
      if (runnable.length === 0) {
        break;
      }
      for (const node of runnable) {
        const done = await this.executeNode(runId, node);
        if (!done) {
          this.store.setRunStatus(runId, "blocked", `blocked at ${node.node_id}`);
          return;
        }
      }
      this.store.recomputeBlockedNodes(runId);
    }
    this.finalizeRun(runId);
  }

  async retryNode(runId: string, nodeId: string): Promise<void> {
    const node = this.store.getNodeRun(runId, nodeId);
    if (!node) {
      throw new Error(`node not found: ${runId}/${nodeId}`);
    }
    this.store.setNodeStatus({
      runId,
      nodeId,
      status: "pending",
      error: undefined,
    });
    this.store.recomputeBlockedNodes(runId);
    await this.executeRun(runId);
  }

  async overrideNode(runId: string, nodeId: string, reason: string): Promise<void> {
    this.store.setNodeStatus({
      runId,
      nodeId,
      status: "completed",
      error: `manually overridden: ${reason}`,
      ended: true,
      started: true,
    });
    this.store.recomputeBlockedNodes(runId);
    await this.executeRun(runId);
  }

  private async executeNode(runId: string, node: PipelineNodeRun): Promise<boolean> {
    const run = this.store.getRun(runId);
    if (!run) {
      throw new Error(`pipeline run not found: ${runId}`);
    }
    if (node.paid_action && !run.approval_token) {
      this.store.setNodeStatus({
        runId,
        nodeId: node.node_id,
        status: "awaiting_approval",
        error: "approval token required for paid node",
      });
      this.notify({
        session_id: runId,
        user_id: "mission-control",
        reason: "approval_required",
        severity: "warning",
        message: `Run ${runId} blocked at ${node.node_id}: approval token required.`,
      });
      this.store.blockDependents(runId, node.node_id, "awaiting approval");
      return false;
    }

    const maxRetries = this.store.getDefinition(run.pipeline_definition_id)?.max_retries ?? 1;
    let attempt = node.attempts;
    while (attempt <= maxRetries) {
      attempt += 1;
      this.store.setNodeStatus({
        runId,
        nodeId: node.node_id,
        status: "running",
        attempts: attempt,
        started: true,
      });
      const upstreamArtifacts = this.collectUpstreamArtifacts(runId, node.depends_on);
      const task = this.store.appendAgentTask({
        run_id: runId,
        node_id: node.node_id,
        agent_id: node.agent_id,
        status: "running",
        started_at: new Date().toISOString(),
        input_json: {
          config: node.config ?? {},
          upstream: upstreamArtifacts,
        },
      });
      try {
        const settled = await this.runtime.execute({
          run_id: runId,
          node_id: node.node_id,
          agent_id: node.agent_id,
          config: node.config,
          upstreamArtifacts,
        });
        this.store.appendAgentTask({
          run_id: runId,
          node_id: node.node_id,
          agent_id: node.agent_id,
          status: "completed",
          started_at: task.started_at,
          completed_at: new Date().toISOString(),
          input_json: task.input_json,
          output_json: settled.artifacts,
        });
        this.store.appendArtifact({
          run_id: runId,
          node_id: node.node_id,
          kind: "agent.output",
          value_json: settled.artifacts,
        });
        if (settled.cost_usd && settled.cost_usd > 0) {
          if (!this.withinBudget(runId, settled.cost_usd)) {
            this.store.setNodeStatus({
              runId,
              nodeId: node.node_id,
              status: "failed",
              error: "budget cap exceeded",
              ended: true,
            });
            this.store.blockDependents(runId, node.node_id, "budget cap exceeded");
            this.notify({
              session_id: runId,
              user_id: "mission-control",
              reason: "budget_exceeded",
              severity: "critical",
              message: `Run ${runId} exceeded budget at ${node.node_id}.`,
            });
            return false;
          }
          this.store.appendSpendLedger({
            timestamp: new Date().toISOString(),
            scope: "task",
            reference_id: runId,
            provider: "higgsfield",
            amount_usd: settled.cost_usd,
          });
        }
        if (node.agent_id === "media-generator-agent") {
          this.store.createMediaJob({
            run_id: runId,
            node_id: node.node_id,
            provider: "higgsfield",
            status: "completed",
            input_json: task.input_json,
            output_json: settled.artifacts,
            cost_usd: settled.cost_usd,
            approved_by_token: run.approval_token,
          });
        }
        if (node.agent_id === "publisher-agent" && settled.post_payloads) {
          for (const payload of settled.post_payloads) {
            this.store.enqueuePost({
              run_id: runId,
              platform: payload.platform,
              status: "pending_approval",
              payload_json: payload.payload,
            });
          }
        }
        this.store.setNodeStatus({
          runId,
          nodeId: node.node_id,
          status: "completed",
          attempts: attempt,
          ended: true,
        });
        return true;
      } catch (error) {
        if (attempt <= maxRetries) {
          continue;
        }
        this.store.setNodeStatus({
          runId,
          nodeId: node.node_id,
          status: "failed",
          attempts: attempt,
          error: String(error),
          ended: true,
        });
        this.store.blockDependents(runId, node.node_id, String(error));
        this.notify({
          session_id: runId,
          user_id: "mission-control",
          reason: "pipeline_blocked",
          severity: "critical",
          message: `Node ${node.node_id} failed: ${String(error)}`,
        });
        return false;
      }
    }
    return false;
  }

  async dispatchPostQueueItem(input: {
    id: string;
    approvedBy?: string;
  }): Promise<{
    status: string;
    detail: string;
    reason_code:
      | DispatchReasonCode
      | "POLICY_APPROVAL_REQUIRED"
      | "MISSING_ADAPTER"
      | "ALREADY_DEAD_LETTER";
    retry_after_ms?: number;
    attempts: number;
  }> {
    const maxAttempts = 3;
    const retryBackoffMs = [3000, 15000, 60000];

    const queue = this.store.listPostQueue(500).find((item) => item.id === input.id);
    if (!queue) {
      throw new Error("post queue item not found");
    }
    if (queue.status === "dead_letter") {
      return {
        status: "dead_letter",
        detail: "item already in dead-letter",
        reason_code: "ALREADY_DEAD_LETTER",
        attempts: queue.attempts,
      };
    }
    if (queue.status === "pending_approval") {
      if (!input.approvedBy) {
        const attempts = queue.attempts + 1;
        this.store.patchPostQueue(queue.id, {
          status: "dead_letter",
          attempts,
          last_error: JSON.stringify({
            reason_code: "POLICY_APPROVAL_REQUIRED",
            detail: "approved_by is required before delivery",
            retryable: false,
          }),
        });
        return {
          status: "dead_letter",
          detail: "approved_by is required before delivery",
          reason_code: "POLICY_APPROVAL_REQUIRED",
          attempts,
        };
      }
      this.store.patchPostQueue(queue.id, {
        status: "approved",
        approved_by: input.approvedBy ?? "mission-control",
      });
    }
    const active = this.store.listPostQueue(500).find((item) => item.id === input.id);
    if (!active) {
      throw new Error("post queue item missing after approval");
    }
    const adapter = this.dispatchAdapters?.get(active.platform);
    if (!adapter) {
      const attempts = active.attempts + 1;
      const status = attempts >= maxAttempts ? "dead_letter" : "failed";
      this.store.patchPostQueue(active.id, {
        status,
        last_error: JSON.stringify({
          reason_code: "MISSING_ADAPTER",
          detail: `no dispatch adapter configured for ${active.platform}`,
          retryable: attempts < maxAttempts,
        }),
        attempts,
      });
      return {
        status,
        detail: "missing adapter",
        reason_code: "MISSING_ADAPTER",
        retry_after_ms: attempts < maxAttempts ? retryBackoffMs[Math.min(attempts - 1, retryBackoffMs.length - 1)] : undefined,
        attempts,
      };
    }
    const nextAttempt = active.attempts + 1;
    const result = await adapter.dispatch({
      payload: active.payload_json,
      idempotency_key: `post-${active.id}-attempt-${nextAttempt}`,
      queue_id: active.id,
      run_id: active.run_id,
      attempt: nextAttempt,
    });
    if (!result.success) {
      const attempts = nextAttempt;
      const retryAfterMs = result.retryable
        ? retryBackoffMs[Math.min(attempts - 1, retryBackoffMs.length - 1)]
        : undefined;
      const status =
        !result.retryable || attempts >= maxAttempts ? "dead_letter" : "failed";
      this.store.patchPostQueue(active.id, {
        status,
        attempts,
        last_error: JSON.stringify({
          reason_code: result.reason_code,
          detail: result.detail,
          retryable: result.retryable,
          retry_after_ms: retryAfterMs,
          http_status: result.http_status,
        }),
      });
      return {
        status,
        detail: result.detail,
        reason_code: result.reason_code,
        retry_after_ms: retryAfterMs,
        attempts,
      };
    }
    this.store.patchPostQueue(active.id, {
      status: "dispatched",
      attempts: nextAttempt,
      dispatched_at: new Date().toISOString(),
      last_error: undefined,
    });
    return {
      status: "dispatched",
      detail: result.detail,
      reason_code: result.reason_code,
      attempts: nextAttempt,
    };
  }

  private finalizeRun(runId: string): void {
    const nodes = this.store.listNodeRuns(runId);
    const hasFailed = nodes.some((node) => node.status === "failed");
    const hasBlocked = nodes.some(
      (node) => node.status === "blocked" || node.status === "awaiting_approval",
    );
    const allCompleted = nodes.length > 0 && nodes.every((node) => node.status === "completed");
    if (allCompleted) {
      this.store.setRunStatus(runId, "completed");
      return;
    }
    if (hasFailed) {
      this.store.setRunStatus(runId, "failed");
      return;
    }
    if (hasBlocked) {
      this.store.setRunStatus(runId, "blocked");
      return;
    }
    this.store.setRunStatus(runId, "running");
  }

  private collectUpstreamArtifacts(
    runId: string,
    dependencyNodeIds: string[],
  ): Record<string, unknown> {
    if (dependencyNodeIds.length === 0) {
      return {};
    }
    const artifacts = this.store
      .listArtifacts(runId)
      .filter((artifact) => dependencyNodeIds.includes(artifact.node_id));
    const merged: Record<string, unknown> = {};
    for (const artifact of artifacts) {
      merged[artifact.node_id] = artifact.value_json;
    }
    return merged;
  }

  private withinBudget(runId: string, nextCostUsd: number): boolean {
    const taskSpend = this.store.taskSpendUsd(runId);
    if (taskSpend + nextCostUsd > this.budgetPolicy.max_cost_per_task_usd) {
      return false;
    }
    const daySpend = this.store.dailySpendUsd(new Date().toISOString());
    return daySpend + nextCostUsd <= this.budgetPolicy.max_cost_per_day_usd;
  }

  private notify(input: {
    session_id: string;
    user_id: string;
    reason:
      | "pipeline_blocked"
      | "budget_exceeded"
      | "approval_required";
    severity: "info" | "warning" | "critical";
    message: string;
  }): void {
    this.notificationStore
      ?.append({
        event_id: randomUUID(),
        created_at: new Date().toISOString(),
        channel: "notify_user",
        reason: input.reason,
        message: input.message,
        severity: input.severity,
        session_id: input.session_id,
        user_id: input.user_id,
      })
      .catch(() => undefined);
  }
}
