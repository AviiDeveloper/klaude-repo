/**
 * Brand Intelligence Agent — AI-powered analysis of scraped business data.
 *
 * Sits between BrandAnalyser and BriefGenerator. Takes all the raw scraped data
 * (reviews, social bios, Google categories, photos) and uses Claude to extract
 * genuine brand intelligence: tone, personality, market position, USPs,
 * colour/font recommendations with rationale.
 *
 * This is what turns "local plumber with blue template" into a demo that feels
 * like it was designed by someone who actually visited the business.
 *
 * Gated by BRAND_INTELLIGENCE_ENABLED env flag (default: true).
 * Graceful fallback: if the API call fails, the pipeline continues unchanged.
 */

import { AgentHandler } from "../../pipeline/agentRuntime.js";
import type { BrandAnalysis } from "./brandAnalyser.js";
import type { GoogleReview } from "./leadProfilerAgent.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrandTone = "luxury" | "friendly" | "professional" | "edgy" | "traditional" | "playful" | "minimal";
export type MarketPosition = "budget" | "mid-range" | "premium" | "luxury";

export interface BrandIntelligenceResult {
  // Personality
  brandTone: BrandTone;
  brandPersonality: string;
  voiceExamples: string[];

  // From review analysis
  customerSentiment: string;
  uniqueSellingPoints: string[];
  commonPraise: string[];
  customerKeywords: string[];

  // Refined copy
  suggestedHeadline: string;
  suggestedTagline: string;
  suggestedAbout: string;

  // Refined services
  refinedServices: Array<{ name: string; description: string; isHighlighted: boolean }>;

  // Design recommendations
  colourRecommendation: {
    primary: string;
    secondary: string;
    accent: string;
    rationale: string;
  };
  fontRecommendation: {
    heading: string;
    body: string;
    rationale: string;
  };

