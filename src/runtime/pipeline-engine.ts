/**
 * Unified Pipeline Engine — merges Orchestrator + PipelineEngine into one
 * execution system with approval gates, reflection hooks, and working memory.
 *
 * Replaces:
 *   - src/orchestrator/orchestrator.ts (approval logic, trace events)
 *   - src/pipeline/engine.ts (DAG execution, budget, retry)
 *
 * Keeps all existing pipeline infrastructure (SQLitePipelineStore, types, etc.)
 */

import { randomUUID } from "node:crypto";
import { createLogger } from "../lib/logger.js";
import { EventBus } from "../events/bus.js";
import { NotificationReason, NotificationStore } from "../notifications/notificationStore.js";
import { PostDispatchAdapter, DispatchReasonCode } from "../pipeline/postDispatch.js";
import { SQLitePipelineStore } from "../pipeline/sqlitePipelineStore.js";
import {
  PipelineBudgetPolicy,
  PipelineNodeRun,
  PipelineRun,
} from "../pipeline/types.js";
import { AgentCapabilityRegistry } from "./agent-registry.js";
import { InMemoryWorkingMemory, WorkingMemory } from "./working-memory.js";
import type { CriticInput, CriticModel } from "../evaluation/critic-model.js";
import { ReflectionLoop, ReflectionOutput } from "../evaluation/reflection-loop.js";
import type { EpisodicStore, CriticScoreRecord } from "../memory/episodic-store.js";

const log = createLogger("unified-engine");

// ── Public interfaces ──

export interface ApprovalToken {
  token: string;
  granted_by: string;
  granted_at: string;
  scope: string[];
}

export interface StartRunInput {
  definitionId: string;
  trigger: "scheduler" | "manual" | "retry" | "replan";
  priority?: number;
  parentRunId?: string;
  correlationId?: string;
  approval_token?: string;
}

export interface StrategyEntry {
  id: string;
  vertical: string;
  region?: string;
  strategy_type: string;
  parameters: Record<string, unknown>;
  close_rate?: number;
  confidence_lower?: number;
  confidence_upper?: number;
  status: string;
}

export interface CriticEvaluation {
  score: number;
  prediction: "likely_close" | "unlikely_close" | "uncertain";
  critique: {
    strengths: string[];
    weaknesses: string[];
    specific_suggestions: string[];
  };
  confidence: number;
  model_version: string;
}

export type ReflectionHook = (
  runId: string,
  nodeId: string,
  output: Record<string, unknown>,
) => Promise<CriticEvaluation | null>;

export type StrategyProvider = (
  vertical: string,
  region?: string,
) => StrategyEntry[];

// ── Engine ──

export class UnifiedPipelineEngine {
  private readonly workingMemories = new Map<string, InMemoryWorkingMemory>();
  private reflectionLoop?: ReflectionLoop;
  private readonly criticScores = new Map<string, CriticScoreRecord[]>();

  constructor(
    private readonly store: SQLitePipelineStore,
    private readonly registry: AgentCapabilityRegistry,
    private readonly bus: EventBus,
    private readonly notificationStore?: NotificationStore,
    private readonly budgetPolicy: PipelineBudgetPolicy = {
      max_cost_per_task_usd: Number(process.env.HIGGSFIELD_MAX_COST_PER_TASK_USD ?? "10"),
      max_cost_per_day_usd: Number(process.env.HIGGSFIELD_MAX_COST_PER_DAY_USD ?? "50"),
    },
    private readonly dispatchAdapters?: Map<string, PostDispatchAdapter>,
    private reflectionHook?: ReflectionHook,
    private strategyProvider?: StrategyProvider,
    private criticModel?: CriticModel,
    private episodicStore?: EpisodicStore,
  ) {
    if (this.criticModel) {
      this.reflectionLoop = new ReflectionLoop(this.criticModel);
    }
  }

  /** Inject a critic model for AI evaluation of agent outputs. */
  setCriticModel(critic: CriticModel): void {
    this.criticModel = critic;
    this.reflectionLoop = new ReflectionLoop(critic);
  }

