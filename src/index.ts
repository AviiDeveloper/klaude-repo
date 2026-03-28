import { randomUUID } from "node:crypto";
import { CodeAgent } from "./agents/codeAgent.js";
import { OpsAgent } from "./agents/opsAgent.js";
import { CallerModel } from "./caller/callerModel.js";
import { InMemoryEventBus } from "./events/bus.js";
import { InterfaceController } from "./interface/controller.js";
import { LatencyTracker } from "./metrics/latencyTracker.js";
import { createModelProvider } from "./models/provider.js";
import { MissionControlServer } from "./missionControl/server.js";
import { ClawdeckCompatStore } from "./missionControl/clawdeckCompatStore.js";
import { runLocalAdapter } from "./mock/localAdapter.js";
import { OpenClawBridgeServer } from "./openclaw/bridgeServer.js";
import { OpenClawInboundAdapter } from "./openclaw/inboundAdapter.js";
import { OpenAIRealtimeSessionBroker } from "./openclaw/realtimeSessionBroker.js";
import { OpenClawEvent } from "./openclaw/types.js";
import { Orchestrator } from "./orchestrator/orchestrator.js";
import { SQLiteTaskStore } from "./storage/sqliteTaskStore.js";
import { SQLiteTraceStore } from "./trace/sqliteTraceStore.js";
import { SQLiteSessionTranscriptStore } from "./transcript/sqliteSessionTranscriptStore.js";
import { SQLiteNotificationStore } from "./notifications/sqliteNotificationStore.js";
import { MultiAgentRuntime } from "./pipeline/agentRuntime.js";
import { registerOutreachAgents } from "./agents/outreach/index.js";
import { PipelineEngine } from "./pipeline/engine.js";
import { NoopDispatchAdapter, WebhookDispatchAdapter } from "./pipeline/postDispatch.js";
import { PipelineScheduler } from "./pipeline/scheduler.js";
import { SQLitePipelineStore } from "./pipeline/sqlitePipelineStore.js";
import { TwilioTelephonyDialer } from "./telephony/twilioDialer.js";
import { BridgeTelephonyControlClient } from "./telephony/controlClient.js";
import { MemorySystem } from "./memory/index.js";

