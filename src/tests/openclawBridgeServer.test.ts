import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { CallerModel } from "../caller/callerModel.js";
import { InMemoryEventBus } from "../events/bus.js";
import { InterfaceController } from "../interface/controller.js";
import { LatencyTracker } from "../metrics/latencyTracker.js";
import { createModelProvider } from "../models/provider.js";
import { OpenClawBridgeServer } from "../openclaw/bridgeServer.js";
import { OpenClawInboundAdapter } from "../openclaw/inboundAdapter.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { SQLiteTaskStore } from "../storage/sqliteTaskStore.js";
import { SQLiteTraceStore } from "../trace/sqliteTraceStore.js";
import { SQLiteSessionTranscriptStore } from "../transcript/sqliteSessionTranscriptStore.js";
import { SQLiteNotificationStore } from "../notifications/sqliteNotificationStore.js";
import { RealtimeSessionBroker } from "../openclaw/realtimeSessionBroker.js";
import { TelephonyDialer } from "../telephony/twilioDialer.js";
import { WebSocket } from "ws";

function createBridge(
  dbPath: string,
  realtimeSessionBroker?: RealtimeSessionBroker,
  telephonyDialer?: TelephonyDialer,
  telephonyPublicBaseUrl?: string,
  telephonyConversationMode?: "stream" | "gather",
): OpenClawBridgeServer {
  const provider = createModelProvider("local");
  const orchestrator = new Orchestrator(
    new SQLiteTaskStore(dbPath),
    new InMemoryEventBus(),
    new CodeAgent(provider),
    new OpsAgent(provider),
    new SQLiteTraceStore({
      dbPath,
      buildVersion: "0.1.0",
      changelogChangeId: "bridge-test",
    }),
  );

  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(provider),
    "bridge-test",
    new LatencyTracker(),
  );

  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  return new OpenClawBridgeServer(
    new OpenClawInboundAdapter(controller, transcriptStore, notificationStore),
    transcriptStore,
    "bridge-test",
    realtimeSessionBroker,
    telephonyDialer,
    telephonyPublicBaseUrl,
    telephonyConversationMode,
  );
}

