/**
 * Critic Model — AI evaluation of agent outputs.
 *
 * The LLM Critic sends the full context (agent output + business metadata +
 * brand data + vertical) to Claude and asks: "Would this close a sale?"
 *
 * Returns structured evaluation: score, prediction, strengths, weaknesses,
 * specific suggestions. This is a creative director reviewing work, not a
 * checkbox validator.
 *
 * Implementations:
 *   - LLMCritic (default) — Claude via OpenRouter, real reasoning
 *   - HeuristicCritic — rule-based fallback when API unavailable
 */

import { createLogger } from "../lib/logger.js";

const log = createLogger("critic-model");

// ── Public interfaces ──

export interface CriticInput {
  /** The agent output to evaluate */
  agentOutput: Record<string, unknown>;
  /** Which agent produced it */
  agentId: string;
  /** Node in the pipeline */
  nodeId: string;
  /** Pipeline run ID for tracing */
  runId: string;
  /** Business context — vertical, brand data, reviews, etc. */
  businessContext?: {
    vertical?: string;
    business_name?: string;
    brand_colours?: string[];
    review_count?: number;
    review_rating?: number;
    instagram_followers?: number;
    has_website?: boolean;
    region?: string;
  };
  /** Working memory snapshot for additional context */
  workingMemorySnapshot?: Record<string, unknown>;
  /** Previous critique if this is a reflection retry */
  previousCritique?: CriticEvaluation;
  /** Which iteration of reflection this is (1 = first attempt) */
  iteration?: number;
}

export interface CriticEvaluation {
  /** Overall quality score 0.0 – 1.0 */
  score: number;
  /** Sales prediction */
  prediction: "likely_close" | "unlikely_close" | "uncertain";
  /** Structured critique */
  critique: {
    strengths: string[];
    weaknesses: string[];
    specific_suggestions: string[];
  };
  /** How confident the critic is in its evaluation */
  confidence: number;
  /** Which model/version produced this evaluation */
  model_version: string;
  /** Cost of this evaluation in USD */
  cost_usd: number;
  /** Raw reasoning (for debugging/episodic memory) */
  reasoning?: string;
}

export interface CriticModel {
  evaluate(input: CriticInput): Promise<CriticEvaluation>;
  getActiveModelVersion(): string;
}

// ── LLM Critic (Claude via OpenRouter) ──

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const CRITIC_MODEL =
  process.env.CRITIC_MODEL ?? "anthropic/claude-sonnet-4";
const CRITIC_TIMEOUT_MS =
  Number(process.env.CRITIC_TIMEOUT_MS ?? "60000");

// Cost per million tokens (Claude Sonnet 4)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

const SYSTEM_PROMPT = `You are a sales conversion critic for an AI website generation platform.

Your job: evaluate agent outputs and predict whether the generated demo website would convince a small business owner to purchase.

You are not checking HTML validity or code quality. You are evaluating SALES EFFECTIVENESS:
- Does the site feel custom-made for THIS specific business?
- Would the business owner see it and think "this understands my brand"?
- Are trust signals (reviews, years in business, real photos) prominent?
- Does the headline speak to their customers, not generic copy?
- Are the brand colours, tone, and personality correctly reflected?
- Would this outperform their current web presence (or lack thereof)?

Consider the business vertical. A barber's site needs different things than a restaurant's:
- Restaurants: food photography, menu highlights, reservation CTA
- Barbers: trust, portfolio of cuts, easy booking
- Cafes: atmosphere, specialty items, location/hours prominent
- Salons: before/after, service menu, online booking

You MUST respond with valid JSON matching this exact structure:
{
  "score": <number 0.0-1.0>,
  "prediction": "<likely_close|unlikely_close|uncertain>",
  "confidence": <number 0.0-1.0>,
  "reasoning": "<2-3 sentences explaining your overall assessment>",
  "critique": {
    "strengths": ["<specific strength 1>", "<specific strength 2>"],
    "weaknesses": ["<specific weakness 1>", "<specific weakness 2>"],
    "specific_suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>"]
  }
}

Score guide:
- 0.0-0.3: Would actively hurt the pitch. Generic, wrong brand, broken.
- 0.3-0.5: Below average. Missing key elements for this vertical.
- 0.5-0.7: Acceptable but room for improvement. Some personalisation.
- 0.7-0.85: Strong. Feels custom, good trust signals, right tone.
- 0.85-1.0: Exceptional. Business owner would think a human designer made this.

Be specific in your critique. "Headline is generic" is weak. "Headline says 'Welcome to our business' instead of using their actual tagline 'The Freshest Cuts in Didsbury'" is strong.`;