  /** Inject an episodic memory store for full run recording. */
  setEpisodicStore(store: EpisodicStore): void {
    this.episodicStore = store;
  }

  // ── Pipeline definition helpers (kept from old PipelineEngine) ──

  /**
   * Full outreach pipeline: discover → enrich → analyse → qualify →
   * generate demo site → QA → assign to salesperson WITH ready demo.
   *
   * Every lead gets a demo site before a salesperson sees it.
   * The demo IS the pitch.
   */
  createLeadGenerationDefinition(): ReturnType<SQLitePipelineStore["upsertDefinition"]> {
    return this.store.upsertDefinition({
      id: "lead-generation-v1",
      name: "Lead Outreach Pipeline",
      enabled: true,
      schedule_rrule: "FREQ=DAILY;INTERVAL=1",
      max_retries: 1,
      nodes: [
        // Phase 1: Discovery & enrichment
        { id: "scout", agent_id: "lead-scout-agent", depends_on: [], config: {
          verticals: ["restaurant", "cafe", "barber", "salon", "bakery", "pub"],
          location: "Manchester",
          max_results_per_vertical: 5,
        } },
        { id: "profile", agent_id: "lead-profiler-agent", depends_on: ["scout"] },
        { id: "brand-analyse", agent_id: "brand-analyser-agent", depends_on: ["profile"] },
        { id: "brand-intelligence", agent_id: "brand-intelligence-agent", depends_on: ["brand-analyse"] },
        // Phase 2: Qualification
        { id: "qualify", agent_id: "lead-qualifier-agent", depends_on: ["brand-intelligence"] },
        // Phase 3: Demo site generation (shown to business owner as the pitch)
        { id: "brief", agent_id: "brief-generator-agent", depends_on: ["qualify"] },
        { id: "compose", agent_id: "site-composer-agent", depends_on: ["brief"] },
        { id: "qa", agent_id: "site-qa-agent", depends_on: ["compose"] },
        // Phase 4: Assignment — salesperson receives lead WITH ready demo
        // Depends on all upstream nodes to collect full enrichment data
        { id: "assign", agent_id: "lead-assigner-agent", depends_on: [
          "profile", "brand-analyse", "brand-intelligence", "qualify", "brief", "compose", "qa",
        ] },
      ],
      config: {},
    });
  }

  // ── Lifecycle ──

  recoverStaleRuns(): void {
    const runs = this.store.listRuns(200);
    let recovered = 0;
    for (const run of runs) {
      if (run.status === "running") {
        this.store.setRunStatus(run.id, "failed", "interrupted by restart");
        recovered++;
      }
    }
    if (recovered > 0) {
      this.notify({
        session_id: "system",
        user_id: "system",
        reason: "pipeline_recovery",
        severity: "warning",
        message: `Recovered ${recovered} stale pipeline run(s) after restart`,
      });
    }
  }

  async startRun(input: StartRunInput): Promise<PipelineRun> {
    const definition = this.store.getDefinition(input.definitionId);
    if (!definition) {
      throw new Error(`pipeline definition not found: ${input.definitionId}`);
    }

    const run = this.store.createRun({
      definition,
      trigger: input.trigger === "replan" ? "retry" : input.trigger,
      approval_token: input.approval_token,
    });

    const correlationId = input.correlationId ?? run.id;

    // Create working memory for this run
    const wm = new InMemoryWorkingMemory(run.id);
    this.workingMemories.set(run.id, wm);

    // Inject strategy context if available
    if (this.strategyProvider && definition.config) {
      const vertical = (definition.config as Record<string, unknown>).vertical as string | undefined;
      const region = (definition.config as Record<string, unknown>).region as string | undefined;
      if (vertical) {
        const strategies = this.strategyProvider(vertical, region);
        wm.set("_strategyContext", strategies);
      }
    }

    // Create episode for full run recording
    if (this.episodicStore) {
      const defConfig = definition.config as Record<string, unknown> | undefined;
      this.episodicStore.createEpisode({
        id: `ep-${run.id}`,
        pipeline_run_id: run.id,
        pipeline_definition_id: input.definitionId,
        vertical: defConfig?.vertical as string | undefined,
        region: defConfig?.region as string | undefined,
      });
    }
    this.criticScores.set(run.id, []);

    await this.bus.publish("pipeline.run.started", {
      run_id: run.id,
      definition_id: input.definitionId,
      trigger: input.trigger,
      priority: input.priority,
      parent_run_id: input.parentRunId,
    }, correlationId);

    await this.executeRun(run.id, correlationId);
    this.store.bumpNextRunAt(definition.id, new Date().toISOString());

    const updated = this.store.getRun(run.id);
    if (!updated) throw new Error(`pipeline run not found: ${run.id}`);
    return updated;
  }

