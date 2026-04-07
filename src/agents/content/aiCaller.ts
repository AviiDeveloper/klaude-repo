import { createLogger } from "../../lib/logger.js";

const log = createLogger("ai-caller");

export interface AiCallOptions {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}

export interface AiCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

// OpenRouter pricing (USD per 1M tokens) — conservative estimates
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "openai/gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "anthropic/claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "google/gemini-2.0-flash-001": { input: 0.1, output: 0.4 },
};

const DEFAULT_MODEL = process.env.CONTENT_PIPELINE_MODEL ?? "openai/gpt-4.1-mini";
const DEFAULT_TIMEOUT = Number(process.env.CONTENT_PIPELINE_TIMEOUT_MS ?? "30000");

function getApiConfig(): { apiKey: string; baseUrl: string; headers: Record<string, string> } {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("No API key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.");
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  return {
    apiKey,
    baseUrl,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "openclaw-content-pipeline",
    },
  };
}

export async function callAi(options: AiCallOptions): Promise<AiCallResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const { apiKey, baseUrl, headers } = getApiConfig();

  const body: Record<string, unknown> = {
    model,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2000,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
  };

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`AI API error ${response.status}: ${errBody}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI response missing content");
    }

    const inputTokens = payload.usage?.prompt_tokens ?? 0;
    const outputTokens = payload.usage?.completion_tokens ?? 0;
    const pricing = MODEL_PRICING[model] ?? { input: 1.0, output: 3.0 };
    const costUsd =
      (inputTokens * pricing.input) / 1_000_000 +
      (outputTokens * pricing.output) / 1_000_000;

    log.debug("ai call completed", {
      model,
      inputTokens,
      outputTokens,
      costUsd: costUsd.toFixed(6),
    });

    return {
      content,
      inputTokens,
      outputTokens,
      costUsd,
      model: payload.model ?? model,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`AI call timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Flatten upstream artifacts from pipeline engine format.
 * Pipeline engine keys artifacts by node_id: { "trend-scout": { topics: [...] } }
 * Agents expect flat: { topics: [...] }
 * This merges all node outputs into a single flat object.
 */
export function flattenUpstream(artifacts: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(artifacts)) {
    if (key.startsWith("_")) {
      // Pass through internal keys (_learningContext, etc.)
      flat[key] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // This is a node output — merge its contents
      Object.assign(flat, value);
    } else {
      // Direct value
      flat[key] = value;
    }
  }
  return flat;
}

/** Parse JSON from AI response, handling markdown code fences */
export function parseAiJson<T>(content: string): T {
  let cleaned = content.trim();
  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned) as T;
}