function buildUserPrompt(input: CriticInput): string {
  const parts: string[] = [];

  parts.push("## Agent Output to Evaluate");
  parts.push("```json");
  parts.push(JSON.stringify(input.agentOutput, null, 2).slice(0, 8000));
  parts.push("```");

  if (input.businessContext) {
    parts.push("\n## Business Context");
    const ctx = input.businessContext;
    if (ctx.business_name) parts.push(`- **Business:** ${ctx.business_name}`);
    if (ctx.vertical) parts.push(`- **Vertical:** ${ctx.vertical}`);
    if (ctx.region) parts.push(`- **Region:** ${ctx.region}`);
    if (ctx.review_count !== undefined) parts.push(`- **Reviews:** ${ctx.review_count} (${ctx.review_rating ?? "?"}/5)`);
    if (ctx.instagram_followers !== undefined) parts.push(`- **Instagram followers:** ${ctx.instagram_followers}`);
    if (ctx.has_website !== undefined) parts.push(`- **Has existing website:** ${ctx.has_website ? "Yes" : "No"}`);
    if (ctx.brand_colours?.length) parts.push(`- **Brand colours:** ${ctx.brand_colours.join(", ")}`);
  }

  if (input.workingMemorySnapshot) {
    const notes = input.workingMemorySnapshot.notes as Array<{ note: string; author: string }> | undefined;
    if (notes?.length) {
      parts.push("\n## Agent Notes from Pipeline");
      for (const n of notes) {
        parts.push(`- [${n.author}]: ${n.note}`);
      }
    }
  }

  if (input.previousCritique) {
    parts.push("\n## Previous Critique (this is a retry)");
    parts.push(`Previous score: ${input.previousCritique.score}`);
    parts.push(`Iteration: ${input.iteration ?? 2}`);
    parts.push("Previous weaknesses that should be addressed:");
    for (const w of input.previousCritique.critique.weaknesses) {
      parts.push(`- ${w}`);
    }
    parts.push("Previous suggestions:");
    for (const s of input.previousCritique.critique.specific_suggestions) {
      parts.push(`- ${s}`);
    }
  }

  parts.push(`\nAgent: ${input.agentId} | Node: ${input.nodeId} | Run: ${input.runId}`);

  return parts.join("\n");
}

