import { MultiAgentRuntime } from "../../pipeline/agentRuntime.js";
import { leadScoutAgent } from "./leadScoutAgent.js";
import { leadProfilerAgent } from "./leadProfilerAgent.js";
import { leadQualifierAgent } from "./leadQualifierAgent.js";
import { siteComposerAgent } from "./siteComposerAgent.js";
import { siteQaAgent } from "./siteQaAgent.js";

/**
 * Register all outreach pipeline agents with the runtime.
 * Call this during application startup after creating the MultiAgentRuntime.
 */
export function registerOutreachAgents(runtime: MultiAgentRuntime): void {
  // Phase 1: Lead generation
  runtime.register("lead-scout-agent", leadScoutAgent);
  runtime.register("lead-profiler-agent", leadProfilerAgent);
  runtime.register("lead-qualifier-agent", leadQualifierAgent);
  // Phase 2: Site generation
  runtime.register("site-composer-agent", siteComposerAgent);
  runtime.register("site-qa-agent", siteQaAgent);
}

export { leadScoutAgent } from "./leadScoutAgent.js";
export { leadProfilerAgent } from "./leadProfilerAgent.js";
export { leadQualifierAgent } from "./leadQualifierAgent.js";
export { siteComposerAgent } from "./siteComposerAgent.js";
export { siteQaAgent } from "./siteQaAgent.js";
