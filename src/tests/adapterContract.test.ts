import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { CodeAgent } from "../agents/codeAgent.js";
import { OpsAgent } from "../agents/opsAgent.js";
import { CallerModel } from "../caller/callerModel.js";
import { InMemoryEventBus } from "../events/bus.js";
import { InterfaceController } from "../interface/controller.js";
import { LatencyTracker } from "../metrics/latencyTracker.js";
import {
  OpenClawInboundAdapter,
  OutboundApprovalRequest,
  OutboundCallUser,
  OutboundMessage,
  OutboundNotifyUser,
  OutboundVoiceSpeak,
} from "../openclaw/inboundAdapter.js";
import { OpenClawEvent } from "../openclaw/types.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { InMemoryTaskStore } from "../storage/taskStore.js";
import { FileTraceStore } from "../trace/traceStore.js";

function createAdapter(tracesDir: string): OpenClawInboundAdapter {
  const orchestrator = new Orchestrator(
    new InMemoryTaskStore(),
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    new FileTraceStore({
      tracesDir,
      buildVersion: "0.1.0",
      changelogChangeId: "test-contract",
    }),
  );

  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(),
    "test-contract",
    new LatencyTracker(),
  );

  return new OpenClawInboundAdapter(controller);
}

function isMessageEvent(
  outbound: { event_type: string },
): outbound is OutboundMessage {
  return outbound.event_type === "system.message_send";
}

function isApprovalEvent(
  outbound: { event_type: string },
): outbound is OutboundApprovalRequest {
  return outbound.event_type === "system.approval_request";
}

function isVoiceSpeakEvent(
  outbound: { event_type: string },
): outbound is OutboundVoiceSpeak {
  return outbound.event_type === "system.voice_speak";
}

function isNotifyEvent(
  outbound: { event_type: string },
): outbound is OutboundNotifyUser {
  return outbound.event_type === "system.notify_user";
}

function isCallEvent(
  outbound: { event_type: string },
): outbound is OutboundCallUser {
  return outbound.event_type === "system.call_user";
}

test("openclaw message_received creates outbound messages", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "Build me a task" },
  };

  const result = await adapter.handle(event);

  assert.equal(result.outbound.length, 2);
  const messageEvents = result.outbound.filter(isMessageEvent);
  assert.equal(messageEvents.length, 2);
  assert.match(messageEvents[0].payload.text, /Task ID:/);
  assert.equal(messageEvents[0].payload.phase, "ack");
  assert.ok(typeof messageEvents[0].payload.latency_ms === "number");
  assert.equal(
    messageEvents[1].payload.text,
    "Execution completed for your request.",
  );
  assert.equal(messageEvents[1].payload.phase, "detail");

  await rm(tracesDir, { recursive: true, force: true });
});

test("openclaw message_received requires text payload", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<Record<string, never>> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: {},
  };

  await assert.rejects(adapter.handle(event), /payload requires text/);

  await rm(tracesDir, { recursive: true, force: true });
});

test("openclaw emits approval_request when side effects need approval", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "deploy service with shell command" },
  };

  const result = await adapter.handle(event);
  assert.ok(
    result.outbound.some((outbound) => outbound.event_type === "system.approval_request"),
  );
  assert.ok(
    result.outbound.some(
      (outbound) =>
        outbound.event_type === "system.message_send" &&
        outbound.payload.text.includes("awaiting approval"),
    ),
  );

  await rm(tracesDir, { recursive: true, force: true });
});

test("openclaw approval_decision approved resumes task", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const triggerEvent: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "deploy service with shell command" },
  };

  const triggerResult = await adapter.handle(triggerEvent);
  const approvalEvent = triggerResult.outbound.find(isApprovalEvent);
  assert.ok(approvalEvent);

  const resolveEvent: OpenClawEvent<{
    task_id: string;
    decision: "approved";
    approval_id: string;
  }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.approval_decision",
    payload: {
      task_id: approvalEvent.payload.task_id,
      decision: "approved",
      approval_id: "approval-123",
    },
  };

  const resolved = await adapter.handle(resolveEvent);
  const resolvedMessages = resolved.outbound.filter(isMessageEvent);
  assert.ok(
    resolvedMessages.some((message) =>
      message.payload.text.includes("Approval accepted"),
    ),
  );

  await rm(tracesDir, { recursive: true, force: true });
});