export class LLMCritic implements CriticModel {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts?: {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
  }) {
    this.model = opts?.model ?? CRITIC_MODEL;
    this.apiKey = opts?.apiKey ?? OPENROUTER_API_KEY;
    this.baseUrl = opts?.baseUrl ?? OPENROUTER_BASE_URL;
    this.timeoutMs = opts?.timeoutMs ?? CRITIC_TIMEOUT_MS;
  }

  getActiveModelVersion(): string {
    return `llm-critic:${this.model}`;
  }

  async evaluate(input: CriticInput): Promise<CriticEvaluation> {
    if (!this.apiKey) {
      log.warn("no API key for LLM critic, falling back to heuristic");
      return new HeuristicCritic().evaluate(input);
    }

    const userPrompt = buildUserPrompt(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
          "X-Title": process.env.OPENROUTER_APP_NAME ?? "openclaw-critic",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        log.error("critic API error", {
          status: response.status,
          body: body.slice(0, 200),
        });
        return this.buildFallbackEvaluation(input, `API error: ${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        return this.buildFallbackEvaluation(input, "empty response from critic model");
      }

      const promptTokens = payload.usage?.prompt_tokens ?? 0;
      const completionTokens = payload.usage?.completion_tokens ?? 0;
      const costUsd =
        (promptTokens / 1_000_000) * INPUT_COST_PER_M +
        (completionTokens / 1_000_000) * OUTPUT_COST_PER_M;

      // Strip markdown code fences if present (Claude sometimes wraps JSON in ```json ... ```)
      const cleanContent = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(cleanContent) as {
        score?: number;
        prediction?: string;
        confidence?: number;
        reasoning?: string;
        critique?: {
          strengths?: string[];
          weaknesses?: string[];
          specific_suggestions?: string[];
        };
      };

      const evaluation: CriticEvaluation = {
        score: Math.max(0, Math.min(1, parsed.score ?? 0.5)),
        prediction: this.normaliseP(parsed.prediction),
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        model_version: this.getActiveModelVersion(),
        cost_usd: costUsd,
        reasoning: parsed.reasoning,
        critique: {
          strengths: parsed.critique?.strengths ?? [],
          weaknesses: parsed.critique?.weaknesses ?? [],
          specific_suggestions: parsed.critique?.specific_suggestions ?? [],
        },
      };

      log.info("critic evaluation complete", {
        run_id: input.runId,
        node_id: input.nodeId,
        agent_id: input.agentId,
        score: evaluation.score,
        prediction: evaluation.prediction,
        cost_usd: costUsd,
        iteration: input.iteration ?? 1,
      });

      return evaluation;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        log.error("critic evaluation timed out", {
          run_id: input.runId,
          timeout_ms: this.timeoutMs,
        });
        return this.buildFallbackEvaluation(input, "timeout");
      }
      log.error("critic evaluation failed", {
        run_id: input.runId,
        error: String(error),
      });
      return this.buildFallbackEvaluation(input, String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  private normaliseP(
    raw?: string,
  ): "likely_close" | "unlikely_close" | "uncertain" {
    if (raw === "likely_close" || raw === "unlikely_close" || raw === "uncertain") {
      return raw;
    }
    return "uncertain";
  }

  private buildFallbackEvaluation(
    input: CriticInput,
    reason: string,
  ): CriticEvaluation {
    return {
      score: 0.5,
      prediction: "uncertain",
      confidence: 0.1,
      model_version: `llm-critic:fallback (${reason})`,
      cost_usd: 0,
      reasoning: `Critic evaluation failed: ${reason}. Defaulting to uncertain.`,
      critique: {
        strengths: [],
        weaknesses: [`Evaluation unavailable: ${reason}`],
        specific_suggestions: ["Manual review recommended"],
      },
    };
  }
}

// ── Heuristic Critic (fallback, no API calls) ──

export class HeuristicCritic implements CriticModel {
  getActiveModelVersion(): string {
    return "heuristic-critic:v1";
  }

  async evaluate(input: CriticInput): Promise<CriticEvaluation> {
    let score = 0.3; // baseline
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];
    const output = input.agentOutput;

    // Check for brand colour usage
    if (input.businessContext?.brand_colours?.length) {
      const outputStr = JSON.stringify(output).toLowerCase();
      const coloursUsed = input.businessContext.brand_colours.some((c) =>
        outputStr.includes(c.toLowerCase()),
      );
      if (coloursUsed) {
        score += 0.1;
        strengths.push("Uses actual brand colours");
      } else {
        weaknesses.push("Brand colours not reflected in output");
        suggestions.push("Incorporate brand colours: " + input.businessContext.brand_colours.join(", "));
      }
    }

    // Check for reviews
    if (input.businessContext?.review_count && input.businessContext.review_count > 10) {
      const hasReviewMention = JSON.stringify(output).toLowerCase().includes("review");
      if (hasReviewMention) {
        score += 0.1;
        strengths.push(`Mentions ${input.businessContext.review_count} reviews`);
      } else {
        weaknesses.push("Business has strong reviews but they're not featured");
        suggestions.push(`Feature their ${input.businessContext.review_count} reviews (${input.businessContext.review_rating}/5 avg)`);
      }
    }

    // Check for business name
    if (input.businessContext?.business_name) {
      const nameUsed = JSON.stringify(output).includes(input.businessContext.business_name);
      if (nameUsed) {
        score += 0.1;
        strengths.push("Uses business name correctly");
      } else {
        weaknesses.push("Business name not found in output");
        suggestions.push(`Include business name: "${input.businessContext.business_name}"`);
      }
    }

    // Check output size (non-trivial output)
    const outputSize = JSON.stringify(output).length;
    if (outputSize > 2000) {
      score += 0.1;
      strengths.push("Substantial output generated");
    } else if (outputSize < 200) {
      weaknesses.push("Output is too minimal");
      suggestions.push("Generate more comprehensive content");
    }

    // Instagram presence
    if (input.businessContext?.instagram_followers && input.businessContext.instagram_followers > 1000) {
      score += 0.05;
      const hasSocial = JSON.stringify(output).toLowerCase().includes("instagram");
      if (hasSocial) {
        strengths.push("References Instagram presence");
      } else {
        suggestions.push(`Business has ${input.businessContext.instagram_followers} Instagram followers — add social proof`);
      }
    }

    score = Math.max(0, Math.min(1, score));
    const prediction: CriticEvaluation["prediction"] =
      score >= 0.7 ? "likely_close" : score >= 0.4 ? "uncertain" : "unlikely_close";

    return {
      score,
      prediction,
      confidence: 0.3, // heuristics are low confidence
      model_version: this.getActiveModelVersion(),
      cost_usd: 0,
      reasoning: `Heuristic evaluation: ${strengths.length} strengths, ${weaknesses.length} weaknesses identified via rule checks.`,
      critique: { strengths, weaknesses, specific_suggestions: suggestions },
    };
  }
}

// ── Factory ──

export function createCritic(implementation?: string): CriticModel {
  const impl = implementation ?? process.env.CRITIC_IMPLEMENTATION ?? "llm";
  if (impl === "heuristic") return new HeuristicCritic();
  return new LLMCritic();
}
