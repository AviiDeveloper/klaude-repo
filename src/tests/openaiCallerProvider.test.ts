import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAIModelProvider,
  createModelProvider,
} from "../models/provider.js";

test("createModelProvider openai mode requires OPENAI_API_KEY", () => {
  const previousMode = process.env.MODEL_PROVIDER;
  const previousKey = process.env.OPENAI_API_KEY;

  process.env.MODEL_PROVIDER = "openai";
  delete process.env.OPENAI_API_KEY;

  assert.throws(
    () => createModelProvider(),
    /requires OPENAI_API_KEY/,
  );

  process.env.MODEL_PROVIDER = previousMode;
  if (previousKey) {
    process.env.OPENAI_API_KEY = previousKey;
  }
});

test("createModelProvider openrouter mode requires OpenRouter or OpenAI key", () => {
  const previousMode = process.env.MODEL_PROVIDER;
  const previousOpenRouterKey = process.env.OPENROUTER_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;

  process.env.MODEL_PROVIDER = "openrouter";
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;

  assert.throws(
    () => createModelProvider(),
    /requires OPENROUTER_API_KEY/,
  );

  process.env.MODEL_PROVIDER = previousMode;
  if (previousOpenRouterKey) {
    process.env.OPENROUTER_API_KEY = previousOpenRouterKey;
  }
  if (previousOpenAIKey) {
    process.env.OPENAI_API_KEY = previousOpenAIKey;
  }
});

test("OpenAIModelProvider parses caller intent JSON", async () => {
  const provider = new OpenAIModelProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://api.openai.com/v1",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const body = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Build task",
              objective: "Build task",
              acknowledgement: "Working on it.",
            }),
          },
        },
      ],
    });

    return new Response(body, { status: 200 });
  }) as typeof fetch;

  try {
    const intent = await provider.callerIntent("build task");
    assert.equal(intent.title, "Build task");
    assert.equal(intent.objective, "Build task");
    assert.equal(intent.acknowledgement, "Working on it.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAIModelProvider parses agent output JSON", async () => {
  const provider = new OpenAIModelProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://api.openai.com/v1",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    const body = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Generated agent summary.",
              logs: ["log-a", "log-b"],
            }),
          },
        },
      ],
    });

    return new Response(body, { status: 200 });
  }) as typeof fetch;

  try {
    const output = await provider.agentOutput({
      agent: "code-agent",
      request: {
        task_id: "task-1",
        agent_name: "code-agent",
        objective: "build task",
        plan_step: "Clarify objective: build task",
        constraints: [],
        inputs: [],
      },
    });
    assert.equal(output.summary, "Generated agent summary.");
    assert.equal(output.logs.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAIModelProvider forwards extra headers (OpenRouter compatibility)", async () => {
  const provider = new OpenAIModelProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://openrouter.ai/api/v1",
    extraHeaders: {
      "HTTP-Referer": "https://localhost",
      "X-Title": "test-app",
    },
  });

  const originalFetch = globalThis.fetch;
  let capturedHeaders: Headers | undefined;
  globalThis.fetch = (async (_input, init) => {
    capturedHeaders = new Headers(init?.headers);
    const body = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Build task",
              objective: "Build task",
              acknowledgement: "Working on it.",
            }),
          },
        },
      ],
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  try {
    await provider.callerIntent("build task");
    assert.equal(capturedHeaders?.get("HTTP-Referer"), "https://localhost");
    assert.equal(capturedHeaders?.get("X-Title"), "test-app");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAIModelProvider retries and succeeds on second attempt", async () => {
  const provider = new OpenAIModelProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://api.openai.com/v1",
    maxRetries: 1,
    timeoutMs: 1000,
    fallbackToLocal: false,
  });

  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response("temporary failure", { status: 500 });
    }
    const body = JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Retry success",
              objective: "Retry success",
              acknowledgement: "Recovered.",
            }),
          },
        },
      ],
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;

  try {
    const result = await provider.callerIntent("retry case");
    assert.equal(result.title, "Retry success");
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAIModelProvider falls back to local provider on timeout when enabled", async () => {
  const provider = new OpenAIModelProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://api.openai.com/v1",
    maxRetries: 0,
    timeoutMs: 5,
    fallbackToLocal: true,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_, init) => {
    const signal = init?.signal as AbortSignal | undefined;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        (e as Error & { name: string }).name = "AbortError";
        reject(e);
      });
    });
  }) as typeof fetch;

  try {
    const result = await provider.callerIntent("hello fallback");
    assert.equal(result.acknowledgement, "Understood. I am creating a task and starting execution.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAIModelProvider throws on timeout when fallback disabled", async () => {
  const provider = new OpenAIModelProvider({
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://api.openai.com/v1",
    maxRetries: 0,
    timeoutMs: 5,
    fallbackToLocal: false,
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_, init) => {
    const signal = init?.signal as AbortSignal | undefined;
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        (e as Error & { name: string }).name = "AbortError";
        reject(e);
      });
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      provider.callerIntent("hello"),
      /timed out/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
