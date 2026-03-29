import { MultiAgentRuntime } from "../../pipeline/agentRuntime.js";
import { leadScoutAgent } from "./leadScoutAgent.js";
import { leadProfilerAgent } from "./leadProfilerAgent.js";
import { brandAnalyserAgent } from "./brandAnalyser.js";
import { leadQualifierAgent } from "./leadQualifierAgent.js";
import { briefGeneratorAgent } from "./briefGenerator.js";
import { siteComposerAgent } from "./siteComposerAgent.js";
import { siteQaAgent } from "./siteQaAgent.js";
import { leadAssignerAgent } from "./leadAssignerAgent.js";
import { outcomeMeasurerAgent } from "./outcomeMeasurerAgent.js";

/**
 * Register all outreach pipeline agents with the runtime.
 * Call this during application startup after creating the MultiAgentRuntime.
 */
export function registerOutreachAgents(runtime: MultiAgentRuntime): void {
  // Phase 1: Lead generation
  runtime.register("lead-scout-agent", leadScoutAgent);
  runtime.register("lead-profiler-agent", leadProfilerAgent);
  runtime.register("brand-analyser-agent", brandAnalyserAgent);
  runtime.register("lead-qualifier-agent", leadQualifierAgent);
  // Phase 1.5: Auto-assignment (runs after qualify, parallel to site gen)
  runtime.register("lead-assigner-agent", leadAssignerAgent);
  // Phase 2: Site generation (brief → compose → qa)
  runtime.register("brief-generator-agent", briefGeneratorAgent);
  runtime.register("site-composer-agent", siteComposerAgent);
  runtime.register("site-qa-agent", siteQaAgent);
  // Phase 3: Nightly feedback loop
  runtime.register("outcome-measurer-agent", outcomeMeasurerAgent);
}

export { leadScoutAgent } from "./leadScoutAgent.js";
export { leadProfilerAgent } from "./leadProfilerAgent.js";
export { brandAnalyserAgent } from "./brandAnalyser.js";
export { leadQualifierAgent } from "./leadQualifierAgent.js";
export { briefGeneratorAgent } from "./briefGenerator.js";
export { siteComposerAgent } from "./siteComposerAgent.js";
export { siteQaAgent } from "./siteQaAgent.js";
export { leadAssignerAgent } from "./leadAssignerAgent.js";
export { outcomeMeasurerAgent } from "./outcomeMeasurerAgent.js";
