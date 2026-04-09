import { MultiAgentRuntime } from "../../pipeline/agentRuntime.js";
import { AgentCapabilityRegistry } from "../../runtime/agent-registry.js";
import { leadScoutAgent } from "./leadScoutAgent.js";
import { leadProfilerAgent } from "./leadProfilerAgent.js";
import { brandAnalyserAgent } from "./brandAnalyser.js";
import { brandIntelligenceAgent } from "./brandIntelligence.js";
import { leadQualifierAgent } from "./leadQualifierAgent.js";
import { briefGeneratorAgent } from "./briefGenerator.js";
import { siteComposerAgent } from "./siteComposerAgent.js";
import { siteQaAgent } from "./siteQaAgent.js";
import { leadAssignerAgent } from "./leadAssignerAgent.js";

/**
 * Register all outreach pipeline agents with the legacy runtime.
 * @deprecated Use registerOutreachAgentsWithRegistry instead.
 */
export function registerOutreachAgents(runtime: MultiAgentRuntime): void {
  runtime.register("lead-scout-agent", leadScoutAgent);
  runtime.register("lead-profiler-agent", leadProfilerAgent);
  runtime.register("brand-analyser-agent", brandAnalyserAgent);
  runtime.register("brand-intelligence-agent", brandIntelligenceAgent);
  runtime.register("lead-qualifier-agent", leadQualifierAgent);
  runtime.register("lead-assigner-agent", leadAssignerAgent);
  runtime.register("brief-generator-agent", briefGeneratorAgent);
  runtime.register("site-composer-agent", siteComposerAgent);
  runtime.register("site-qa-agent", siteQaAgent);
}

/**
 * Register all outreach pipeline agents with the capability registry.
 * Includes capability metadata for routing, cost tracking, and reflection.
 */
export function registerOutreachAgentsWithRegistry(registry: AgentCapabilityRegistry): void {
  registry.register({
    id: "lead-scout-agent",
    name: "Lead Scout",
    description: "Discovers leads via Google Places multi-vertical search with enrichment",
    capabilities: ["lead_discovery", "data_scraping", "google_places"],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 2,
    timeout_ms: 60000,
    cost_per_run_estimate_usd: 0.05,
    reflection_enabled: false,
  }, leadScoutAgent);

  registry.register({
    id: "lead-profiler-agent",
    name: "Lead Profiler",
    description: "Scrapes websites and Instagram to build business profiles",
    capabilities: ["web_scraping", "social_scraping", "data_enrichment"],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 2,
    timeout_ms: 90000,
    cost_per_run_estimate_usd: 0.03,
    reflection_enabled: false,
  }, leadProfilerAgent);

  registry.register({
    id: "brand-analyser-agent",
    name: "Brand Analyser",
    description: "Analyses brand imagery — colour palettes, fonts, visual assets",
    capabilities: ["brand_analysis", "image_analysis", "colour_extraction"],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 1,
    timeout_ms: 30000,
    cost_per_run_estimate_usd: 0.01,
    reflection_enabled: false,
  }, brandAnalyserAgent);

  registry.register({
    id: "brand-intelligence-agent",
    name: "Brand Intelligence",
    description: "AI analysis of brand tone, personality, USPs, headline generation",
    capabilities: ["ai_analysis", "brand_intelligence", "copy_generation"],
    requires_approval_for: [],
    model_provider: "openrouter",
    max_retries: 2,
    timeout_ms: 120000,
    cost_per_run_estimate_usd: 0.10,
    reflection_enabled: true,
  }, brandIntelligenceAgent);

  registry.register({
    id: "lead-qualifier-agent",
    name: "Lead Qualifier",
    description: "Vertical-weighted scoring, chain detection, premises check",
    capabilities: ["lead_scoring", "qualification", "chain_detection"],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 1,
    timeout_ms: 15000,
    cost_per_run_estimate_usd: 0.01,
    reflection_enabled: false,
  }, leadQualifierAgent);

  registry.register({
    id: "lead-assigner-agent",
    name: "Lead Assigner",
    description: "Assigns qualified leads to salespeople by postcode proximity",
    capabilities: ["lead_assignment", "geo_routing"],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 1,
    timeout_ms: 10000,
    cost_per_run_estimate_usd: 0.0,
    reflection_enabled: false,
  }, leadAssignerAgent);

  registry.register({
    id: "brief-generator-agent",
    name: "Brief Generator",
    description: "Creates site generation briefs from lead and brand data",
    capabilities: ["brief_generation", "copy_generation"],
    requires_approval_for: [],
    model_provider: "openrouter",
    max_retries: 2,
    timeout_ms: 60000,
    cost_per_run_estimate_usd: 0.08,
    reflection_enabled: true,
  }, briefGeneratorAgent);

  registry.register({
    id: "site-composer-agent",
    name: "Site Composer",
    description: "Generates complete HTML/CSS websites from briefs",
    capabilities: ["html_generation", "css_generation", "responsive_design"],
    requires_approval_for: [],
    model_provider: "openrouter",
    max_retries: 2,
    timeout_ms: 180000,
    cost_per_run_estimate_usd: 0.15,
    reflection_enabled: true,
    fallback_agent_id: undefined,
  }, siteComposerAgent);

  registry.register({
    id: "site-qa-agent",
    name: "Site QA",
    description: "Quality assurance checks on generated websites",
    capabilities: ["html_validation", "accessibility_check", "quality_assurance"],
    requires_approval_for: [],
    model_provider: "custom_lora",
    max_retries: 1,
    timeout_ms: 30000,
    cost_per_run_estimate_usd: 0.02,
    reflection_enabled: false,
  }, siteQaAgent);
}

export { leadScoutAgent } from "./leadScoutAgent.js";
export { leadProfilerAgent } from "./leadProfilerAgent.js";
export { brandAnalyserAgent } from "./brandAnalyser.js";
export { leadQualifierAgent } from "./leadQualifierAgent.js";
export { briefGeneratorAgent } from "./briefGenerator.js";
export { siteComposerAgent } from "./siteComposerAgent.js";
export { siteQaAgent } from "./siteQaAgent.js";
export { leadAssignerAgent } from "./leadAssignerAgent.js";
