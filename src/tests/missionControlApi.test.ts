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
import { MissionControlServer } from "../missionControl/server.js";
import { ClawdeckCompatStore } from "../missionControl/clawdeckCompatStore.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { SQLiteTaskStore } from "../storage/sqliteTaskStore.js";
import { SQLiteTraceStore } from "../trace/sqliteTraceStore.js";
import { SQLiteSessionTranscriptStore } from "../transcript/sqliteSessionTranscriptStore.js";
import { SQLiteNotificationStore } from "../notifications/sqliteNotificationStore.js";
import { RealtimeSessionBroker } from "../openclaw/realtimeSessionBroker.js";
import { MultiAgentRuntime } from "../pipeline/agentRuntime.js";
import { PipelineEngine } from "../pipeline/engine.js";
import { NoopDispatchAdapter } from "../pipeline/postDispatch.js";
import { SQLitePipelineStore } from "../pipeline/sqlitePipelineStore.js";
import { TelephonyControlClient } from "../telephony/controlClient.js";

test("mission control API can run and list tasks", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "mission-control-test",
  });
  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  const orchestrator = new Orchestrator(
    taskStore,
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );
  const latencyTracker = new LatencyTracker();
  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(),
    "mission-control-test",
    latencyTracker,
  );
  const server = new MissionControlServer(
    taskStore,
    traceStore,
    controller,
    latencyTracker,
    transcriptStore,
    notificationStore,
    {
      async createSession() {
        return {
          id: "rt-mc-1",
          model: "gpt-realtime-mini",
          voice: "alloy",
          expires_at: 123456,
          client_secret: { value: "mc-secret", expires_at: 123456 },
          raw: {},
        };
      },
    } satisfies RealtimeSessionBroker,
  );
  const port = 38000 + Math.floor(Math.random() * 1000);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const runRes = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Create task from mission control" }),
    });
    assert.equal(runRes.status, 200);
    const runJson = (await runRes.json()) as {
      outbound: Array<{ phase?: string; latency_ms?: number }>;
      metrics: { ack_latency_ms: number; total_latency_ms: number };
    };
    assert.ok(runJson.outbound.some((item) => item.phase === "ack"));
    assert.ok(runJson.metrics.ack_latency_ms >= 0);

    const tasksRes = await fetch(`${base}/api/tasks`);
    assert.equal(tasksRes.status, 200);
    const tasksJson = (await tasksRes.json()) as {
      count: number;
      tasks: Array<{ id: string; status: string }>;
    };

    assert.ok(tasksJson.count >= 1);
    assert.ok(tasksJson.tasks.some((task) => task.status === "completed"));

    const metricsRes = await fetch(`${base}/api/metrics`);
    assert.equal(metricsRes.status, 200);
    const metricsJson = (await metricsRes.json()) as { count: number };
    assert.ok(metricsJson.count >= 1);

    await transcriptStore.append({
      session_id: "mc-session",
      user_id: "local-user",
      timestamp: new Date().toISOString(),
      direction: "user",
      kind: "message",
      text: "hello mission control",
      event_type: "openclaw.message_received",
    });

    const sessionsRes = await fetch(`${base}/api/sessions`);
    assert.equal(sessionsRes.status, 200);
    const sessionsJson = (await sessionsRes.json()) as {
      count: number;
      sessions: Array<{ session_id: string }>;
    };
    assert.ok(sessionsJson.count >= 1);
    assert.ok(sessionsJson.sessions.some((session) => session.session_id === "mc-session"));

    const transcriptRes = await fetch(`${base}/api/sessions/mc-session`);
    assert.equal(transcriptRes.status, 200);
    const transcriptJson = (await transcriptRes.json()) as {
      count: number;
      transcript: Array<{ text: string }>;
    };
    assert.equal(transcriptJson.count, 1);
    assert.equal(transcriptJson.transcript[0].text, "hello mission control");

    const missingRes = await fetch(`${base}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "do it", session_id: "mc-session" }),
    });
    assert.equal(missingRes.status, 200);
    const missingJson = (await missingRes.json()) as {
      notifications: Array<{ channel: string }>;
    };
    assert.ok(
      missingJson.notifications.some((item) => item.channel === "call_user"),
    );

    const notificationsRes = await fetch(`${base}/api/notifications?status=pending`);
    assert.equal(notificationsRes.status, 200);
    const notificationsJson = (await notificationsRes.json()) as {
      count: number;
      notifications: Array<{ id: string; status: string; reason: string }>;
    };
    assert.ok(notificationsJson.count >= 1);
    const first = notificationsJson.notifications[0];
    assert.equal(first.status, "pending");

    const ackRes = await fetch(`${base}/api/notifications/${first.id}/ack`, {
      method: "POST",
    });
    assert.equal(ackRes.status, 200);
    const ackJson = (await ackRes.json()) as {
      notification: { status: string };
    };
    assert.equal(ackJson.notification.status, "acknowledged");

    const realtimeRes = await fetch(`${base}/api/realtime/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voice: "alloy" }),
    });
    assert.equal(realtimeRes.status, 200);
    const realtimeJson = (await realtimeRes.json()) as {
      realtime_session: { model: string; client_secret: { value: string } };
    };
    assert.equal(realtimeJson.realtime_session.model, "gpt-realtime-mini");
    assert.equal(realtimeJson.realtime_session.client_secret.value, "mc-secret");
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("mission control realtime endpoint returns 503 when broker unavailable", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "mission-control-test",
  });
  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  const orchestrator = new Orchestrator(
    taskStore,
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );
  const latencyTracker = new LatencyTracker();
  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(),
    "mission-control-test",
    latencyTracker,
  );
  const server = new MissionControlServer(
    taskStore,
    traceStore,
    controller,
    latencyTracker,
    transcriptStore,
    notificationStore,
  );
  const port = 39050 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });
    const realtimeRes = await fetch(`${base}/api/realtime/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(realtimeRes.status, 503);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("mission control pipeline, queue, and telephony endpoints work", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "mission-control-pipeline-test",
  });
  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  const pipelineStore = new SQLitePipelineStore(dbPath);
  const dispatchAdapters = new Map([
    ["tiktok", new NoopDispatchAdapter("tiktok")],
    ["reels", new NoopDispatchAdapter("reels")],
    ["shorts", new NoopDispatchAdapter("shorts")],
  ]);
  const mcRuntime = new MultiAgentRuntime();
  // Register test-friendly outreach agents for the lead-generation pipeline
  mcRuntime.register("lead-scout-agent", async () => ({
    summary: "Scouted leads", artifacts: { leads: [{ business_name: "Test Plumber", address: "M1 1AA" }], lead_count: 1 },
  }));
  mcRuntime.register("lead-profiler-agent", async () => ({
    summary: "Profiled 1 lead", artifacts: { profiles: [{ lead_id: "test-1", business_name: "Test Plumber" }] },
  }));
  mcRuntime.register("brand-analyser-agent", async () => ({
    summary: "Analysed brand", artifacts: { analyses: [{ lead_id: "test-1", colours: {} }] },
  }));
  mcRuntime.register("lead-qualifier-agent", async () => ({
    summary: "Qualified 1 lead", artifacts: { qualified: [{ lead_id: "test-1", qualification_score: 80 }] },
  }));
  mcRuntime.register("lead-assigner-agent", async () => ({
    summary: "Assigned 1 lead", artifacts: { assignments: [{ lead_id: "test-1", assigned_to: "user-1" }] },
  }));
  const pipelineEngine = new PipelineEngine(
    pipelineStore,
    mcRuntime,
    notificationStore,
    undefined,
    dispatchAdapters,
  );
  pipelineEngine.createLeadGenerationDefinition();

  const telephonyClient: TelephonyControlClient = {
    async placeCall(input) {
      return { telephony_call: { provider: "twilio", to: input.to, status: "queued" } };
    },
    async listMediaSessions() {
      return {
        media_sessions: [{ session_id: "s-1", status: "connected", frames_in: 2 }],
      };
    },
  };

  const orchestrator = new Orchestrator(
    taskStore,
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );
  const latencyTracker = new LatencyTracker();
  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(),
    "mission-control-pipeline-test",
    latencyTracker,
  );
  const server = new MissionControlServer(
    taskStore,
    traceStore,
    controller,
    latencyTracker,
    transcriptStore,
    notificationStore,
    undefined,
    pipelineStore,
    pipelineEngine,
    telephonyClient,
  );
  const port = 39260 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const previousSchedulerMode = process.env.SCHEDULER_MODE;
  const previousCronToken = process.env.MISSION_CONTROL_CRON_TRIGGER_TOKEN;

  try {
    process.env.SCHEDULER_MODE = "openclaw-cron";
    process.env.MISSION_CONTROL_CRON_TRIGGER_TOKEN = "cron-test-token";
    await server.start({ host: "127.0.0.1", port });

    const schedulerModeRes = await fetch(`${base}/api/scheduler/mode`);
    assert.equal(schedulerModeRes.status, 200);
    const schedulerModeJson = (await schedulerModeRes.json()) as {
      mode: string;
      internal_tick_enabled: boolean;
    };
    assert.equal(schedulerModeJson.mode, "openclaw-cron");
    assert.equal(schedulerModeJson.internal_tick_enabled, false);

    const jobsRes = await fetch(`${base}/api/jobs`);
    assert.equal(jobsRes.status, 200);
    const jobsJson = (await jobsRes.json()) as { jobs: Array<{ id: string }> };
    assert.ok(jobsJson.jobs.some((job) => job.id === "lead-generation-v1"));

    const runRes = await fetch(`${base}/api/jobs/lead-generation-v1/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approval_token: "approve-paid-steps" }),
    });
    assert.equal(runRes.status, 200);
    const runJson = (await runRes.json()) as { run: { id: string } };
    assert.ok(runJson.run.id);

    const forbiddenTriggerRes = await fetch(
      `${base}/api/jobs/lead-generation-v1/trigger`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    assert.equal(forbiddenTriggerRes.status, 403);

    const triggerRes = await fetch(`${base}/api/jobs/lead-generation-v1/trigger`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mc-cron-token": "cron-test-token",
      },
      body: JSON.stringify({ approval_token: "approve-paid-steps" }),
    });
    assert.equal(triggerRes.status, 200);
    const triggerJson = (await triggerRes.json()) as {
      trigger: string;
      run: { id: string };
    };
    assert.equal(triggerJson.trigger, "scheduler");
    assert.ok(triggerJson.run.id);

    const graphRes = await fetch(
      `${base}/api/pipelines/${encodeURIComponent(runJson.run.id)}/graph`,
    );
    assert.equal(graphRes.status, 200);
    const graphJson = (await graphRes.json()) as {
      graph: Array<{ node_id: string; status: string }>;
    };
    assert.ok(graphJson.graph.length >= 5, `Expected 5+ nodes, got ${graphJson.graph.length}`);
    assert.ok(graphJson.graph.some((node) => node.status === "completed"));

    const queueRes = await fetch(`${base}/api/post-queue`);
    assert.equal(queueRes.status, 200);

    const callRes = await fetch(`${base}/api/telephony/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "+15550001111" }),
    });
    assert.equal(callRes.status, 200);
    const callJson = (await callRes.json()) as {
      telephony_call: { provider: string; status: string };
    };
    assert.equal(callJson.telephony_call.provider, "twilio");
    assert.equal(callJson.telephony_call.status, "queued");

    const mediaRes = await fetch(`${base}/api/telephony/media/sessions`);
    assert.equal(mediaRes.status, 200);
    const mediaJson = (await mediaRes.json()) as {
      media_sessions: Array<{ session_id: string }>;
    };
    assert.equal(mediaJson.media_sessions[0].session_id, "s-1");
  } finally {
    if (previousSchedulerMode === undefined) {
      delete process.env.SCHEDULER_MODE;
    } else {
      process.env.SCHEDULER_MODE = previousSchedulerMode;
    }
    if (previousCronToken === undefined) {
      delete process.env.MISSION_CONTROL_CRON_TRIGGER_TOKEN;
    } else {
      process.env.MISSION_CONTROL_CRON_TRIGGER_TOKEN = previousCronToken;
    }
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});

test("mission control exposes ClawDeck-compatible workspace/agent/task/event APIs", async () => {
  const testDir = path.join(process.cwd(), "data-test", randomUUID());
  const dbPath = path.join(testDir, "mvp.sqlite");
  await rm(testDir, { recursive: true, force: true });

  const taskStore = new SQLiteTaskStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion: "0.1.0",
    changelogChangeId: "mission-control-compat-test",
  });
  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  const orchestrator = new Orchestrator(
    taskStore,
    new InMemoryEventBus(),
    new CodeAgent(),
    new OpsAgent(),
    traceStore,
  );
  const latencyTracker = new LatencyTracker();
  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(),
    "mission-control-compat-test",
    latencyTracker,
  );
  const compatStore = new ClawdeckCompatStore(dbPath);
  const server = new MissionControlServer(
    taskStore,
    traceStore,
    controller,
    latencyTracker,
    transcriptStore,
    notificationStore,
    undefined,
    undefined,
    undefined,
    undefined,
    compatStore,
  );
  const port = 39500 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;

  try {
    await server.start({ host: "127.0.0.1", port });

    const workspaceRes = await fetch(`${base}/api/workspaces`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Creator Lab", icon: "🚀" }),
    });
    assert.equal(workspaceRes.status, 201);
    const workspace = (await workspaceRes.json()) as { id: string; slug: string };
    assert.ok(workspace.id);

    const workspacesStatsRes = await fetch(`${base}/api/workspaces?stats=true`);
    assert.equal(workspacesStatsRes.status, 200);
    const workspacesStats = (await workspacesStatsRes.json()) as Array<{
      id: string;
      taskCounts: { total: number };
      agentCount: number;
    }>;
    assert.ok(workspacesStats.some((item) => item.id === workspace.id));

    const agentRes = await fetch(`${base}/api/agents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Scout",
        role: "trend-scout-agent",
        workspace_id: workspace.id,
      }),
    });
    assert.equal(agentRes.status, 201);
    const agent = (await agentRes.json()) as { id: string };
    assert.ok(agent.id);

    const taskRes = await fetch(`${base}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Draft first content idea",
        workspace_id: workspace.id,
        assigned_agent_id: agent.id,
      }),
    });
    assert.equal(taskRes.status, 201);
    const task = (await taskRes.json()) as { id: string };
    assert.ok(task.id.startsWith("mctask_"));

    const listTasksRes = await fetch(
      `${base}/api/tasks?workspace_id=${workspace.id}&status=inbox`,
    );
    assert.equal(listTasksRes.status, 200);
    const listTasks = (await listTasksRes.json()) as Array<{ id: string }>;
    assert.ok(listTasks.some((item) => item.id === task.id));

    const patchTaskRes = await fetch(`${base}/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    assert.equal(patchTaskRes.status, 200);
    const patchTask = (await patchTaskRes.json()) as { status: string };
    assert.equal(patchTask.status, "in_progress");

    const eventsRes = await fetch(`${base}/api/events?limit=20`);
    assert.equal(eventsRes.status, 200);
    const events = (await eventsRes.json()) as Array<{ type: string; task_id?: string }>;
    assert.ok(events.some((item) => item.type === "task_created" && item.task_id === task.id));

    const openclawRes = await fetch(`${base}/api/openclaw/status`);
    assert.equal(openclawRes.status, 200);
    const openclaw = (await openclawRes.json()) as { connected: boolean };
    assert.equal(openclaw.connected, true);
  } finally {
    await server.stop();
    await rm(testDir, { recursive: true, force: true });
  }
});