  async resumeRun(runId: string, approvalToken?: string): Promise<PipelineRun> {
    if (approvalToken) {
      // Update the run's approval token so blocked nodes can proceed
      const run = this.store.getRun(runId);
      if (!run) throw new Error(`run not found: ${runId}`);
      // The store createRun includes the token; for resume we re-execute
    }
    await this.executeRun(runId, runId);
    const updated = this.store.getRun(runId);
    if (!updated) throw new Error(`run not found after resume: ${runId}`);
    return updated;
  }

  async cancelRun(runId: string, reason: string): Promise<void> {
    this.store.setRunStatus(runId, "failed", `cancelled: ${reason}`);
    this.workingMemories.delete(runId);
    await this.bus.publish("pipeline.run.failed", {
      run_id: runId,
      reason: `cancelled: ${reason}`,
    }, runId);
  }

  getWorkingMemory(runId: string): WorkingMemory | undefined {
    return this.workingMemories.get(runId);
  }

  getRelevantStrategies(vertical: string, region?: string): StrategyEntry[] {
    if (!this.strategyProvider) return [];
    return this.strategyProvider(vertical, region);
  }

  setReflectionHook(hook: ReflectionHook): void {
    this.reflectionHook = hook;
  }

  setStrategyProvider(provider: StrategyProvider): void {
    this.strategyProvider = provider;
  }

  // ── Node-level operations (kept from old PipelineEngine) ──

  async retryNode(runId: string, nodeId: string): Promise<void> {
    const node = this.store.getNodeRun(runId, nodeId);
    if (!node) throw new Error(`node not found: ${runId}/${nodeId}`);
    this.store.setNodeStatus({ runId, nodeId, status: "pending", error: undefined });
    this.store.recomputeBlockedNodes(runId);
    await this.executeRun(runId, runId);
  }

  async overrideNode(runId: string, nodeId: string, reason: string): Promise<void> {
    this.store.setNodeStatus({
      runId, nodeId, status: "completed",
      error: `manually overridden: ${reason}`,
      ended: true, started: true,
    });
    this.store.recomputeBlockedNodes(runId);
    await this.executeRun(runId, runId);
  }

  // ── Post dispatch (kept from old PipelineEngine) ──