test("openclaw bridge health and events endpoints work", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39000 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);

    const voiceLab = await fetch(`${base}/voice-lab`);
    assert.equal(voiceLab.status, 200);
    const voiceLabHtml = await voiceLab.text();
    assert.ok(voiceLabHtml.includes("/calls/start"));
    assert.ok(voiceLabHtml.includes("SpeechRecognition"));

    const event = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: "bridge-session",
      user_id: "bridge-user",
      event_type: "openclaw.message_received",
      payload: { text: "hello" },
    };

    const eventRes = await fetch(`${base}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    assert.equal(eventRes.status, 200);
    const json = (await eventRes.json()) as {
      outbound: Array<{ event_type: string }>;
    };
    assert.ok(json.outbound.length >= 1);
    assert.ok(json.outbound.some((item) => item.event_type === "system.message_send"));

    const startRes = await fetch(`${base}/sessions/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: "bridge-session",
        user_id: "bridge-user",
        mode: "voice",
      }),
    });
    assert.equal(startRes.status, 200);
    const startJson = (await startRes.json()) as {
      outbound: Array<{ event_type: string }>;
    };
    assert.ok(startJson.outbound.every((item) => item.event_type !== "system.voice_speak"));

    const sessionsRes = await fetch(`${base}/sessions`);
    assert.equal(sessionsRes.status, 200);
    const sessionsJson = (await sessionsRes.json()) as {
      sessions: Array<{ session_id: string; changelog_change_id?: string }>;
    };
    assert.ok(sessionsJson.sessions.some((s) => s.session_id === "bridge-session"));
    assert.ok(
      sessionsJson.sessions.some(
        (s) => s.session_id === "bridge-session" && s.changelog_change_id === "bridge-test",
      ),
    );

    const transcriptRes = await fetch(`${base}/sessions/bridge-session/transcript`);
    assert.equal(transcriptRes.status, 200);
    const transcriptJson = (await transcriptRes.json()) as {
      transcript: Array<{ direction: string; text: string }>;
    };
    assert.ok(transcriptJson.transcript.some((entry) => entry.direction === "user"));
    assert.ok(transcriptJson.transcript.some((entry) => entry.direction === "assistant"));

    const endRes = await fetch(`${base}/sessions/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session_id: "bridge-session", reason: "test-complete" }),
    });
    assert.equal(endRes.status, 200);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("openclaw bridge rejects invalid event payload", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39500 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const eventRes = await fetch(`${base}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invalid: true }),
    });
    assert.equal(eventRes.status, 500);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("openclaw bridge realtime session endpoint works with broker", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath, {
    async createSession() {
      return {
        id: "rt-session-1",
        model: "gpt-realtime-mini",
        voice: "alloy",
        expires_at: 1234567,
        client_secret: { value: "secret-abc", expires_at: 1234567 },
        raw: {},
      };
    },
  });
  const port = 39580 + Math.floor(Math.random() * 200);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });
    const res = await fetch(`${base}/realtime/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voice: "alloy" }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      realtime_session?: { model?: string; client_secret?: { value: string } };
    };
    assert.equal(json.realtime_session?.model, "gpt-realtime-mini");
    assert.equal(json.realtime_session?.client_secret?.value, "secret-abc");
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("openclaw bridge realtime session endpoint returns 503 when unavailable", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39590 + Math.floor(Math.random() * 200);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });
    const res = await fetch(`${base}/realtime/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 503);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("openclaw voice call endpoints run start-partial-final-end loop", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39600 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const startRes = await fetch(`${base}/calls/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ call_id: "call-001", user_id: "voice-user" }),
    });
    assert.equal(startRes.status, 200);
    const startJson = (await startRes.json()) as {
      session_id: string;
      outbound: Array<{ event_type: string }>;
    };
    assert.equal(startJson.session_id, "call-001");
    assert.ok(startJson.outbound.every((event) => event.event_type !== "system.voice_speak"));

    const partialRes = await fetch(`${base}/calls/call-001/partial`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "build" }),
    });
    assert.equal(partialRes.status, 200);
    const partialJson = (await partialRes.json()) as {
      outbound: Array<{ event_type: string }>;
    };
    assert.ok(partialJson.outbound.some((event) => event.event_type === "system.message_send"));

    const finalRes = await fetch(`${base}/calls/call-001/final`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "build me a deployment plan" }),
    });
    assert.equal(finalRes.status, 200);
    const finalJson = (await finalRes.json()) as {
      outbound: Array<{ event_type: string }>;
    };
    assert.ok(finalJson.outbound.some((event) => event.event_type === "system.voice_speak"));

    const endRes = await fetch(`${base}/calls/call-001/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "hangup" }),
    });
    assert.equal(endRes.status, 200);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("voice call barge-in interrupts stale turn output", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39700 + Math.floor(Math.random() * 200);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const startRes = await fetch(`${base}/calls/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ call_id: "call-barge", user_id: "voice-user" }),
    });
    assert.equal(startRes.status, 200);

    const slowTurnPromise = fetch(`${base}/calls/call-barge/final`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "run a slow heavy planning task" }),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));

    const interruptRes = await fetch(`${base}/calls/call-barge/interrupt`, {
      method: "POST",
    });
    assert.equal(interruptRes.status, 200);
    const interruptJson = (await interruptRes.json()) as {
      interrupted: boolean;
      turn_id?: number;
    };
    assert.equal(interruptJson.interrupted, true);
    assert.equal(typeof interruptJson.turn_id, "number");

    const fastTurnRes = await fetch(`${base}/calls/call-barge/final`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    assert.equal(fastTurnRes.status, 200);
    const fastTurnJson = (await fastTurnRes.json()) as {
      interrupted?: boolean;
      outbound: Array<{ event_type: string }>;
    };
    assert.equal(fastTurnJson.interrupted, false);
    assert.ok(fastTurnJson.outbound.some((event) => event.event_type === "system.voice_speak"));

    const slowTurnRes = await slowTurnPromise;
    assert.equal(slowTurnRes.status, 200);
    const slowTurnJson = (await slowTurnRes.json()) as {
      interrupted?: boolean;
      outbound: Array<{ event_type: string }>;
    };
    assert.equal(slowTurnJson.interrupted, true);
    assert.equal(slowTurnJson.outbound.length, 0);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("voice final retry with same client_turn_id returns cached response", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39800 + Math.floor(Math.random() * 150);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const startRes = await fetch(`${base}/calls/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ call_id: "call-retry", user_id: "voice-user" }),
    });
    assert.equal(startRes.status, 200);

    const payload = {
      text: "hello",
      client_turn_id: "client-turn-1",
    };

    const firstRes = await fetch(`${base}/calls/call-retry/final`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(firstRes.status, 200);
    const firstJson = (await firstRes.json()) as {
      turn_id: number;
      retry: boolean;
      outbound: Array<{ event_type: string }>;
    };
    assert.equal(firstJson.retry, false);
    assert.ok(firstJson.outbound.some((event) => event.event_type === "system.voice_speak"));

    const secondRes = await fetch(`${base}/calls/call-retry/final`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(secondRes.status, 200);
    const secondJson = (await secondRes.json()) as {
      turn_id: number;
      retry: boolean;
      outbound: Array<{ event_type: string }>;
    };
    assert.equal(secondJson.retry, true);
    assert.equal(secondJson.turn_id, firstJson.turn_id);
    assert.deepEqual(secondJson.outbound, firstJson.outbound);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("telephony call and twilio voice webhook endpoints work", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(
    dbPath,
    undefined,
    {
      async placeOutboundCall(input) {
        return {
          provider: "twilio",
          call_sid: "CA1234567890",
          status: "queued",
          to: input.to,
          from: input.from,
        };
      },
    },
    "https://example.test",
    "stream",
  );
  const port = 39910 + Math.floor(Math.random() * 120);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const callRes = await fetch(`${base}/telephony/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: "+15550001111",
        from: "+15550002222",
        session_id: "phone-session-1",
      }),
    });
    assert.equal(callRes.status, 200);
    const callJson = (await callRes.json()) as {
      session_id: string;
      telephony_call: { call_sid: string; provider: string };
    };
    assert.equal(callJson.session_id, "phone-session-1");
    assert.equal(callJson.telephony_call.call_sid, "CA1234567890");

    const voiceRes = await fetch(
      `${base}/twilio/voice?session_id=phone-session-1&call_id=abc`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "CallSid=CA1234567890&CallStatus=in-progress",
      },
    );
    assert.equal(voiceRes.status, 200);
    const twiml = await voiceRes.text();
    assert.ok(twiml.includes("<Response>"));
    assert.ok(twiml.includes("<Stream url=\"wss://example.test/twilio/media?session_id=phone-session-1&amp;call_sid=CA1234567890\""));
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("twilio gather webhook can hold a turn-based conversation loop", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath, undefined, undefined, "https://example.test", "gather");
  const port = 39970 + Math.floor(Math.random() * 100);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const voiceRes = await fetch(
      `${base}/twilio/voice?session_id=phone-gather-1&call_id=abc`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "CallSid=CA999&CallStatus=in-progress",
      },
    );
    assert.equal(voiceRes.status, 200);
    const voiceTwiml = await voiceRes.text();
    assert.ok(voiceTwiml.includes("<Gather"));
    assert.ok(voiceTwiml.includes("/twilio/gather?session_id=phone-gather-1"));

    const gatherRes = await fetch(
      `${base}/twilio/gather?session_id=phone-gather-1&call_sid=CA999`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "SpeechResult=hello there",
      },
    );
    assert.equal(gatherRes.status, 200);
    const gatherTwiml = await gatherRes.text();
    assert.ok(gatherTwiml.includes("<Gather"));
    assert.ok(gatherTwiml.includes("<Say"));
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("telephony call endpoint returns 503 when dialer unavailable", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 39940 + Math.floor(Math.random() * 120);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });
    const callRes = await fetch(`${base}/telephony/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "+15550001111", from: "+15550002222" }),
    });
    assert.equal(callRes.status, 503);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("twilio media websocket records stream session metrics", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "bridge.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const server = createBridge(dbPath);
  const port = 40080 + Math.floor(Math.random() * 100);
  const base = `http://127.0.0.1:${port}`;
  const wsBase = `ws://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const ws = new WebSocket(
      `${wsBase}/twilio/media?session_id=phone-media-1&call_sid=CA555`,
    );
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", (error: Error) => reject(error));
    });

    ws.send(
      JSON.stringify({
        event: "start",
        start: { callSid: "CA555", streamSid: "MZ123" },
      }),
    );
    ws.send(
      JSON.stringify({
        event: "media",
        media: { payload: Buffer.from("hello").toString("base64") },
      }),
    );
    ws.send(JSON.stringify({ event: "stop" }));
    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const sessionsRes = await fetch(`${base}/telephony/media/sessions`);
    assert.equal(sessionsRes.status, 200);
    const sessionsJson = (await sessionsRes.json()) as {
      media_sessions: Array<{
        session_id: string;
        call_sid?: string;
        stream_sid?: string;
        status: string;
        frames_in: number;
        bytes_in: number;
      }>;
    };
    const mediaSession = sessionsJson.media_sessions.find(
      (entry) => entry.session_id === "phone-media-1",
    );
    assert.ok(mediaSession);
    assert.equal(mediaSession.call_sid, "CA555");
    assert.equal(mediaSession.stream_sid, "MZ123");
    assert.equal(mediaSession.status, "disconnected");
    assert.equal(mediaSession.frames_in, 1);
    assert.equal(mediaSession.bytes_in, 5);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});
