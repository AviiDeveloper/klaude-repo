import { createLogger } from "../../lib/logger.js";
import { AgentHandler } from "../../pipeline/agentRuntime.js";

const log = createLogger("performance-analyst");

interface RunMetrics {
  run_id: string;
  pipeline_duration_ms: number;
  total_cost_usd: number;
  topics_scouted: number;
  topics_verified: number;
  ideas_ranked: number;
  scripts_written: number;
  scripts_passed_compliance: number;
  posts_queued: number;
  media_briefs_generated: number;
}

function findBottleneck(rates: Record<string, number>): string {
  let min = 1;
  let minKey = "none";
  for (const [key, val] of Object.entries(rates)) {
    if (key === "overall") continue;
    if (val < min) { min = val; minKey = key; }
  }
  return `${minKey} (${(min * 100).toFixed(0)}%)`;
}

export const performanceAnalystAgent: AgentHandler = async (input) => {
  const runId = input.run_id;

  // Collect metrics from all upstream artifacts
  const topics = (input.upstreamArtifacts?.topics as unknown[]) ?? [];
  const verifiedTopics = (input.upstreamArtifacts?.verified_topics as unknown[]) ?? [];
  const rankedIdeas = (input.upstreamArtifacts?.ranked_ideas as unknown[]) ?? [];
  const scripts = (input.upstreamArtifacts?.scripts as unknown[]) ?? [];
  const complianceResults = (input.upstreamArtifacts?.results as Array<{ passed: boolean }>) ?? [];
  const mediaBriefs = (input.upstreamArtifacts?.media_briefs as unknown[]) ?? [];
  const postCount = (input.upstreamArtifacts?.post_count as number) ?? 0;

  const passedCompliance = complianceResults.filter((r) => r.passed).length;

  // Calculate pipeline efficiency metrics
  const conversionRates = {
    scout_to_verified: topics.length > 0 ? verifiedTopics.length / topics.length : 0,
    verified_to_ideas: verifiedTopics.length > 0 ? rankedIdeas.length / verifiedTopics.length : 0,
    ideas_to_scripts: rankedIdeas.length > 0 ? scripts.length / rankedIdeas.length : 0,
    scripts_to_compliant: scripts.length > 0 ? passedCompliance / scripts.length : 0,
    compliant_to_published: passedCompliance > 0 ? postCount / passedCompliance : 0,
    overall: topics.length > 0 ? postCount / topics.length : 0,
  };

  const metrics: RunMetrics = {
    run_id: runId,
    pipeline_duration_ms: 0, // Filled by engine from node timestamps
    total_cost_usd: 0,       // Filled by engine from spend_ledger
    topics_scouted: topics.length,
    topics_verified: verifiedTopics.length,
    ideas_ranked: rankedIdeas.length,
    scripts_written: scripts.length,
    scripts_passed_compliance: passedCompliance,
    posts_queued: postCount,
    media_briefs_generated: mediaBriefs.length,
  };

  const recommendations: string[] = [];

  if (conversionRates.scout_to_verified < 0.5) {
    recommendations.push("Low topic verification rate — consider adjusting trend sources or verification criteria");
  }
  if (conversionRates.scripts_to_compliant < 0.8) {
    recommendations.push("High compliance rejection rate — review script writer prompts for prohibited patterns");
  }
  if (postCount === 0 && topics.length > 0) {
    recommendations.push("Zero posts queued despite having topics — check pipeline for bottlenecks");
  }
  if (conversionRates.overall > 0.3) {
    recommendations.push("Strong overall conversion rate — pipeline is performing well");
  }

  log.info("pipeline performance analysis complete", {
    run_id: runId,
    overall_conversion: conversionRates.overall.toFixed(2),
    posts_queued: postCount,
  });

  return {
    summary: `Pipeline run ${runId}: ${topics.length} topics → ${postCount} posts queued (${(conversionRates.overall * 100).toFixed(0)}% conversion)`,
    artifacts: {
      metrics,
      conversion_rates: conversionRates,
      recommendations,
      metrics_collected: true,
      _decision: {
        reasoning: `Analyzed pipeline with ${(conversionRates.overall * 100).toFixed(0)}% overall conversion. Bottleneck: ${findBottleneck(conversionRates)}. ${recommendations.length} recommendations generated.`,
        alternatives: ["Could compare against historical baselines", "Could generate cost-per-post efficiency metrics"],
        confidence: topics.length >= 3 ? 0.85 : 0.4,
        tags: ["analytics", `conversion:${(conversionRates.overall * 100).toFixed(0)}pct`],
      },
    },
  };
};