  async dispatchPostQueueItem(input: {
    id: string;
    approvedBy?: string;
  }): Promise<{
    status: string;
    detail: string;
    reason_code: DispatchReasonCode | "POLICY_APPROVAL_REQUIRED" | "MISSING_ADAPTER" | "ALREADY_DEAD_LETTER";
    retry_after_ms?: number;
    attempts: number;
  }> {
    const maxAttempts = 3;
    const retryBackoffMs = [3000, 15000, 60000];

    const queue = this.store.listPostQueue(500).find((item) => item.id === input.id);
    if (!queue) throw new Error("post queue item not found");

    if (queue.status === "dead_letter") {
      return { status: "dead_letter", detail: "item already in dead-letter", reason_code: "ALREADY_DEAD_LETTER", attempts: queue.attempts };
    }

    if (queue.status === "pending_approval") {
      if (!input.approvedBy) {
        const attempts = queue.attempts + 1;
        this.store.patchPostQueue(queue.id, {
          status: "dead_letter", attempts,
          last_error: JSON.stringify({ reason_code: "POLICY_APPROVAL_REQUIRED", detail: "approved_by is required before delivery", retryable: false }),
        });
        return { status: "dead_letter", detail: "approved_by is required before delivery", reason_code: "POLICY_APPROVAL_REQUIRED", attempts };
      }
      this.store.patchPostQueue(queue.id, { status: "approved", approved_by: input.approvedBy });
    }

    const active = this.store.listPostQueue(500).find((item) => item.id === input.id);
    if (!active) throw new Error("post queue item missing after approval");

    const adapter = this.dispatchAdapters?.get(active.platform);
    if (!adapter) {
      const attempts = active.attempts + 1;
      const status = attempts >= maxAttempts ? "dead_letter" : "failed";
      this.store.patchPostQueue(active.id, {
        status, last_error: JSON.stringify({ reason_code: "MISSING_ADAPTER", detail: `no dispatch adapter for ${active.platform}`, retryable: attempts < maxAttempts }),
        attempts,
      });
      return { status, detail: "missing adapter", reason_code: "MISSING_ADAPTER", retry_after_ms: attempts < maxAttempts ? retryBackoffMs[Math.min(attempts - 1, retryBackoffMs.length - 1)] : undefined, attempts };
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
      const retryAfterMs = result.retryable ? retryBackoffMs[Math.min(attempts - 1, retryBackoffMs.length - 1)] : undefined;
      const status = !result.retryable || attempts >= maxAttempts ? "dead_letter" : "failed";
      this.store.patchPostQueue(active.id, {
        status, attempts,
        last_error: JSON.stringify({ reason_code: result.reason_code, detail: result.detail, retryable: result.retryable, retry_after_ms: retryAfterMs, http_status: result.http_status }),
      });
      return { status, detail: result.detail, reason_code: result.reason_code, retry_after_ms: retryAfterMs, attempts };
    }

    this.store.patchPostQueue(active.id, { status: "dispatched", attempts: nextAttempt, dispatched_at: new Date().toISOString(), last_error: undefined });
    return { status: "dispatched", detail: result.detail, reason_code: result.reason_code, attempts: nextAttempt };
  }

  // ── Execution core ──

  private async executeRun(runId: string, correlationId: string): Promise<void> {
    this.store.setRunStatus(runId, "running");
    let safety = 0;

    while (safety < 200) {
      safety++;
      const runnable = this.store.listRunnableNodes(runId);
      if (runnable.length === 0) break;

      for (const node of runnable) {
        const done = await this.executeNode(runId, node, correlationId);
        if (!done) {
          this.store.setRunStatus(runId, "blocked", `blocked at ${node.node_id}`);
          return;
        }
      }
      this.store.recomputeBlockedNodes(runId);
    }

    this.finalizeRun(runId, correlationId);
  }

