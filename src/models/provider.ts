import { AgentRequest } from "../types/task.js";

export interface ProviderCallerIntent {
  title: string;
  objective: string;
  acknowledgement: string;
}

export interface ProviderAgentOutput {
  summary: string;
  logs: string[];
}

interface OpenAICompatibleOptions {
  apiKey: string;
  model: string;
  baseUrl: string;
  providerName?: string;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  fallbackToLocal?: boolean;
}

export interface ModelProvider {
  readonly name: string;
  callerIntent(text: string): Promise<ProviderCallerIntent>;
  agentOutput(input: {
    agent: "code-agent" | "ops-agent";
    request: AgentRequest;
  }): Promise<ProviderAgentOutput>;
}

export class LocalHeuristicModelProvider implements ModelProvider {
  readonly name = "local-heuristic";

  async callerIntent(text: string): Promise<ProviderCallerIntent> {
    const normalized = text.trim();
    return {
      title: normalized.slice(0, 80) || "Untitled task",
      objective: normalized || "No objective provided",
      acknowledgement: "Understood. I am creating a task and starting execution.",
    };
  }

  async agentOutput(input: {
    agent: "code-agent" | "ops-agent";
    request: AgentRequest;
  }): Promise<ProviderAgentOutput> {
    if (input.agent === "code-agent") {
      return {
        summary: `Prepared implementation notes for step: ${input.request.plan_step}`,
        logs: ["CodeAgent executed without side effects."],
      };
    }

    return {
      summary: `Prepared operations notes for step: ${input.request.plan_step}`,
      logs: ["OpsAgent executed without side effects."],
    };
  }
}

export class OpenAIModelProvider implements ModelProvider {
  readonly name: string;
  private readonly localFallback = new LocalHeuristicModelProvider();
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fallbackToLocal: boolean;

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.name = options.providerName ?? "openai-model-provider";
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.maxRetries = options.maxRetries ?? 1;
    this.fallbackToLocal = options.fallbackToLocal ?? true;
  }

  async callerIntent(text: string): Promise<ProviderCallerIntent> {
    try {
      const parsed = (await this.requestJson({
        systemInstruction:
          "Return strict JSON with keys: title, objective, acknowledgement. Keep acknowledgement concise.",
        userContent: text,
      })) as Partial<ProviderCallerIntent>;

      if (!parsed.title || !parsed.objective || !parsed.acknowledgement) {
        throw new Error("OpenAI caller response missing required intent fields");
      }

      return {
        title: parsed.title,
        objective: parsed.objective,
        acknowledgement: parsed.acknowledgement,
      };
    } catch (error) {
      if (!this.fallbackToLocal) {
        throw error;
      }
      return this.localFallback.callerIntent(text);
    }
  }

  async agentOutput(input: {
    agent: "code-agent" | "ops-agent";
    request: AgentRequest;
  }): Promise<ProviderAgentOutput> {
    try {
      const parsed = (await this.requestJson({
        systemInstruction:
          "Return strict JSON with keys: summary (string), logs (array of short strings).",
        userContent: JSON.stringify({
          agent: input.agent,
          objective: input.request.objective,
          plan_step: input.request.plan_step,
          constraints: input.request.constraints,
        }),
      })) as Partial<ProviderAgentOutput>;

      if (!parsed.summary || !Array.isArray(parsed.logs)) {
        throw new Error("OpenAI agent response missing required output fields");
      }

      return {
        summary: parsed.summary,
        logs: parsed.logs.map((item) => String(item)),
      };
    } catch (error) {
      if (!this.fallbackToLocal) {
        throw error;
      }
      return this.localFallback.agentOutput(input);
    }
  }

  private async requestJson(input: {
    systemInstruction: string;
    userContent: string;
  }): Promise<unknown> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.fetchWithTimeout(input);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`OpenAI request failed: ${response.status} ${body}`);
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error("OpenAI response missing message content");
        }
        return JSON.parse(content) as unknown;
      } catch (error) {
        lastError = error;
        if (attempt === this.maxRetries) {
          break;
        }
        await this.sleep(200 * (attempt + 1));
      }
      attempt += 1;
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("OpenAI request failed after retries");
  }

  private async fetchWithTimeout(input: {
    systemInstruction: string;
    userContent: string;
  }): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      return await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.options.apiKey}`,
          ...(this.options.extraHeaders ?? {}),
        },
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: input.systemInstruction,
            },
            {
              role: "user",
              content: input.userContent,
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function createModelProvider(
  mode = process.env.MODEL_PROVIDER ?? "local",
): ModelProvider {
  if (mode === "local") {
    return new LocalHeuristicModelProvider();
  }

  if (mode === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("MODEL_PROVIDER=openai requires OPENAI_API_KEY");
    }

    return new OpenAIModelProvider({
      apiKey,
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      providerName: "openai-model-provider",
      timeoutMs: Number(process.env.MODEL_TIMEOUT_MS ?? "8000"),
      maxRetries: Number(process.env.MODEL_MAX_RETRIES ?? "1"),
      fallbackToLocal: (process.env.MODEL_FALLBACK_TO_LOCAL ?? "true") !== "false",
    });
  }

  if (mode === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "MODEL_PROVIDER=openrouter requires OPENROUTER_API_KEY (or OPENAI_API_KEY)",
      );
    }

    return new OpenAIModelProvider({
      apiKey,
      model:
        process.env.OPENROUTER_MODEL ??
        process.env.OPENAI_MODEL ??
        "openai/gpt-4.1-mini",
      baseUrl:
        process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      providerName: "openrouter-model-provider",
      extraHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://localhost",
        "X-Title":
          process.env.OPENROUTER_APP_NAME ?? "openclaw-local-agent-mvp",
      },
      timeoutMs: Number(process.env.MODEL_TIMEOUT_MS ?? "8000"),
      maxRetries: Number(process.env.MODEL_MAX_RETRIES ?? "1"),
      fallbackToLocal: (process.env.MODEL_FALLBACK_TO_LOCAL ?? "true") !== "false",
    });
  }

  throw new Error(
    `Unsupported MODEL_PROVIDER=${mode}. Supported providers: local, openai, openrouter.`,
  );
}
