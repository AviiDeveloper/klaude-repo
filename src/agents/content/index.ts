import { MultiAgentRuntime } from "../../pipeline/agentRuntime.js";
import { trendScoutAgent } from "./trendScoutAgent.js";
import { researchVerifierAgent } from "./researchVerifierAgent.js";
import { ideaRankerAgent } from "./ideaRankerAgent.js";
import { scriptWriterAgent } from "./scriptWriterAgent.js";
import { mediaGeneratorAgent } from "./mediaGeneratorAgent.js";
import { complianceReviewerAgent } from "./complianceReviewerAgent.js";
import { publisherAgent } from "./publisherAgent.js";
import { performanceAnalystAgent } from "./performanceAnalystAgent.js";

export function registerContentAgents(runtime: MultiAgentRuntime): void {
  runtime.register("trend-scout-agent", trendScoutAgent);
  runtime.register("research-verifier-agent", researchVerifierAgent);
  runtime.register("idea-ranker-agent", ideaRankerAgent);
  runtime.register("script-writer-agent", scriptWriterAgent);
  runtime.register("media-generator-agent", mediaGeneratorAgent);
  runtime.register("compliance-reviewer-agent", complianceReviewerAgent);
  runtime.register("publisher-agent", publisherAgent);
  runtime.register("performance-analyst-agent", performanceAnalystAgent);
}