  private async executeNode(
    runId: string,
    node: PipelineNodeRun,
    correlationId: string,
  ): Promise<boolean> {
    const run = this.store.getRun(runId);
    if (!run) throw new Error(`pipeline run not found: ${runId}`);

    // Approval gate (from old Orchestrator)
    if (node.paid_action && !run.approval_token) {
      this.store.setNodeStatus({
        runId, nodeId: node.node_id,
        status: "awaiting_approval",
        error: "approval token required for paid node",
      });
      this.notify({
        session_id: runId, user_id: "mission-control",
        reason: "approval_required", severity: "warning",
        message: `Run ${runId} blocked at ${node.node_id}: approval token required.`,
      });
      this.store.blockDependents(runId, node.node_id, "awaiting approval");
      await this.bus.publish("approval.requested", {
        run_id: runId, node_id: node.node_id,
      }, correlationId);
      return false;
    }

    // Check agent capability for approval requirements
    const capability = this.registry.getCapability(node.agent_id);
    if (capability?.requires_approval_for && capability.requires_approval_for.length > 0) {
      if (!run.approval_token) {
        this.store.setNodeStatus({
          runId, nodeId: node.node_id,
          status: "awaiting_approval",
          error: `agent ${node.agent_id} requires approval for: ${capability.requires_approval_for.join(", ")}`,
        });
        this.store.blockDependents(runId, node.node_id, "awaiting approval");
        await this.bus.publish("approval.requested", {
          run_id: runId, node_id: node.node_id, agent_id: node.agent_id,
          requires_approval_for: capability.requires_approval_for,
        }, correlationId);
        return false;
      }
    }

    const maxRetries = this.store.getDefinition(run.pipeline_definition_id)?.max_retries ?? 1;
    let attempt = node.attempts;

    while (attempt <= maxRetries) {
      attempt++;
      this.store.setNodeStatus({
        runId, nodeId: node.node_id, status: "running",
        attempts: attempt, started: true,
      });

      await this.bus.publish("pipeline.node.started", {
        run_id: runId, node_id: node.node_id, agent_id: node.agent_id, attempt,
      }, correlationId);

      const upstreamArtifacts = this.collectUpstreamArtifacts(runId, node.depends_on);
      const wm = this.workingMemories.get(runId);

      // Inject working memory snapshot + strategy context into upstream artifacts
      const enrichedArtifacts: Record<string, unknown> = {
        ...upstreamArtifacts,
      };
      if (wm) {
        enrichedArtifacts._workingMemory = wm.snapshot();
        const strategies = wm.get<StrategyEntry[]>("_strategyContext");
        if (strategies) {
          enrichedArtifacts._strategyContext = strategies;
        }
      }

      const task = this.store.appendAgentTask({
        run_id: runId,
        node_id: node.node_id,
        agent_id: node.agent_id,
        status: "running",
        started_at: new Date().toISOString(),
        input_json: { config: node.config ?? {}, upstream: enrichedArtifacts },
      });

      try {
        let settled: { summary: string; artifacts: Record<string, unknown>; cost_usd?: number; post_payloads?: Array<{ platform: "tiktok" | "reels" | "shorts"; payload: Record<string, unknown> }> };
        let reflectionResult: ReflectionOutput | undefined;

        // Route through ReflectionLoop for agents with reflection_enabled
        if (this.reflectionLoop && capability?.reflection_enabled) {
          const handler = this.registry.getHandler(node.agent_id)!;
          reflectionResult = await this.reflectionLoop.executeWithReflection({
            agentInput: {
              run_id: runId,
              node_id: node.node_id,
              agent_id: node.agent_id,
              config: node.config,
              upstreamArtifacts: enrichedArtifacts,
            },
            handler,
            businessContext: this.extractBusinessContext(wm),
            workingMemorySnapshot: wm?.snapshot(),
          });

          settled = reflectionResult.finalOutput;

          // Record critic scores for episodic memory
          const runScores = this.criticScores.get(runId) ?? [];
          for (const iter of reflectionResult.iterations) {
            runScores.push({
              agent_id: node.agent_id,
              node_id: node.node_id,
              iteration: iter.iteration,
              score: iter.evaluation.score,
              prediction: iter.evaluation.prediction,
              model_version: iter.evaluation.model_version,
              strengths: iter.evaluation.critique.strengths,
              weaknesses: iter.evaluation.critique.weaknesses,
              suggestions: iter.evaluation.critique.specific_suggestions,
            });

            await this.bus.publish("reflection.iteration", {
              run_id: runId, node_id: node.node_id,
              agent_id: node.agent_id,
              score: iter.evaluation.score,
              prediction: iter.evaluation.prediction,
              iteration: iter.iteration,
              accepted: iter.accepted,
            }, correlationId);
          }
          this.criticScores.set(runId, runScores);

          // Store evaluation results in working memory
          wm?.setForAgent(node.agent_id, "critic_score", reflectionResult.finalScore);
          wm?.setForAgent(node.agent_id, "critic_accepted", reflectionResult.accepted);
          wm?.setForAgent(node.agent_id, "reflection_iterations", reflectionResult.iterations.length);
          if (reflectionResult.needsHumanReview) {
            wm?.addNote(`${node.agent_id} output force-accepted after ${reflectionResult.iterations.length} iterations (score: ${reflectionResult.finalScore.toFixed(2)}) — needs human review`, "reflection-loop");
          }

          log.info("reflection complete", {
            run_id: runId, node_id: node.node_id, agent_id: node.agent_id,
            final_score: reflectionResult.finalScore,
            iterations: reflectionResult.iterations.length,
            accepted: reflectionResult.accepted,
            force_accepted: reflectionResult.forceAccepted,
            total_cost_usd: reflectionResult.totalCostUsd,
          });
        } else {
          // Direct execution (no reflection)
          settled = await this.registry.execute({
            run_id: runId,
            node_id: node.node_id,
            agent_id: node.agent_id,
            config: node.config,
            upstreamArtifacts: enrichedArtifacts,
          });

          // Legacy reflection hook (simple callback)
          if (this.reflectionHook && capability?.reflection_enabled) {
            const evaluation = await this.reflectionHook(runId, node.node_id, settled.artifacts);
            if (evaluation) {
              wm?.setForAgent(node.agent_id, "critic_score", evaluation.score);
              wm?.setForAgent(node.agent_id, "critic_prediction", evaluation.prediction);
            }
          }
        }

        // Calculate total cost including reflection
        const totalNodeCost = reflectionResult
          ? reflectionResult.totalCostUsd
          : (settled.cost_usd ?? 0);

        this.store.appendAgentTask({
          run_id: runId, node_id: node.node_id, agent_id: node.agent_id,
          status: "completed",
          started_at: task.started_at,
          completed_at: new Date().toISOString(),
          input_json: task.input_json,
          output_json: settled.artifacts,
        });

        this.store.appendArtifact({
          run_id: runId, node_id: node.node_id,
          kind: "agent.output", value_json: settled.artifacts,
        });

        // Budget enforcement
        if (totalNodeCost > 0) {
          if (!this.withinBudget(runId, totalNodeCost)) {
            this.store.setNodeStatus({
              runId, nodeId: node.node_id, status: "failed",
              error: "budget cap exceeded", ended: true,
            });
            this.store.blockDependents(runId, node.node_id, "budget cap exceeded");
            this.notify({
              session_id: runId, user_id: "mission-control",
              reason: "budget_exceeded", severity: "critical",
              message: `Run ${runId} exceeded budget at ${node.node_id}.`,
            });
            return false;
          }
          this.store.appendSpendLedger({
            timestamp: new Date().toISOString(),
            scope: "task", reference_id: runId,
            provider: "higgsfield", amount_usd: totalNodeCost,
          });
        }

        // Media job + post queue (kept from old PipelineEngine)
        if (node.agent_id === "media-generator-agent") {
          this.store.createMediaJob({
            run_id: runId, node_id: node.node_id,
            provider: "higgsfield", status: "completed",
            input_json: task.input_json, output_json: settled.artifacts,
            cost_usd: settled.cost_usd, approved_by_token: run.approval_token,
          });
        }
        if (node.agent_id === "publisher-agent" && settled.post_payloads) {
          for (const payload of settled.post_payloads) {
            this.store.enqueuePost({
              run_id: runId, platform: payload.platform,
              status: "pending_approval", payload_json: payload.payload,
            });
          }
        }

        this.store.setNodeStatus({
          runId, nodeId: node.node_id, status: "completed",
          attempts: attempt, ended: true,
        });

        await this.bus.publish("pipeline.node.completed", {
          run_id: runId, node_id: node.node_id, agent_id: node.agent_id,
          cost_usd: settled.cost_usd,
        }, correlationId);

        return true;
      } catch (error) {
        if (attempt <= maxRetries) continue;

        this.store.setNodeStatus({
          runId, nodeId: node.node_id, status: "failed",
          attempts: attempt, error: String(error), ended: true,
        });
        this.store.blockDependents(runId, node.node_id, String(error));

        this.notify({
          session_id: runId, user_id: "mission-control",
          reason: "pipeline_blocked", severity: "critical",
          message: `Node ${node.node_id} failed: ${String(error)}`,
        });

        await this.bus.publish("pipeline.node.failed", {
          run_id: runId, node_id: node.node_id, error: String(error),
        }, correlationId);

        return false;
      }
    }

    return false;
  }

