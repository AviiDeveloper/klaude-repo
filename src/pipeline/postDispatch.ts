import { createHmac, timingSafeEqual } from "node:crypto";
import { PostQueueRecord } from "./types.js";

export type DispatchReasonCode =
  | "DISPATCHED"
  | "DISPATCHED_NOOP"
  | "MISSING_SIGNATURE_SECRET"
  | "UNSAFE_ENDPOINT"
  | "INVALID_PAYLOAD"
  | "WEBHOOK_TIMEOUT"
  | "WEBHOOK_NETWORK_ERROR"
  | "WEBHOOK_HTTP_RETRYABLE"
  | "WEBHOOK_HTTP_DENIED"
  | "ACK_SIGNATURE_INVALID"
  | "IDEMPOTENCY_MISMATCH"
  | "WEBHOOK_RESPONSE_INVALID";

export interface DispatchRequest {
  payload: Record<string, unknown>;
  idempotency_key: string;
  queue_id: string;
  run_id: string;
  attempt: number;
}

export interface DispatchResult {
  success: boolean;
  detail: string;
  reason_code: DispatchReasonCode;
  retryable: boolean;
  http_status?: number;
}

export interface PostDispatchAdapter {
  readonly platform: PostQueueRecord["platform"];
  dispatch(input: DispatchRequest): Promise<DispatchResult>;
}

function sign(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isSafeEndpoint(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol !== "http:") return false;
    return (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

export class WebhookDispatchAdapter implements PostDispatchAdapter {
  private readonly timeoutMs: number;

  constructor(
    readonly platform: PostQueueRecord["platform"],
    private readonly endpoint: string,
    private readonly secret?: string,
    timeoutMs = 7000,
  ) {
    this.timeoutMs = timeoutMs;
  }

  async dispatch(input: DispatchRequest): Promise<DispatchResult> {
    if (!input.payload || typeof input.payload !== "object") {
      return {
        success: false,
        detail: "payload must be an object",
        reason_code: "INVALID_PAYLOAD",
        retryable: false,
      };
    }
    if (!isSafeEndpoint(this.endpoint)) {
      return {
        success: false,
        detail: "dispatch endpoint must be https or localhost http",
        reason_code: "UNSAFE_ENDPOINT",
        retryable: false,
      };
    }
    if (!this.secret) {
      return {
        success: false,
        detail: "post dispatch secret required for signed webhook delivery",
        reason_code: "MISSING_SIGNATURE_SECRET",
        retryable: false,
      };
    }

    const timestamp = new Date().toISOString();
    const envelope = {
      platform: this.platform,
      payload: input.payload,
      meta: {
        queue_id: input.queue_id,
        run_id: input.run_id,
        attempt: input.attempt,
        idempotency_key: input.idempotency_key,
        sent_at: timestamp,
      },
    };
    const body = JSON.stringify(envelope);
    const requestSignature = sign(this.secret, `${timestamp}.${body}`);

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-platform": this.platform,
          "x-idempotency-key": input.idempotency_key,
          "x-dispatch-attempt": String(input.attempt),
          "x-dispatch-timestamp": timestamp,
          "x-dispatch-signature": requestSignature,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? "WEBHOOK_TIMEOUT"
          : "WEBHOOK_NETWORK_ERROR";
      return {
        success: false,
        detail: `webhook request failed: ${String(error)}`,
        reason_code: reason,
        retryable: true,
      };
    }

    const responseBody = await response.text();
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      return {
        success: false,
        detail: `${response.status} ${responseBody}`,
        reason_code: retryable ? "WEBHOOK_HTTP_RETRYABLE" : "WEBHOOK_HTTP_DENIED",
        retryable,
        http_status: response.status,
      };
    }

    const ackSignature = response.headers.get("x-dispatch-ack-signature");
    if (!ackSignature) {
      return {
        success: false,
        detail: "missing x-dispatch-ack-signature",
        reason_code: "ACK_SIGNATURE_INVALID",
        retryable: false,
      };
    }
    const expectedAckSignature = sign(this.secret, `${input.idempotency_key}.${responseBody}`);
    if (!constantTimeEquals(ackSignature, expectedAckSignature)) {
      return {
        success: false,
        detail: "invalid dispatch acknowledgement signature",
        reason_code: "ACK_SIGNATURE_INVALID",
        retryable: false,
      };
    }

    let bodyJson: { accepted?: boolean; idempotency_key?: string; reason_code?: string } | null = null;
    if (responseBody.trim().length > 0) {
      try {
        bodyJson = JSON.parse(responseBody) as {
          accepted?: boolean;
          idempotency_key?: string;
          reason_code?: string;
        };
      } catch {
        return {
          success: false,
          detail: "webhook response body must be valid json",
          reason_code: "WEBHOOK_RESPONSE_INVALID",
          retryable: false,
          http_status: response.status,
        };
      }
    }

    const acknowledgedIdempotency =
      response.headers.get("x-idempotency-key") || bodyJson?.idempotency_key;
    if (acknowledgedIdempotency && acknowledgedIdempotency !== input.idempotency_key) {
      return {
        success: false,
        detail: `idempotency mismatch expected=${input.idempotency_key} actual=${acknowledgedIdempotency}`,
        reason_code: "IDEMPOTENCY_MISMATCH",
        retryable: false,
        http_status: response.status,
      };
    }

    if (bodyJson?.accepted === false) {
      return {
        success: false,
        detail: bodyJson.reason_code || "webhook denied delivery",
        reason_code: "WEBHOOK_HTTP_DENIED",
        retryable: false,
        http_status: response.status,
      };
    }

    return {
      success: true,
      detail: "dispatched",
      reason_code: "DISPATCHED",
      retryable: false,
      http_status: response.status,
    };
  }
}

export class NoopDispatchAdapter implements PostDispatchAdapter {
  constructor(readonly platform: PostQueueRecord["platform"]) {}

  async dispatch(input: DispatchRequest): Promise<DispatchResult> {
    return {
      success: true,
      detail: `noop dispatch for ${this.platform} payload=${JSON.stringify(input.payload).slice(0, 80)}`,
      reason_code: "DISPATCHED_NOOP",
      retryable: false,
    };
  }
}
