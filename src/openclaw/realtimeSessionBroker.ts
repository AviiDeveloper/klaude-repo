export interface RealtimeSessionRequest {
  voice?: string;
  instructions?: string;
}

export interface RealtimeSessionResponse {
  id?: string;
  client_secret?: {
    value: string;
    expires_at?: number;
  };
  model?: string;
  voice?: string;
  expires_at?: number;
  raw: Record<string, unknown>;
}

export interface RealtimeSessionBroker {
  createSession(input: RealtimeSessionRequest): Promise<RealtimeSessionResponse>;
}

export class OpenAIRealtimeSessionBroker implements RealtimeSessionBroker {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      baseUrl?: string;
    },
  ) {}

  async createSession(input: RealtimeSessionRequest): Promise<RealtimeSessionResponse> {
    const response = await fetch(
      `${this.options.baseUrl ?? "https://api.openai.com/v1"}/realtime/sessions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          voice: input.voice ?? "alloy",
          instructions:
            input.instructions ??
            "You are a concise real-time voice assistant integrated with local orchestration.",
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Realtime session create failed: ${response.status} ${body}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const clientSecret = json.client_secret as
      | { value?: unknown; expires_at?: unknown }
      | undefined;
    if (!clientSecret?.value || typeof clientSecret.value !== "string") {
      throw new Error("Realtime session missing client_secret.value");
    }

    return {
      id: typeof json.id === "string" ? json.id : undefined,
      model: typeof json.model === "string" ? json.model : this.options.model,
      voice: typeof json.voice === "string" ? json.voice : input.voice,
      expires_at:
        typeof json.expires_at === "number" ? json.expires_at : undefined,
      client_secret: {
        value: clientSecret.value,
        expires_at:
          typeof clientSecret.expires_at === "number"
            ? clientSecret.expires_at
            : undefined,
      },
      raw: json,
    };
  }
}
