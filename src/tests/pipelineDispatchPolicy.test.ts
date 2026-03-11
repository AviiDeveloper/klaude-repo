import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { MultiAgentRuntime } from "../pipeline/agentRuntime.js";
import { PipelineEngine } from "../pipeline/engine.js";
import { WebhookDispatchAdapter } from "../pipeline/postDispatch.js";
import { SQLitePipelineStore } from "../pipeline/sqlitePipelineStore.js";

async function withHttpServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind test server");
  }
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function createEngineWithAdapter(
  dbPath: string,
  adapter?: WebhookDispatchAdapter,
): { store: SQLitePipelineStore; engine: PipelineEngine } {
  const store = new SQLitePipelineStore(dbPath);
  const adapters = new Map();
  if (adapter) {
    adapters.set("tiktok", adapter);
  }
  const engine = new PipelineEngine(store, new MultiAgentRuntime(), undefined, undefined, adapters);
  return { store, engine };
}

test("dispatch policy fails closed on unsafe endpoint", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const adapter = new WebhookDispatchAdapter("tiktok", "http://example.com/webhook", "secret");
  const { store, engine } = createEngineWithAdapter(dbPath, adapter);
  const post = store.enqueuePost({
    run_id: "run-unsafe",
    platform: "tiktok",
    status: "approved",
    payload_json: { body: "hello" },
  });

  try {
    const result = await engine.dispatchPostQueueItem({ id: post.id, approvedBy: "ops" });
    assert.equal(result.status, "dead_letter");
    assert.equal(result.reason_code, "UNSAFE_ENDPOINT");
    const updated = store.listPostQueue(10).find((item) => item.id === post.id);
    assert.equal(updated?.status, "dead_letter");
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
});

test("dispatch policy emits retry reason code for retryable webhook failures", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });
  const server = await withHttpServer((_req, res) => {
    res.statusCode = 503;
    res.end("service unavailable");
  });

  const adapter = new WebhookDispatchAdapter("tiktok", `${server.url}/webhook`, "secret");
  const { store, engine } = createEngineWithAdapter(dbPath, adapter);
  const post = store.enqueuePost({
    run_id: "run-retry",
    platform: "tiktok",
    status: "approved",
    payload_json: { body: "hello" },
  });

  try {
    const result = await engine.dispatchPostQueueItem({ id: post.id, approvedBy: "ops" });
    assert.equal(result.status, "failed");
    assert.equal(result.reason_code, "WEBHOOK_HTTP_RETRYABLE");
    assert.equal(result.retry_after_ms, 3000);
    assert.equal(result.attempts, 1);
  } finally {
    await server.close();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("dispatch policy dead-letters invalid webhook acknowledgements", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });
  const secret = "secret";
  const server = await withHttpServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const requestBody = Buffer.concat(chunks).toString("utf8");
      const idempotency = String(req.headers["x-idempotency-key"] || "");
      const responseBody = JSON.stringify({ accepted: true, idempotency_key: `${idempotency}-different` });
      const ackSig = createHmac("sha256", secret)
        .update(`${idempotency}.${responseBody}`)
        .digest("hex");
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.setHeader("x-dispatch-ack-signature", ackSig);
      assert.ok(requestBody.length > 0);
      res.end(responseBody);
    });
  });

  const adapter = new WebhookDispatchAdapter("tiktok", `${server.url}/webhook`, secret);
  const { store, engine } = createEngineWithAdapter(dbPath, adapter);
  const post = store.enqueuePost({
    run_id: "run-idempotency",
    platform: "tiktok",
    status: "approved",
    payload_json: { body: "hello" },
  });

  try {
    const result = await engine.dispatchPostQueueItem({ id: post.id, approvedBy: "ops" });
    assert.equal(result.status, "dead_letter");
    assert.equal(result.reason_code, "IDEMPOTENCY_MISMATCH");
    assert.equal(result.attempts, 1);
  } finally {
    await server.close();
    await rm(testDir, { recursive: true, force: true });
  }
});