  private finalizeRun(runId: string, correlationId: string): void {
    const nodes = this.store.listNodeRuns(runId);
    const hasFailed = nodes.some((n) => n.status === "failed");
    const hasBlocked = nodes.some((n) => n.status === "blocked" || n.status === "awaiting_approval");
    const allCompleted = nodes.length > 0 && nodes.every((n) => n.status === "completed");

    // Flush working memory + episodic memory
    const wm = this.workingMemories.get(runId);
    const wmSnapshot = wm?.snapshot() ?? {};
    if (wm) {
      this.bus.publish("working_memory.flushed", {
        run_id: runId, snapshot: wmSnapshot,
      }, correlationId).catch(() => undefined);
      this.workingMemories.delete(runId);
    }

    // Record episode completion
    if (this.episodicStore) {
      const criticScoresForRun = this.criticScores.get(runId) ?? [];
      const totalReflections = criticScoresForRun.length;
      try {
        this.episodicStore.updateEpisode(`ep-${runId}`, {
          status: allCompleted ? "completed" : hasFailed ? "failed" : "blocked",
          ended_at: new Date().toISOString(),
          reflection_iterations: totalReflections,
          critic_scores: criticScoresForRun,
          working_memory_snapshot: wmSnapshot,
        });
      } catch {
        // Episode may not exist if engine was constructed without episodic store initially
      }
      this.criticScores.delete(runId);
    }

    if (allCompleted) {
      this.store.setRunStatus(runId, "completed");
      this.bus.publish("pipeline.run.completed", { run_id: runId }, correlationId).catch(() => undefined);
      return;
    }
    if (hasFailed) {
      this.store.setRunStatus(runId, "failed");
      this.bus.publish("pipeline.run.failed", { run_id: runId, reason: "node failure" }, correlationId).catch(() => undefined);
      return;
    }
    if (hasBlocked) {
      this.store.setRunStatus(runId, "blocked");
      return;
    }
    this.store.setRunStatus(runId, "running");
  }

