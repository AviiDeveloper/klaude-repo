#!/usr/bin/env tsx
/**
 * Test harness: single-business demo generation pipeline.
 *
 * Usage:
 *   npx tsx scripts/test-demo-gen.ts "Business Name" "Address or City"
 *   npx tsx scripts/test-demo-gen.ts "Tony's Barbers" "Camden, London"
 *   npx tsx scripts/test-demo-gen.ts "The Espresso Room" "31 Great Ormond St, London"
 *
 * Optional flags:
 *   --no-scrape    Skip Playwright scraping (use minimal seed data only)
 *   --no-intel     Skip brand intelligence API call
 *   --no-ai        Skip AI composer (use template fallback)
 *   --website URL  Provide a known website URL to scrape
 *
 * Outputs:
 *   output/demo-gen/{lead_id}/
 *     site-brief.md       — The brief fed to the composer
 *     site.html            — Generated demo website (open in browser!)
 *     design-rationale.txt — Design system decisions
 *     intelligence.json    — Brand intelligence (if enabled)
 *     pipeline-summary.txt — Full pipeline run summary
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Agent imports
import { leadProfilerAgent, type LeadToProfile } from "../src/agents/outreach/leadProfilerAgent.js";
import { brandAnalyserAgent } from "../src/agents/outreach/brandAnalyser.js";
import { brandIntelligenceAgent } from "../src/agents/outreach/brandIntelligence.js";
import { briefGeneratorAgent } from "../src/agents/outreach/briefGenerator.js";
import { siteComposerAgent } from "../src/agents/outreach/siteComposerAgent.js";
import { siteQaAgent } from "../src/agents/outreach/siteQaAgent.js";
import type { AgentExecutionInput } from "../src/pipeline/agentRuntime.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const businessName = positional[0];
const address = positional[1] ?? "";

if (!businessName) {
  console.error(`
Usage: npx tsx scripts/test-demo-gen.ts "Business Name" "Address"

Example:
  npx tsx scripts/test-demo-gen.ts "Tony's Barbers" "Camden, London"
  npx tsx scripts/test-demo-gen.ts "The Espresso Room" "31 Great Ormond St, London" --website https://theespressoroom.com
`);
  process.exit(1);
}

const skipScrape = flags.has("--no-scrape");
const skipIntel = flags.has("--no-intel");
const skipAi = flags.has("--no-ai");
const websiteUrlFlag = args.find((a, i) => args[i - 1] === "--website");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const leadId = `test-${Date.now()}`;
const outputDir = join(process.cwd(), "output", "demo-gen", leadId);
mkdirSync(outputDir, { recursive: true });

function makeInput(agentId: string, upstream: Record<string, unknown>): AgentExecutionInput {
  return {
    run_id: `test-run-${Date.now()}`,
    node_id: `${agentId}-node`,
    agent_id: agentId,
    upstreamArtifacts: { upstream },
  };
}

function elapsed(t0: number): string {
  return `${((Date.now() - t0) / 1000).toFixed(1)}s`;
}

const summaryLines: string[] = [];
function log(msg: string): void {
  console.log(msg);
  summaryLines.push(msg);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const t0 = Date.now();
  log(`\n${"═".repeat(60)}`);
  log(`  DEMO GENERATION TEST — ${businessName}`);
  log(`  Address: ${address || "(none)"}`);
  log(`  Lead ID: ${leadId}`);
  log(`  Flags: scrape=${!skipScrape} intel=${!skipIntel} ai=${!skipAi}`);
  log(`${"═".repeat(60)}\n`);

  // ---------------------------------------------------------------
  // Step 1: PROFILER — scrape Google Maps + website + social
  // ---------------------------------------------------------------
  log(`[1/6] PROFILER — scraping business data...`);
  const profilerStart = Date.now();

  const seedLead: LeadToProfile = {
    lead_id: leadId,
    business_name: businessName,
    address: address || undefined,
    website_url: websiteUrlFlag ?? undefined,
  };

  let profilerResult;
  if (skipScrape) {
    log(`  ⏭️  Scraping skipped (--no-scrape). Using seed data only.`);
    profilerResult = {
      summary: "Skipped — seed data only",
      artifacts: {
        profiles: [{
          lead_id: leadId,
          business_name: businessName,
          business_type: guessBusinessType(businessName),
          address,
          google_rating: null,
          google_review_count: null,
          has_ssl: 0 as const,
          is_mobile_friendly: 0 as const,
          has_social_links: 0 as const,
          social_links_json: "[]",
          website_tech_stack: "[]",
          website_quality_score: 0,
          pain_points_json: "[]",
          profiled_at: new Date().toISOString(),
          brand_colours_json: "{}",
          brand_fonts_json: "[]",
          brand_assets_json: "{}",
          social_profiles_json: "[]",
          services_extracted_json: "[]",
          google_business_json: "{}",
          phone: "",
          email: "",
        }],
        profiled_count: 1,
      },
    };
  } else {
    profilerResult = await leadProfilerAgent(
      makeInput("lead-profiler-agent", { leads: [seedLead] }),
    );
  }

  const profiles = (profilerResult.artifacts.profiles as Array<Record<string, unknown>>) ?? [];
  log(`  ✅ Profiler done (${elapsed(profilerStart)}): ${profilerResult.summary}`);
  log(`     Profiles: ${profiles.length}`);

  if (profiles.length > 0) {
    const p = profiles[0] as Record<string, unknown>;
    log(`     Google rating: ${p.google_rating ?? "N/A"} (${p.google_review_count ?? 0} reviews)`);
    log(`     Address: ${p.address ?? "unknown"}`);
    log(`     Phone: ${p.phone ?? "not found"}`);
    log(`     Website scraped: ${p.website_quality_score ? "yes" : "no"}`);
    const gBiz = safeJsonParse(p.google_business_json as string);
    log(`     Google photos: ${(gBiz?.photos as string[])?.length ?? 0}`);
    log(`     Reviews: ${(gBiz?.reviews as unknown[])?.length ?? 0}`);
  }

  // ---------------------------------------------------------------
  // Step 2: BRAND ANALYSER
  // ---------------------------------------------------------------
  log(`\n[2/6] BRAND ANALYSER — extracting brand identity...`);
  const analyserStart = Date.now();

  const analyserResult = await brandAnalyserAgent(
    makeInput("brand-analyser-agent", { profiles }),
  );

  const analyses = (analyserResult.artifacts.analyses as Array<Record<string, unknown>>) ?? [];
  log(`  ✅ Analyser done (${elapsed(analyserStart)}): ${analyserResult.summary}`);

  if (analyses.length > 0) {
    const a = analyses[0] as Record<string, unknown>;
    const colours = a.colours as Record<string, string>;
    const fonts = a.fonts as Record<string, string>;
    log(`     Colours: primary=${colours?.primary} (source: ${colours?.palette_source})`);
    log(`     Fonts: ${fonts?.heading} / ${fonts?.body} (source: ${fonts?.source})`);
    log(`     Services: ${(a.services as string[])?.length ?? 0}`);
    log(`     Photos: ${(a.photo_inventory as unknown[])?.length ?? 0}`);
    log(`     Logo: ${a.logo_path ? "yes" : "no"}`);
  }

  // ---------------------------------------------------------------
  // Step 3: BRAND INTELLIGENCE (AI-powered analysis)
  // ---------------------------------------------------------------
  log(`\n[3/6] BRAND INTELLIGENCE — AI analysis of scraped data...`);
  const intelStart = Date.now();

  let intelResult;
  if (skipIntel) {
    log(`  ⏭️  Intelligence skipped (--no-intel).`);
    intelResult = {
      summary: "Skipped",
      artifacts: { analyses, profiles },
    };
  } else {
    // Temporarily set the env flag
    const prevFlag = process.env.BRAND_INTELLIGENCE_ENABLED;
    process.env.BRAND_INTELLIGENCE_ENABLED = "true";

    intelResult = await brandIntelligenceAgent(
      makeInput("brand-intelligence-agent", { analyses, profiles }),
    );

    if (prevFlag !== undefined) process.env.BRAND_INTELLIGENCE_ENABLED = prevFlag;
    else delete process.env.BRAND_INTELLIGENCE_ENABLED;
  }

  const enrichedAnalyses = (intelResult.artifacts.analyses as Array<Record<string, unknown>>) ?? analyses;
  log(`  ✅ Intelligence done (${elapsed(intelStart)}): ${intelResult.summary}`);

  if (enrichedAnalyses.length > 0) {
    const intel = (enrichedAnalyses[0] as Record<string, unknown>).intelligence as Record<string, unknown> | undefined;
    if (intel) {
      log(`     Brand tone: ${intel.brandTone}`);
      log(`     Personality: ${String(intel.brandPersonality).slice(0, 80)}`);
      log(`     Market position: ${intel.marketPosition}`);
      log(`     USPs: ${(intel.uniqueSellingPoints as string[])?.join(", ") ?? "none"}`);
      log(`     Colour rec: ${(intel.colourRecommendation as Record<string, string>)?.primary ?? "none"}`);
      log(`     Font rec: ${(intel.fontRecommendation as Record<string, string>)?.heading ?? "none"}`);

      writeFileSync(
        join(outputDir, "intelligence.json"),
        JSON.stringify(intel, null, 2),
      );
      log(`     → Saved to intelligence.json`);
    } else {
      log(`     No intelligence result (API may have failed or been skipped).`);
    }
  }

  // ---------------------------------------------------------------
  // Step 4: BRIEF GENERATOR
  // ---------------------------------------------------------------
  log(`\n[4/6] BRIEF GENERATOR — building site brief...`);
  const briefStart = Date.now();

  const briefResult = await briefGeneratorAgent(
    makeInput("brief-generator-agent", { analyses: enrichedAnalyses, profiles }),
  );

  const briefs = (briefResult.artifacts.briefs as Array<Record<string, unknown>>) ?? [];
  log(`  ✅ Brief done (${elapsed(briefStart)}): ${briefResult.summary}`);

  if (briefs.length > 0) {
    const b = briefs[0] as Record<string, unknown>;
    log(`     Headline: "${b.heroHeadline}"`);
    log(`     Tagline: "${(b.heroSubtext as string)?.slice(0, 80)}"`);
    log(`     Services: ${(b.services as unknown[])?.length ?? 0} (${(b.services as Array<{isScraped: boolean}>)?.filter(s => s.isScraped).length ?? 0} scraped)`);
    log(`     Sections: ${(b.sectionOrder as string[])?.join(" → ")}`);
    log(`     Brand tone: ${b.brandTone ?? "none"}`);

    const markdown = b.markdown as string;
    if (markdown) {
      writeFileSync(join(outputDir, "site-brief.md"), markdown);
      log(`     → Saved to site-brief.md`);
    }
  }

  // ---------------------------------------------------------------
  // Step 5: SITE COMPOSER (AI or template)
  // ---------------------------------------------------------------
  log(`\n[5/6] SITE COMPOSER — generating demo website...`);
  const composerStart = Date.now();

  // Set AI composer flag
  const prevAiFlag = process.env.AI_COMPOSER_ENABLED;
  process.env.AI_COMPOSER_ENABLED = skipAi ? "false" : "true";

  const composerResult = await siteComposerAgent(
    makeInput("site-composer-agent", {
      qualified: profiles,
      analyses: enrichedAnalyses,
      briefs,
    }),
  );

  if (prevAiFlag !== undefined) process.env.AI_COMPOSER_ENABLED = prevAiFlag;
  else delete process.env.AI_COMPOSER_ENABLED;

  const sites = (composerResult.artifacts.sites as Array<Record<string, unknown>>) ?? [];
  log(`  ✅ Composer done (${elapsed(composerStart)}): ${composerResult.summary}`);

  if (sites.length > 0) {
    const s = sites[0];
    log(`     Method: ${s.ai_generated ? "AI (Claude)" : "Template"}`);
    if (s.ai_cost_usd) log(`     AI cost: $${(s.ai_cost_usd as number).toFixed(4)}`);
    if (s.ai_tokens_used) log(`     Tokens: ${s.ai_tokens_used}`);

    const html = (s.html_output ?? s.html) as string;
    if (html) {
      writeFileSync(join(outputDir, "site.html"), html);
      log(`     → Saved to site.html (${(html.length / 1024).toFixed(1)} KB)`);
    }

    // Save design rationale
    const rationale = s.design_rationale as string[];
    if (rationale) {
      writeFileSync(join(outputDir, "design-rationale.txt"), rationale.join("\n"));
    }
  }

  // ---------------------------------------------------------------
  // Step 6: SITE QA
  // ---------------------------------------------------------------
  log(`\n[6/6] SITE QA — validating generated site...`);
  const qaStart = Date.now();

  const qaResult = await siteQaAgent(
    makeInput("site-qa-agent", {
      sites: sites.map((s) => ({
        lead_id: leadId,
        site_name: businessName,
        business_name: businessName,
        html_output: s.html ?? s.html_output ?? "",
        css_output: s.css_output ?? "",
      })),
    }),
  );

  log(`  ✅ QA done (${elapsed(qaStart)}): ${qaResult.summary}`);

  const qaReports = (qaResult.artifacts.reports as Array<Record<string, unknown>>) ?? [];
  if (qaReports.length > 0) {
    const r = qaReports[0];
    log(`     Score: ${r.overall_score ?? "N/A"}`);
    log(`     Passed: ${r.passed ? "YES" : "NO"}`);
    const issues = r.issues as Array<Record<string, string>> | undefined;
    if (issues && issues.length > 0) {
      log(`     Issues (${issues.length}):`);
      for (const issue of issues.slice(0, 5)) {
        log(`       - [${issue.severity}] ${issue.message}`);
      }
    }
  }

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  const totalTime = elapsed(t0);
  log(`\n${"═".repeat(60)}`);
  log(`  PIPELINE COMPLETE — ${totalTime}`);
  log(`  Output: ${outputDir}`);
  log(`${"═".repeat(60)}`);

  if (sites.length > 0) {
    const htmlPath = join(outputDir, "site.html");
    log(`\n  Open in browser: file://${htmlPath}\n`);
  }

  // Save full summary
  writeFileSync(join(outputDir, "pipeline-summary.txt"), summaryLines.join("\n"));
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function guessBusinessType(name: string): string {
  const lower = name.toLowerCase();
  if (/barber/.test(lower)) return "barber";
  if (/salon|hair|beauty/.test(lower)) return "salon";
  if (/espresso|coffee|cafe/.test(lower)) return "cafe";
  if (/restaurant|kitchen|grill|bistro/.test(lower)) return "restaurant";
  if (/pizza|burger|kebab|takeaway|chippy|fish/.test(lower)) return "takeaway";
  if (/plumb/.test(lower)) return "plumber";
  if (/electri/.test(lower)) return "electrician";
  if (/build|construct/.test(lower)) return "builder";
  if (/dentist|dental/.test(lower)) return "dentist";
  if (/account/.test(lower)) return "accountant";
  if (/bakery|bake/.test(lower)) return "bakery";
  if (/florist|flower/.test(lower)) return "shop";
  if (/pub|bar/.test(lower)) return "restaurant";
  if (/spa|massage|therapy/.test(lower)) return "spa";
  if (/gym|fitness/.test(lower)) return "spa";
  if (/nail/.test(lower)) return "salon";
  return "business";
}

function safeJsonParse(json: string | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

run().catch((err) => {
  console.error("\n❌ Pipeline failed:", err);
  writeFileSync(
    join(outputDir, "error.txt"),
    `Pipeline failed at ${new Date().toISOString()}\n\n${err.stack ?? err.message ?? err}`,
  );
  process.exit(1);
});