async function main(): Promise<void> {
  const changelogChangeId =
    process.env.BUILD_CHANGE_ID ?? "2026-03-07_054_planner-auth-bootstrap-fix";
  const buildVersion = "0.1.0";
  const dbPath = process.env.DB_PATH ?? "data/mvp.sqlite";
  const bus = new InMemoryEventBus();
  const latencyTracker = new LatencyTracker();
  const modelProvider = createModelProvider();
  const taskStore = new SQLiteTaskStore(dbPath);
  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  const pipelineStore = new SQLitePipelineStore(dbPath);
  const compatStore = new ClawdeckCompatStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion,
    changelogChangeId,
  });
  const memoryDbPath = process.env.MEMORY_DB_PATH ?? "data/memory.db";
  const memorySystem = new MemorySystem({
    dbPath: memoryDbPath,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
  });

  // Subscribe memory indexer to agent completion events
  bus.subscribe("agent.completed", async (event) => {
    const payload = event.payload as { task_id?: string };
    if (payload.task_id) {
      try {
        const trace = await traceStore.read(payload.task_id);
        if (trace.final_state !== "in_progress") {
          memorySystem.indexTrace(trace);
        }
      } catch {
        // Trace may not be finalized yet — skip silently
      }
    }
  });

  const orchestrator = new Orchestrator(
    taskStore,
    bus,
    new CodeAgent(modelProvider),
    new OpsAgent(modelProvider),
    traceStore,
  );

  const controller = new InterfaceController(
    orchestrator,
    new CallerModel(modelProvider),
    changelogChangeId,
    latencyTracker,
  );

  bus.subscribe("task.created", (event) => {
    console.log("event", event.name, event.payload);
  });

  const mode = process.env.INTERFACE_MODE ?? "local";
  const realtimeSessionBroker =
    process.env.OPENAI_API_KEY && process.env.OPENAI_REALTIME_ENABLED === "true"
      ? new OpenAIRealtimeSessionBroker({
          apiKey: process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-mini",
          baseUrl: process.env.OPENAI_BASE_URL,
        })
      : undefined;
  const telephonyDialer =
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ? new TwilioTelephonyDialer({
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
        })
      : undefined;
  const telephonyPublicBaseUrl = process.env.TELEPHONY_PUBLIC_BASE_URL;
  const telephonyConversationMode =
    process.env.TELEPHONY_CONVERSATION_MODE === "stream" ? "stream" : "gather";
  const dispatchAdapters = new Map([
    [
      "tiktok",
      process.env.TIKTOK_DISPATCH_WEBHOOK
        ? new WebhookDispatchAdapter(
            "tiktok",
            process.env.TIKTOK_DISPATCH_WEBHOOK,
            process.env.POST_DISPATCH_SECRET,
          )
        : new NoopDispatchAdapter("tiktok"),
    ],
    [
      "reels",
      process.env.REELS_DISPATCH_WEBHOOK
        ? new WebhookDispatchAdapter(
            "reels",
            process.env.REELS_DISPATCH_WEBHOOK,
            process.env.POST_DISPATCH_SECRET,
          )
        : new NoopDispatchAdapter("reels"),
    ],
    [
      "shorts",
      process.env.SHORTS_DISPATCH_WEBHOOK
        ? new WebhookDispatchAdapter(
            "shorts",
            process.env.SHORTS_DISPATCH_WEBHOOK,
            process.env.POST_DISPATCH_SECRET,
          )
        : new NoopDispatchAdapter("shorts"),
    ],
  ]);
  const agentRuntime = new MultiAgentRuntime();
  registerOutreachAgents(agentRuntime);
  const pipelineEngine = new PipelineEngine(
    pipelineStore,
    agentRuntime,
    notificationStore,
    undefined,
    dispatchAdapters,
  );
  if (!pipelineStore.getDefinition("content-automation-default")) {
    pipelineEngine.createDefaultDefinition();
  }
  const pipelineScheduler = new PipelineScheduler(pipelineStore, pipelineEngine);
  const telephonyBridgeUrl =
    process.env.MISSION_CONTROL_BRIDGE_URL ??
    `http://127.0.0.1:${process.env.OPENCLAW_BRIDGE_PORT ?? "4318"}`;
  const telephonyClient = new BridgeTelephonyControlClient(telephonyBridgeUrl);

  if (mode === "local") {
    await runLocalAdapter(controller);
    return;
  }

  if (mode === "openclaw") {
    const openClaw = new OpenClawInboundAdapter(
      controller,
      transcriptStore,
      notificationStore,
    );

    const inbound: OpenClawEvent<{ text: string }> = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: "session-001",
      user_id: "user-001",
      event_type: "openclaw.message_received",
      payload: { text: "Create runtime bootstrap task" },
    };

    const result = await openClaw.handle(inbound);
    console.log("mode openclaw");
    console.log("outbound.events", result.outbound.length);
    for (const outbound of result.outbound) {
      if (
        outbound.event_type === "system.message_send" ||
        outbound.event_type === "system.voice_speak"
      ) {
        console.log("outbound", outbound.event_type, outbound.payload.text);
      } else if (outbound.event_type === "system.approval_request") {
        console.log(
          "outbound",
          outbound.event_type,
          `task=${outbound.payload.task_id}`,
        );
      } else if (
        outbound.event_type === "system.notify_user" ||
        outbound.event_type === "system.call_user"
      ) {
        console.log(
          "outbound",
          outbound.event_type,
          `reason=${outbound.payload.reason}`,
        );
      }
    }
    return;
  }

  if (mode === "openclaw-bridge") {
    const adapter = new OpenClawInboundAdapter(
      controller,
      transcriptStore,
      notificationStore,
    );
    const host = process.env.OPENCLAW_BRIDGE_HOST ?? "0.0.0.0";
    const port = Number(process.env.OPENCLAW_BRIDGE_PORT ?? "4318");
    const bridge = new OpenClawBridgeServer(
      adapter,
      transcriptStore,
      changelogChangeId,
      realtimeSessionBroker,
      telephonyDialer,
      telephonyPublicBaseUrl,
      telephonyConversationMode,
    );
    await bridge.start({ host, port });
    return;
  }

  if (mode === "mission-control") {
    const schedulerMode = process.env.SCHEDULER_MODE ?? "internal";
    if (schedulerMode === "internal") {
      pipelineScheduler.start();
      console.log("scheduler mode: internal (setInterval tick enabled)");
    } else if (schedulerMode === "openclaw-cron") {
      console.log("scheduler mode: openclaw-cron (internal tick disabled)");
    } else {
      throw new Error(
        `Unsupported SCHEDULER_MODE: ${schedulerMode}. Use "internal" or "openclaw-cron".`,
      );
    }

    // Memory system cron: daily compression + MSA weight check at 09:00
    const MEMORY_CRON_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    const runMemoryCron = async () => {
      try {
        const compResult = memorySystem.runCompression();
        if (compResult.compressed > 0 || compResult.archived > 0) {
          console.log(`[Memory] Compression: ${compResult.compressed} compressed, ${compResult.archived} archived`);
        }
      } catch (err) {
        console.error("[Memory] Compression failed:", err);
      }
      try {
        await memorySystem.checkMSAWeights();
      } catch (err) {
        console.error("[Memory] MSA weight check failed:", err);
      }
    };
    // Run once on startup then every 24 hours
    void runMemoryCron();
    setInterval(() => void runMemoryCron(), MEMORY_CRON_INTERVAL_MS);
    console.log("[Memory] Memory system active: compression + MSA monitor cron started");
    const server = new MissionControlServer(
      taskStore,
      traceStore,
      controller,
      latencyTracker,
      transcriptStore,
      notificationStore,
      realtimeSessionBroker,
      pipelineStore,
      pipelineEngine,
      telephonyClient,
      compatStore,
    );
    const host = process.env.MISSION_CONTROL_HOST ?? "127.0.0.1";
    const port = Number(process.env.MISSION_CONTROL_PORT ?? "4317");
    await server.start({ host, port });
    return;
  }

  throw new Error(`Unsupported INTERFACE_MODE: ${mode}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