  private collectUpstreamArtifacts(runId: string, deps: string[]): Record<string, unknown> {
    if (deps.length === 0) return {};
    const artifacts = this.store.listArtifacts(runId).filter((a) => deps.includes(a.node_id));
    const merged: Record<string, unknown> = {};
    for (const a of artifacts) merged[a.node_id] = a.value_json;
    return merged;
  }

  /** Extract business context from working memory for the Critic. */
  private extractBusinessContext(wm: InMemoryWorkingMemory | undefined): CriticInput["businessContext"] | undefined {
    if (!wm) return undefined;
    const ctx: NonNullable<CriticInput["businessContext"]> = {};
    const vertical = wm.get<string>("vertical");
    if (vertical) ctx.vertical = vertical;
    const businessName = wm.get<string>("business_name");
    if (businessName) ctx.business_name = businessName;
    const brandColours = wm.get<string[]>("brand_colours");
    if (brandColours) ctx.brand_colours = brandColours;
    const reviewCount = wm.get<number>("review_count");
    if (reviewCount !== undefined) ctx.review_count = reviewCount;
    const reviewRating = wm.get<number>("review_rating");
    if (reviewRating !== undefined) ctx.review_rating = reviewRating;
    const instagramFollowers = wm.get<number>("instagram_followers");
    if (instagramFollowers !== undefined) ctx.instagram_followers = instagramFollowers;
    const hasWebsite = wm.get<boolean>("has_website");
    if (hasWebsite !== undefined) ctx.has_website = hasWebsite;
    const region = wm.get<string>("region");
    if (region) ctx.region = region;
    return Object.keys(ctx).length > 0 ? ctx : undefined;
  }

  private withinBudget(runId: string, nextCostUsd: number): boolean {
    const taskSpend = this.store.taskSpendUsd(runId);
    if (taskSpend + nextCostUsd > this.budgetPolicy.max_cost_per_task_usd) return false;
    const daySpend = this.store.dailySpendUsd(new Date().toISOString());
    return daySpend + nextCostUsd <= this.budgetPolicy.max_cost_per_day_usd;
  }

  private notify(input: {
    session_id: string;
    user_id: string;
    reason: NotificationReason;
    severity: "info" | "warning" | "critical";
    message: string;
  }): void {
    this.notificationStore?.append({
      event_id: randomUUID(),
      created_at: new Date().toISOString(),
      channel: "notify_user",
      reason: input.reason,
      message: input.message,
      severity: input.severity,
      session_id: input.session_id,
      user_id: input.user_id,
    }).catch(() => undefined);
  }
}
