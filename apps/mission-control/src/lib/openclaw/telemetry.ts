import { randomUUID } from 'crypto';
import { run } from '@/lib/db';

interface LogInput {
  requestId: string | number;
  method: string;
  params?: Record<string, unknown>;
  status: 'ok' | 'error';
  payload?: unknown;
  errorMessage?: string;
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readPath(record: Record<string, unknown> | undefined, paths: string[][]): unknown {
  if (!record) return undefined;
  for (const path of paths) {
    let current: unknown = record;
    let ok = true;
    for (const key of path) {
      const obj = asRecord(current);
      if (!obj || !(key in obj)) {
        ok = false;
        break;
      }
      current = obj[key];
    }
    if (ok) return current;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function extractSessionKey(params?: Record<string, unknown>): string | undefined {
  return safeString(params?.sessionKey);
}

function extractSessionId(sessionKey?: string): string | undefined {
  if (!sessionKey) return undefined;
  const marker = 'agent:main:';
  if (sessionKey.startsWith(marker)) {
    const suffix = sessionKey.slice(marker.length).trim();
    return suffix.length > 0 ? suffix : undefined;
  }
  return undefined;
}

function extractUsage(payload: Record<string, unknown> | undefined): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  model?: string;
  provider?: string;
  finishReason?: string;
} {
  const usage = asRecord(readPath(payload, [['usage'], ['result', 'usage'], ['response', 'usage']]));
  const inputTokens = toNumber(
    readPath(usage, [['prompt_tokens'], ['input_tokens'], ['in_tokens'], ['total_input_tokens']]),
  );
  const outputTokens = toNumber(
    readPath(usage, [['completion_tokens'], ['output_tokens'], ['out_tokens'], ['total_output_tokens']]),
  );
  const totalTokens =
    toNumber(readPath(usage, [['total_tokens']])) ??
    (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd:
      toNumber(readPath(payload, [['cost_usd'], ['cost'], ['billing', 'cost_usd'], ['result', 'cost_usd']])) ??
      toNumber(readPath(usage, [['cost_usd'], ['cost'], ['estimated_cost_usd']])),
    model: safeString(
      readPath(payload, [['model'], ['response', 'model'], ['result', 'model'], ['completion', 'model']]),
    ),
    provider: safeString(
      readPath(payload, [['provider'], ['response', 'provider'], ['result', 'provider'], ['model_provider']]),
    ),
    finishReason: safeString(
      readPath(payload, [['finish_reason'], ['response', 'finish_reason'], ['result', 'finish_reason']]),
    ),
  };
}

export function logOpenClawRequestTelemetry(input: LogInput): void {
  try {
    const payloadRecord = asRecord(input.payload);
    const usage = extractUsage(payloadRecord);
    const sessionKey = extractSessionKey(input.params);
    const sessionId = extractSessionId(sessionKey);

    run(
      `INSERT INTO ai_request_telemetry (
        id, created_at, request_id, method, provider, model, finish_reason, status, error_message,
        session_key, session_id, input_tokens, output_tokens, total_tokens, cost_usd, request_json, response_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        new Date().toISOString(),
        String(input.requestId),
        input.method,
        usage.provider ?? null,
        usage.model ?? null,
        usage.finishReason ?? null,
        input.status,
        input.errorMessage ?? null,
        sessionKey ?? null,
        sessionId ?? null,
        usage.inputTokens ?? null,
        usage.outputTokens ?? null,
        usage.totalTokens ?? null,
        usage.costUsd ?? null,
        JSON.stringify(input.params ?? {}),
        JSON.stringify(input.payload ?? {}),
      ],
    );
  } catch (error) {
    // Telemetry must be non-blocking.
    console.error('[OpenClaw Telemetry] Failed to persist request telemetry:', error);
  }
}
