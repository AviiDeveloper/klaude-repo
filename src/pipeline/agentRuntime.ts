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

export class MultiAgentRuntime {
  async execute(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    if (input.agent_id === "trend-scout-agent") {
      return {
        summary: "Collected trend topics from configured feeds.",
        artifacts: {
          topics: [
            "AI product launches",
            "creator monetization",
            "workflow automation",
          ],
        },
      };
    }

    if (input.agent_id === "research-verifier-agent") {
      if (input.config?.force_fail === true) {
        throw new Error("research verification failed by config flag");
      }
      return {
        summary: "Validated topic freshness and source quality.",
        artifacts: { verified: true },
      };
    }

    if (input.agent_id === "idea-ranker-agent") {
      const ideas = Array.from({ length: 10 }).map((_, index) => ({
        rank: index + 1,
        idea: `Idea ${index + 1}`,
        final_score: Number((0.9 - index * 0.05).toFixed(2)),
      }));
      return {
        summary: "Ranked ideas and selected top winners.",
        artifacts: { ranked_ideas: ideas, winners: ideas.slice(0, 2) },
      };
    }

    if (input.agent_id === "script-writer-agent") {
      return {
        summary: "Generated short-video scripts for platforms.",
        artifacts: {
          scripts: {
            tiktok: "Hook + proof + CTA",
            reels: "Story arc + reveal + CTA",
            shorts: "Fast hook + key points + subscribe CTA",
          },
        },
      };
    }

    if (input.agent_id === "media-generator-agent") {
      return {
        summary: "Generated media assets through provider.",
        artifacts: {
          media_assets: [
            { type: "image", url: "https://example.invalid/media/image-1.png" },
            { type: "video", url: "https://example.invalid/media/video-1.mp4" },
          ],
        },
        cost_usd: 1.25,
      };
    }

    if (input.agent_id === "compliance-reviewer-agent") {
      return {
        summary: "Compliance checks passed for generated content.",
        artifacts: { compliance_passed: true, risk_level: "low" },
      };
    }

    if (input.agent_id === "publisher-agent") {
      return {
        summary: "Prepared platform payloads for queue dispatch.",
        artifacts: { queued: true },
        post_payloads: [
          { platform: "tiktok", payload: { caption: "TikTok post", tags: ["ai"] } },
          { platform: "reels", payload: { caption: "Reels post", tags: ["automation"] } },
          { platform: "shorts", payload: { title: "Shorts post", tags: ["workflow"] } },
        ],
      };
    }

    return {
      summary: "Recorded performance metrics for feedback loop.",
      artifacts: { metrics_collected: true },
    };
  }
}