  // Market context
  marketPosition: MarketPosition;
  trustSignals: string[];
  differentiators: string[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ENABLED = (process.env.BRAND_INTELLIGENCE_ENABLED ?? "true") !== "false";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const MODEL = process.env.BRAND_INTELLIGENCE_MODEL ?? "anthropic/claude-sonnet-4-20250514";
const TIMEOUT_MS = Number(process.env.BRAND_INTELLIGENCE_TIMEOUT_MS ?? "30000");

// Sonnet pricing via OpenRouter
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildIntelligencePrompt(analysis: BrandAnalysis): string {
  const reviewBlock = analysis.rawReviews && analysis.rawReviews.length > 0
    ? analysis.rawReviews.slice(0, 15).map((r) =>
        `- ${r.rating}★ "${r.text.slice(0, 250)}" — ${r.author}`
      ).join("\n")
    : "No reviews available.";

  const socialBlock = analysis.rawSocialBios && analysis.rawSocialBios.length > 0
    ? analysis.rawSocialBios.map((bio) => `- ${bio.slice(0, 300)}`).join("\n")
    : "No social media bios available.";

  const categoriesBlock = analysis.rawGoogleCategories && analysis.rawGoogleCategories.length > 0
    ? analysis.rawGoogleCategories.join(", ")
    : "Unknown";

  const servicesBlock = analysis.services.length > 0
    ? analysis.services.join(", ")
    : "No services extracted.";

  const colourInfo = analysis.colours.palette_source !== "vertical_default"
    ? `Current brand colours (scraped): primary=${analysis.colours.primary}, secondary=${analysis.colours.secondary}, accent=${analysis.colours.accent} (source: ${analysis.colours.palette_source})`
    : "No brand colours found — business has no website or identifiable colour scheme.";

  const photoInfo = analysis.photo_inventory.length > 0
    ? `${analysis.photo_inventory.length} photos found: ${analysis.photo_inventory.map((p) => `${p.category}(${p.filename})`).slice(0, 8).join(", ")}`
    : "No photos available.";

  return `Analyse this business and produce structured brand intelligence for website design.

═══════════════════════════════════════════════════
BUSINESS DATA
═══════════════════════════════════════════════════
Name: ${analysis.lead_id ? `(Lead ${analysis.lead_id})` : ""}
Description: ${analysis.description}
Google categories: ${categoriesBlock}
Services found: ${servicesBlock}

═══════════════════════════════════════════════════
BRAND ASSETS
═══════════════════════════════════════════════════
${colourInfo}
Fonts: heading="${analysis.fonts.heading}", body="${analysis.fonts.body}" (source: ${analysis.fonts.source})
Logo: ${analysis.logo_path ? "Found" : "Not found"}
Photos: ${photoInfo}
${analysis.menu_items && analysis.menu_items.length > 0 ? `Menu items: ${analysis.menu_items.slice(0, 10).map((m) => `${m.name}${m.price ? ` (${m.price})` : ""}`).join(", ")}` : ""}

═══════════════════════════════════════════════════
CUSTOMER REVIEWS
═══════════════════════════════════════════════════
${reviewBlock}

═══════════════════════════════════════════════════
SOCIAL MEDIA PRESENCE
═══════════════════════════════════════════════════
${socialBlock}

═══════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════
Based on ALL the data above, produce a JSON object with your brand analysis. Be specific and grounded in the actual data — do not guess or use generic descriptions.

For colour recommendations:
- If brand colours were scraped, refine them (adjust harmony, ensure accessibility)
- If no colours exist, recommend colours that match the business personality, NOT generic vertical defaults
- Always provide hex codes and explain WHY these colours suit this specific business

For font recommendations:
- Pick from Google Fonts only
- Match the business tone — a luxury cocktail bar needs different fonts than a family fish & chips shop
- Explain your reasoning

For copy (headline, tagline, about):
- Write as if you are the business owner, not a marketing agency
- Use language and tone that matches the reviews and social media presence
- Reference specific things about the business, not generic category phrases

Return ONLY valid JSON matching this exact schema:
{
  "brandTone": "luxury" | "friendly" | "professional" | "edgy" | "traditional" | "playful" | "minimal",
  "brandPersonality": "string — 1-2 sentence personality description",
  "voiceExamples": ["3 example sentences in the brand's voice"],
  "customerSentiment": "string — what customers love, based on reviews",
  "uniqueSellingPoints": ["3-5 USPs derived from reviews and business data"],
  "commonPraise": ["3-5 recurring positive themes from reviews"],
  "customerKeywords": ["5-8 words customers frequently use"],
  "suggestedHeadline": "string — hero headline for website",
  "suggestedTagline": "string — subheading/tagline",
  "suggestedAbout": "string — 2-3 sentence about section",
  "refinedServices": [{"name": "string", "description": "string — specific to this business", "isHighlighted": true/false}],
  "colourRecommendation": {"primary": "#hex", "secondary": "#hex", "accent": "#hex", "rationale": "string"},
  "fontRecommendation": {"heading": "Font Name", "body": "Font Name", "rationale": "string"},
  "marketPosition": "budget" | "mid-range" | "premium" | "luxury",
  "trustSignals": ["trust badges/signals appropriate for this specific business"],
  "differentiators": ["what sets this business apart from generic competitors"]
}`;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function callBrandIntelligence(
  analysis: BrandAnalysis,
): Promise<BrandIntelligenceResult | null> {
  if (!OPENROUTER_API_KEY) {
    console.log("[Brand Intelligence] No API key configured, skipping.");
    return null;
  }

  const prompt = buildIntelligencePrompt(analysis);

  console.log(`[Brand Intelligence] Analysing brand for lead ${analysis.lead_id}...`);
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "openclaw-brand-intelligence",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You are a brand strategist and web design expert. Analyse business data and return structured JSON. Return ONLY valid JSON — no markdown fences, no explanation.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Brand Intelligence] API error ${response.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[Brand Intelligence] Empty response from API");
      return null;
    }

    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;
    const costUsd = (promptTokens / 1_000_000) * INPUT_COST_PER_M
                  + (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[Brand Intelligence] Done in ${elapsed}s — ${promptTokens + completionTokens} tokens, $${costUsd.toFixed(4)}`);

    // Parse JSON — strip markdown fences if present
    let json = content.trim();
    if (json.startsWith("```json")) json = json.slice(7);
    else if (json.startsWith("```")) json = json.slice(3);
    if (json.endsWith("```")) json = json.slice(0, -3);
    json = json.trim();

    const parsed = JSON.parse(json) as BrandIntelligenceResult;

    // Validate required fields
    if (!parsed.brandTone || !parsed.suggestedHeadline || !parsed.colourRecommendation) {
      console.error("[Brand Intelligence] Response missing required fields");
      return null;
    }

    // Normalise colour hex codes
    if (parsed.colourRecommendation) {
      parsed.colourRecommendation.primary = normaliseHex(parsed.colourRecommendation.primary);
      parsed.colourRecommendation.secondary = normaliseHex(parsed.colourRecommendation.secondary);
      parsed.colourRecommendation.accent = normaliseHex(parsed.colourRecommendation.accent);
    }

    return parsed;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error("[Brand Intelligence] Request timed out");
    } else if (err instanceof SyntaxError) {
      console.error("[Brand Intelligence] Failed to parse JSON response");
    } else {
      console.error(`[Brand Intelligence] Error: ${(err as Error).message}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function normaliseHex(hex: string): string {
  if (!hex) return "#2563eb";
  hex = hex.trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  // Validate it's a proper hex colour
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    // Expand shorthand
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return "#2563eb"; // fallback
}

// ---------------------------------------------------------------------------
// Agent Handler
// ---------------------------------------------------------------------------

export const brandIntelligenceAgent: AgentHandler = async (input) => {
  if (!ENABLED) {
    console.log("[Brand Intelligence] Disabled via BRAND_INTELLIGENCE_ENABLED=false, passing through.");
    // Pass through upstream data unchanged
    const upstream = input.upstreamArtifacts as Record<string, {
      analyses?: BrandAnalysis[];
      profiles?: Array<Record<string, unknown>>;
    }>;
    const analyses: BrandAnalysis[] = [];
    const profiles: Array<Record<string, unknown>> = [];
    for (const nodeOutput of Object.values(upstream)) {
      if (nodeOutput?.analyses) analyses.push(...nodeOutput.analyses);
      if (nodeOutput?.profiles) profiles.push(...nodeOutput.profiles);
    }
    return {
      summary: "Brand intelligence disabled — passing through unchanged.",
      artifacts: { analyses, profiles },
    };
  }

  const upstream = input.upstreamArtifacts as Record<string, {
    analyses?: BrandAnalysis[];
    profiles?: Array<Record<string, unknown>>;
  }>;

  const analyses: BrandAnalysis[] = [];
  const profiles: Array<Record<string, unknown>> = [];

  for (const nodeOutput of Object.values(upstream)) {
    if (nodeOutput?.analyses) analyses.push(...nodeOutput.analyses);
    if (nodeOutput?.profiles) profiles.push(...nodeOutput.profiles);
  }

  if (analyses.length === 0) {
    return {
      summary: "No brand analyses to enrich.",
      artifacts: { analyses, profiles },
    };
  }

  let enriched = 0;
  let failed = 0;

  for (const analysis of analyses) {
    const result = await callBrandIntelligence(analysis);
    if (result) {
      analysis.intelligence = result;
      enriched++;
    } else {
      failed++;
    }
  }

  return {
    summary: `Brand intelligence: ${enriched} enriched, ${failed} failed/skipped out of ${analyses.length}.`,
    artifacts: {
      analyses,
      profiles,
      intelligence_count: enriched,
    },
  };
};
