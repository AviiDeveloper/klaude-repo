import { DecisionLogger } from "../decisions/decisionLogger.js";
import { PipelineAgentId } from "./types.js";

export interface AgentExecutionInput {
  run_id: string;
  node_id: string;
  agent_id: PipelineAgentId;
  config?: Record<string, unknown>;
  upstreamArtifacts: Record<string, unknown>;
}

export interface AgentExecutionOutput {
  summary: string;
  artifacts: Record<string, unknown>;
  cost_usd?: number;
  post_payloads?: Array<{
    platform: "tiktok" | "reels" | "shorts";
    payload: Record<string, unknown>;
  }>;
}

export type AgentHandler = (
  input: AgentExecutionInput,
) => Promise<AgentExecutionOutput>;

export class MultiAgentRuntime {
  private handlers = new Map<string, AgentHandler>();
  private decisionLogger?: DecisionLogger;

  constructor() {
    this.registerDefaults();
  }

  setDecisionLogger(logger: DecisionLogger): void {
    this.decisionLogger = logger;
  }

  register(agentId: string, handler: AgentHandler): void {
    this.handlers.set(agentId, handler);
  }

  unregister(agentId: string): void {
    this.handlers.delete(agentId);
  }

  has(agentId: string): boolean {
    return this.handlers.has(agentId);
  }

  listRegistered(): string[] {
    return Array.from(this.handlers.keys());
  }

  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const handler = this.handlers.get(input.agent_id);
    if (!handler) {
      throw new Error(
        `No handler registered for agent "${input.agent_id}". ` +
        `Registered: ${this.listRegistered().join(", ") || "(none)"}`,
      );
    }

    let decisionId: string | undefined;
    if (this.decisionLogger) {
      decisionId = await this.decisionLogger.log({
        agent_id: input.agent_id,
        decision_type: "pipeline_execution",
        description: `Pipeline agent ${input.agent_id} executing node ${input.node_id}`,
        rationale: `Run ${input.run_id}, node ${input.node_id}`,
        input_data: {
          run_id: input.run_id,
          node_id: input.node_id,
          config: input.config ?? {},
          upstream_keys: Object.keys(input.upstreamArtifacts),
        },
        expected_outcome: "success",
      });
    }

    try {
      const output = await handler(input);

      if (this.decisionLogger && decisionId) {
        await this.decisionLogger.recordOutcome(decisionId, {
          actual_outcome: "success",
          actual_metric: {
            cost_usd: output.cost_usd ?? 0,
            has_post_payloads: (output.post_payloads?.length ?? 0) > 0,
          },
        });
      }

      return output;
    } catch (error) {
      if (this.decisionLogger && decisionId) {
        await this.decisionLogger.recordOutcome(decisionId, {
          actual_outcome: "failed",
          actual_metric: { error: String(error) },
        });
      }
      throw error;
    }
  }

  private registerDefaults(): void {
    this.register("trend-scout-agent", async () => ({
      summary: "Collected trend topics from configured feeds.",
      artifacts: {
        topics: [
          "AI product launches",
          "creator monetization",
          "workflow automation",
        ],
      },
    }));

    this.register("research-verifier-agent", async (input) => {
      if (input.config?.force_fail === true) {
        throw new Error("research verification failed by config flag");
      }
      return {
        summary: "Validated topic freshness and source quality.",
        artifacts: { verified: true },
      };
    });

    this.register("idea-ranker-agent", async () => {
      const ideas = Array.from({ length: 10 }).map((_, index) => ({
        rank: index + 1,
        idea: `Idea ${index + 1}`,
        final_score: Number((0.9 - index * 0.05).toFixed(2)),
      }));
      return {
        summary: "Ranked ideas and selected top winners.",
        artifacts: { ranked_ideas: ideas, winners: ideas.slice(0, 2) },
      };
    });

    this.register("script-writer-agent", async () => ({
      summary: "Generated short-video scripts for platforms.",
      artifacts: {
        scripts: {
          tiktok: "Hook + proof + CTA",
          reels: "Story arc + reveal + CTA",
          shorts: "Fast hook + key points + subscribe CTA",
        },
      },
    }));

    this.register("media-generator-agent", async () => ({
      summary: "Generated media assets through provider.",
      artifacts: {
        media_assets: [
          { type: "image", url: "https://example.invalid/media/image-1.png" },
          { type: "video", url: "https://example.invalid/media/video-1.mp4" },
        ],
      },
      cost_usd: 1.25,
    }));

    this.register("compliance-reviewer-agent", async () => ({
      summary: "Compliance checks passed for generated content.",
      artifacts: { compliance_passed: true, risk_level: "low" },
    }));

    this.register("publisher-agent", async () => ({
      summary: "Prepared platform payloads for queue dispatch.",
      artifacts: { queued: true },
      post_payloads: [
        { platform: "tiktok" as const, payload: { caption: "TikTok post", tags: ["ai"] } },
        { platform: "reels" as const, payload: { caption: "Reels post", tags: ["automation"] } },
        { platform: "shorts" as const, payload: { title: "Shorts post", tags: ["workflow"] } },
      ],
    }));

    this.register("performance-analyst-agent", async () => ({
      summary: "Recorded performance metrics for feedback loop.",
      artifacts: { metrics_collected: true },
    }));
  }
}
