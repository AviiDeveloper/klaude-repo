/**
 * Production Agent Handlers — registers execution handlers for all 11 production agents.
 *
 * Each handler:
 * 1. Queries memory for relevant past outcomes before executing
 * 2. Executes the agent's core logic
 * 3. Returns structured artifacts (auto-indexed into memory by the wiring in index.ts)
 */

import type { MemorySystem } from "../memory/index.js";
import type { MultiAgentRuntime } from "./agentRuntime.js";
import type { AgentExecutionInput, AgentExecutionOutput } from "./agentRuntime.js";

interface MemoryContext {
  past_outcomes: Array<{
    source_type: string;
    summary: string;
    outcome?: string;
    score: number;
  }>;
}

async function queryAgentMemory(
  memory: MemorySystem,
  agentId: string,
  taskDescription: string,
): Promise<MemoryContext> {
  try {
    const results = memory.query({
      query_text: taskDescription,
      workspace_id: "default",
      agent_id: agentId,
      top_k: 3,
      enable_interleave: false,
    });

    return {
      past_outcomes: results.map((r) => ({
        source_type: r.document.source_type,
        summary: (r.document.compressed_content || "").slice(0, 200),
        outcome: r.document.tags.outcome,
        score: r.score,
      })),
    };
  } catch {
    return { past_outcomes: [] };
  }
}

export function registerProductionHandlers(
  runtime: MultiAgentRuntime,
  memory: MemorySystem,
): void {
  // AGENT-01: Scout (Scraper)
  runtime.register("production-scraper-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-scraper-agent", "business scraping lead discovery");
    const config = input.config || {};
    const targetBuffer = (config.target_buffer as number) || 500;

    return {
      summary: `Scout: Scraping businesses for lead buffer (target: ${targetBuffer}). ${ctx.past_outcomes.length} past outcomes consulted.`,
      artifacts: {
        agent_id: "production-scraper-agent",
        target_buffer: targetBuffer,
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to actual Google Places/Companies House APIs when credentials are configured",
      },
    };
  });

  // AGENT-02: Builder (Generation)
  runtime.register("production-generator-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-generator-agent", "demo website generation");
    const upstream = input.upstreamArtifacts || {};

    return {
      summary: `Builder: Generating demo sites from business profiles. ${ctx.past_outcomes.length} past outcomes consulted.`,
      artifacts: {
        agent_id: "production-generator-agent",
        upstream_leads: upstream,
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to Claude API demo generation when ANTHROPIC_API_KEY configured",
      },
    };
  });

  // AGENT-03: Inspector (QC)
  runtime.register("production-qc-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-qc-agent", "quality control demo scoring");
    const config = input.config || {};
    const threshold = (config.quality_threshold as number) || 0.7;

    return {
      summary: `Inspector: QC scoring demos with threshold ${threshold}. ${ctx.past_outcomes.length} past outcomes consulted.`,
      artifacts: {
        agent_id: "production-qc-agent",
        quality_threshold: threshold,
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to headless screenshot + Claude scoring",
      },
    };
  });

  // AGENT-04: Sentinel (Monitoring)
  runtime.register("production-monitoring-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-monitoring-agent", "pitch outcome monitoring training trigger");
    const config = input.config || {};
    const threshold = (config.outcome_threshold as number) || 100;

    return {
      summary: `Sentinel: Checking pitch outcomes (threshold: ${threshold} new outcomes). ${ctx.past_outcomes.length} past outcomes consulted.`,
      artifacts: {
        agent_id: "production-monitoring-agent",
        outcome_threshold: threshold,
        threshold_met: false,
        new_outcomes_count: 0,
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to Supabase pitch_outcomes query",
      },
    };
  });

  // AGENT-05: Trainer (Training)
  runtime.register("production-training-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-training-agent", "model training LoRA fine-tuning");

    return {
      summary: `Trainer: LoRA fine-tuning handler ready. ${ctx.past_outcomes.length} past training runs consulted.`,
      artifacts: {
        agent_id: "production-training-agent",
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to Vast.ai provisioning + SSH training pipeline",
      },
      cost_usd: 0,
    };
  });

  // AGENT-06: Examiner (Evaluation)
  runtime.register("production-evaluation-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-evaluation-agent", "model evaluation AUC-ROC lift");
    const config = input.config || {};

    return {
      summary: `Examiner: Model evaluation handler ready. Thresholds: AUC>${config.min_auc || 0.62}, lift>${config.min_lift || 1.3}. ${ctx.past_outcomes.length} past evals consulted.`,
      artifacts: {
        agent_id: "production-evaluation-agent",
        thresholds: { min_auc: config.min_auc, min_lift: config.min_lift, max_pvalue: config.max_pvalue },
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to model evaluation pipeline",
      },
    };
  });

  // AGENT-07: Arbiter (Decision)
  runtime.register("production-decision-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-decision-agent", "deployment decision threshold");

    return {
      summary: `Arbiter: Deployment decision handler ready. ${ctx.past_outcomes.length} past decisions consulted.`,
      artifacts: {
        agent_id: "production-decision-agent",
        memory_context: ctx,
        requires_manual_approval: true,
        status: "ready",
        note: "Handler stub — wire to A/B test staging + Telegram approval flow",
      },
    };
  });

  // AGENT-08: Treasurer (Cost Controller)
  runtime.register("production-cost-controller-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-cost-controller-agent", "cost monitoring budget enforcement");
    const config = input.config || {};
    const dailyBudget = (config.daily_budget_gbp as number) || 10;

    return {
      summary: `Treasurer: Cost monitoring active (budget: £${dailyBudget}/day). ${ctx.past_outcomes.length} past alerts consulted.`,
      artifacts: {
        agent_id: "production-cost-controller-agent",
        daily_budget_gbp: dailyBudget,
        daily_spend_gbp: 0,
        alert_sent: false,
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to Vast.ai/DO/Stripe API polling",
      },
    };
  });

  // AGENT-09: Analyst (Analytics)
  runtime.register("production-analytics-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-analytics-agent", "close rate analytics targeting scores");

    return {
      summary: `Analyst: Analytics handler ready. ${ctx.past_outcomes.length} past reports consulted.`,
      artifacts: {
        agent_id: "production-analytics-agent",
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to Supabase analytics queries + Telegram weekly summary",
      },
    };
  });

  // AGENT-10: Auditor (Data Validation)
  runtime.register("production-data-validation-agent", async (input: AgentExecutionInput): Promise<AgentExecutionOutput> => {
    const ctx = await queryAgentMemory(memory, "production-data-validation-agent", "data quality audit poisoning detection");
    const config = input.config || {};

    return {
      summary: `Auditor: Data validation handler ready. ${ctx.past_outcomes.length} past audits consulted.`,
      artifacts: {
        agent_id: "production-data-validation-agent",
        poisoning_threshold: config.poisoning_zscore_threshold || 3,
        memory_context: ctx,
        status: "ready",
        note: "Handler stub — wire to Supabase table auditing + anomaly detection",
      },
    };
  });
}