test("openclaw approval_decision denied emits blocked notification", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const triggerEvent: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "deploy service with shell command" },
  };

  const triggerResult = await adapter.handle(triggerEvent);
  const approvalEvent = triggerResult.outbound.find(isApprovalEvent);
  assert.ok(approvalEvent);

  const resolveEvent: OpenClawEvent<{
    task_id: string;
    decision: "denied";
    approval_id: string;
  }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-test",
    user_id: "user-test",
    event_type: "openclaw.approval_decision",
    payload: {
      task_id: approvalEvent.payload.task_id,
      decision: "denied",
      approval_id: "approval-456",
    },
  };

  const resolved = await adapter.handle(resolveEvent);
  assert.ok(resolved.outbound.some(isNotifyEvent));

  await rm(tracesDir, { recursive: true, force: true });
});

test("missing input emits call_user without task creation", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "missing-input-session",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "do it" },
  };

  const result = await adapter.handle(event);
  const messages = result.outbound.filter(isMessageEvent);
  assert.equal(messages.length, 2);
  assert.ok(messages.every((message) => !message.payload.text.includes("Task ID:")));
  assert.ok(result.outbound.some(isCallEvent));

  await rm(tracesDir, { recursive: true, force: true });
});

test("voice transcript partial returns caption update without task execution", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "voice-session",
    user_id: "user-test",
    event_type: "openclaw.voice_transcript_partial",
    payload: { text: "build a deployment plan" },
  };

  const result = await adapter.handle(event);
  const messageEvents = result.outbound.filter(isMessageEvent);
  assert.equal(messageEvents.length, 1);
  assert.ok(messageEvents[0].payload.text.includes("Voice partial:"));
  assert.ok(!messageEvents[0].payload.text.includes("Task ID:"));

  await rm(tracesDir, { recursive: true, force: true });
});

test("voice transcript final routes to task execution flow", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "voice-session",
    user_id: "user-test",
    event_type: "openclaw.voice_transcript_final",
    payload: { text: "build a deployment plan" },
  };

  const result = await adapter.handle(event);
  const messageEvents = result.outbound.filter(isMessageEvent);
  assert.ok(messageEvents.some((message) => message.payload.text.includes("Task ID:")));
  const voiceEvents = result.outbound.filter(isVoiceSpeakEvent);
  assert.ok(voiceEvents.length >= 1);

  await rm(tracesDir, { recursive: true, force: true });
});

test("session_started emits message and voice_speak", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ mode: "voice" }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "session-start",
    user_id: "user-test",
    event_type: "openclaw.session_started",
    payload: { mode: "voice" },
  };

  const result = await adapter.handle(event);
  assert.ok(result.outbound.some(isMessageEvent));
  assert.ok(!result.outbound.some(isVoiceSpeakEvent));

  await rm(tracesDir, { recursive: true, force: true });
});

test("slow execution emits progress narration message", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "slow-session",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "run a slow heavy planning task" },
  };

  const result = await adapter.handle(event);
  const messageEvents = result.outbound.filter(isMessageEvent);
  assert.ok(
    messageEvents.some((message) => message.payload.phase === "progress"),
  );
  assert.ok(
    messageEvents.some((message) =>
      message.payload.text.startsWith("Progress update:"),
    ),
  );

  await rm(tracesDir, { recursive: true, force: true });
});

test("greeting input returns conversational response without task creation", async () => {
  const tracesDir = path.join(process.cwd(), "traces-test", randomUUID());
  await rm(tracesDir, { recursive: true, force: true });

  const adapter = createAdapter(tracesDir);
  const event: OpenClawEvent<{ text: string }> = {
    event_id: randomUUID(),
    timestamp: new Date().toISOString(),
    session_id: "greeting-session",
    user_id: "user-test",
    event_type: "openclaw.message_received",
    payload: { text: "hello" },
  };

  const result = await adapter.handle(event);
  const messageEvents = result.outbound.filter(isMessageEvent);
  assert.equal(messageEvents.length, 2);
  assert.ok(messageEvents[0].payload.text.includes("ready"));
  assert.ok(messageEvents[1].payload.text.includes("build next"));
  assert.ok(
    messageEvents.every((message) => !message.payload.text.includes("Task ID:")),
  );

  await rm(tracesDir, { recursive: true, force: true });
});
