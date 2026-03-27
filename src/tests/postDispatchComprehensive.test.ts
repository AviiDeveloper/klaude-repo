import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { WebhookDispatchAdapter, NoopDispatchAdapter } from "../pipeline/postDispatch.js";

function startTestServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        port: addr.port,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

describe("WebhookDispatchAdapter", () => {
  test("dispatches successfully with valid signature", async () => {
    const secret = "test-secret-key";
    const { port, close } = await startTestServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        const sig = req.headers["x-dispatch-signature"] as string;
        const ts = req.headers["x-dispatch-timestamp"] as string;
        const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
        if (sig === expected) {
          const idemKey = req.headers["x-idempotency-key"] as string;
          const responseBody = JSON.stringify({ accepted: true, idempotency_key: idemKey });
          const ackSig = createHmac("sha256", secret).update(`${idemKey}.${responseBody}`).digest("hex");
          res.writeHead(200, {
            "content-type": "application/json",
            "x-dispatch-ack-signature": ackSig,
            "x-idempotency-key": idemKey,
          });
          res.end(responseBody);
        } else {
          res.writeHead(401);
          res.end("bad sig");
        }
      });
    });

    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, secret);
      const result = await adapter.dispatch({
        payload: { text: "Hello world" },
        idempotency_key: "idem-1",
        queue_id: "q1",
        run_id: "r1",
        attempt: 1,
      });
      assert.equal(result.success, true);
      assert.equal(result.reason_code, "DISPATCHED");
      assert.equal(result.retryable, false);
    } finally {
      await close();
    }
  });

  test("fails closed on unsafe endpoint (non-localhost http)", async () => {
    const adapter = new WebhookDispatchAdapter("reels", "http://evil.com/webhook", "secret");
    const result = await adapter.dispatch({
      payload: { text: "test" },
      idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
    });
    assert.equal(result.success, false);
    assert.equal(result.reason_code, "UNSAFE_ENDPOINT");
    assert.equal(result.retryable, false);
  });

  test("allows https endpoint", async () => {
    // HTTPS endpoint will fail with network error (no server), but shouldn't fail with UNSAFE_ENDPOINT
    const adapter = new WebhookDispatchAdapter("tiktok", "https://example.com/webhook", "secret");
    const result = await adapter.dispatch({
      payload: { text: "test" },
      idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
    });
    assert.notEqual(result.reason_code, "UNSAFE_ENDPOINT");
  });

  test("fails on missing signature secret", async () => {
    const adapter = new WebhookDispatchAdapter("reels", "http://127.0.0.1:9999/webhook");
    const result = await adapter.dispatch({
      payload: { text: "test" },
      idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
    });
    assert.equal(result.success, false);
    assert.equal(result.reason_code, "MISSING_SIGNATURE_SECRET");
  });

  test("fails on non-object payload", async () => {
    const adapter = new WebhookDispatchAdapter("tiktok", "http://127.0.0.1:9999/webhook", "secret");
    const result = await adapter.dispatch({
      payload: "not an object" as any,
      idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
    });
    assert.equal(result.success, false);
    assert.equal(result.reason_code, "INVALID_PAYLOAD");
  });

  test("handles webhook timeout", async () => {
    const { port, close } = await startTestServer((_req, _res) => {
      // Never respond — will timeout
    });
    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, "secret", 500);
      const result = await adapter.dispatch({
        payload: { text: "test" },
        idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
      });
      assert.equal(result.success, false);
      assert.equal(result.reason_code, "WEBHOOK_TIMEOUT");
      assert.equal(result.retryable, true);
    } finally {
      await close();
    }
  });

  test("handles HTTP 429 as retryable", async () => {
    const { port, close } = await startTestServer((_req, res) => {
      res.writeHead(429);
      res.end("rate limited");
    });
    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, "secret");
      const result = await adapter.dispatch({
        payload: { text: "test" },
        idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
      });
      assert.equal(result.success, false);
      assert.equal(result.reason_code, "WEBHOOK_HTTP_RETRYABLE");
      assert.equal(result.retryable, true);
      assert.equal(result.http_status, 429);
    } finally {
      await close();
    }
  });

  test("handles HTTP 500 as retryable", async () => {
    const { port, close } = await startTestServer((_req, res) => {
      res.writeHead(500);
      res.end("server error");
    });
    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, "secret");
      const result = await adapter.dispatch({
        payload: { text: "test" },
        idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
      });
      assert.equal(result.success, false);
      assert.equal(result.retryable, true);
    } finally {
      await close();
    }
  });

  test("handles HTTP 403 as non-retryable", async () => {
    const { port, close } = await startTestServer((_req, res) => {
      res.writeHead(403);
      res.end("forbidden");
    });
    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, "secret");
      const result = await adapter.dispatch({
        payload: { text: "test" },
        idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
      });
      assert.equal(result.success, false);
      assert.equal(result.reason_code, "WEBHOOK_HTTP_DENIED");
      assert.equal(result.retryable, false);
      assert.equal(result.http_status, 403);
    } finally {
      await close();
    }
  });

  test("detects invalid ACK signature", async () => {
    const secret = "test-secret";
    const { port, close } = await startTestServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        const responseBody = JSON.stringify({ accepted: true });
        res.writeHead(200, {
          "content-type": "application/json",
          "x-dispatch-ack-signature": "bad-signature-value",
        });
        res.end(responseBody);
      });
    });
    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, secret);
      const result = await adapter.dispatch({
        payload: { text: "test" },
        idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
      });
      assert.equal(result.success, false);
      assert.equal(result.reason_code, "ACK_SIGNATURE_INVALID");
    } finally {
      await close();
    }
  });

  test("detects idempotency key mismatch", async () => {
    const secret = "test-secret";
    const { port, close } = await startTestServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        const idemKey = req.headers["x-idempotency-key"] as string;
        const responseBody = JSON.stringify({ accepted: true, idempotency_key: "wrong-key" });
        const ackSig = createHmac("sha256", secret).update(`${idemKey}.${responseBody}`).digest("hex");
        res.writeHead(200, {
          "content-type": "application/json",
          "x-dispatch-ack-signature": ackSig,
        });
        res.end(responseBody);
      });
    });
    try {
      const adapter = new WebhookDispatchAdapter("tiktok", `http://127.0.0.1:${port}/webhook`, secret);
      const result = await adapter.dispatch({
        payload: { text: "test" },
        idempotency_key: "correct-key", queue_id: "q1", run_id: "r1", attempt: 1,
      });
      assert.equal(result.success, false);
      assert.equal(result.reason_code, "IDEMPOTENCY_MISMATCH");
    } finally {
      await close();
    }
  });
});

describe("NoopDispatchAdapter", () => {
  test("returns success with DISPATCHED_NOOP", async () => {
    const adapter = new NoopDispatchAdapter("shorts");
    const result = await adapter.dispatch({
      payload: { text: "test" },
      idempotency_key: "i1", queue_id: "q1", run_id: "r1", attempt: 1,
    });
    assert.equal(result.success, true);
    assert.equal(result.reason_code, "DISPATCHED_NOOP");
  });

  test("has correct platform", () => {
    const adapter = new NoopDispatchAdapter("tiktok");
    assert.equal(adapter.platform, "tiktok");
  });
});
