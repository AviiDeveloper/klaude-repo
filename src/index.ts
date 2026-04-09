import { randomUUID } from "node:crypto";
import { createLogger } from "./lib/logger.js";
import { validateEnv } from "./lib/envValidator.js";
import { CodeAgent } from "./agents/codeAgent.js";
import { OpsAgent } from "./agents/opsAgent.js";
import { CallerModel } from "./caller/callerModel.js";
import { SQLiteEventBus } from "./events/sqliteBus.js";
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
import { registerOutreachAgents, registerOutreachAgentsWithRegistry } from "./agents/outreach/index.js";
import { DecisionStore } from "./learning/decisionStore.js";
import { withLearning } from "./learning/learningAgent.js";
import { PipelineEngine } from "./pipeline/engine.js";
import { NoopDispatchAdapter, WebhookDispatchAdapter } from "./pipeline/postDispatch.js";
import { PipelineScheduler } from "./pipeline/scheduler.js";
import { SQLitePipelineStore } from "./pipeline/sqlitePipelineStore.js";
import { AgentCapabilityRegistry } from "./runtime/agent-registry.js";
import { UnifiedPipelineEngine } from "./runtime/pipeline-engine.js";
import { createCritic } from "./evaluation/critic-model.js";
import { EpisodicStore } from "./memory/episodic-store.js";
import { TwilioTelephonyDialer } from "./telephony/twilioDialer.js";
import { BridgeTelephonyControlClient } from "./telephony/controlClient.js";

const log = createLogger("main");

// Track all closeable resources for graceful shutdown
const closeables: Array<{ close(): void }> = [];

async function main(): Promise<void> {
  const mode = process.env.INTERFACE_MODE ?? "local";
  validateEnv(mode);

  const changelogChangeId =
    process.env.BUILD_CHANGE_ID ?? "2026-03-07_054_planner-auth-bootstrap-fix";
  const buildVersion = "0.1.0";
  const dbPath = process.env.DB_PATH ?? "data/mvp.sqlite";

  // ── Persistent event bus ──
  const bus = new SQLiteEventBus(dbPath);
  closeables.push(bus);

  const latencyTracker = new LatencyTracker();
  const modelProvider = createModelProvider();

  // ── Storage layer ──
  const taskStore = new SQLiteTaskStore(dbPath);
  closeables.push(taskStore);
  const transcriptStore = new SQLiteSessionTranscriptStore(dbPath);
  closeables.push(transcriptStore);
  const notificationStore = new SQLiteNotificationStore(dbPath);
  closeables.push(notificationStore);
  const pipelineStore = new SQLitePipelineStore(dbPath);
  closeables.push(pipelineStore);
  const compatStore = new ClawdeckCompatStore(dbPath);
  const traceStore = new SQLiteTraceStore({
    dbPath,
    buildVersion,
    changelogChangeId,
  });
  closeables.push(traceStore);

  // ── Orchestrator ──
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
    log.info("task created", { task: event.payload });
  });

  // Replay any events from a previous interrupted run
  await bus.replayUnprocessed();

  // ── Optional integrations ──
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

  // ── Dispatch adapters ──
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

  // ── Self-learning layer ──
  const decisionStore = new DecisionStore(dbPath);
  closeables.push(decisionStore);

  // ── Agent Capability Registry (SL-MAS Foundation) ──
  const agentRegistry = new AgentCapabilityRegistry();
  registerOutreachAgentsWithRegistry(agentRegistry);

  // Wrap all registered agents with self-learning decision logging
  for (const agentId of agentRegistry.listRegistered()) {
    const cap = agentRegistry.getCapability(agentId)!;
    const original = agentRegistry.getHandler(agentId)!;
    agentRegistry.register(cap, withLearning(agentId, original, decisionStore));
  }
  log.info("agents registered with capability registry + learning", {
    agents: agentRegistry.listRegistered(),
    count: agentRegistry.listRegistered().length,
    capabilities: agentRegistry.listCapabilities().map((c) => ({
      id: c.id, caps: c.capabilities, reflection: c.reflection_enabled,
    })),
  });

  // ── Evaluation layer (SL-MAS) ──
  const criticModel = createCritic();
  const episodicStore = new EpisodicStore(dbPath);
  closeables.push(episodicStore);

  // ── Unified Pipeline Engine (SL-MAS Foundation) ──
  const unifiedEngine = new UnifiedPipelineEngine(
    pipelineStore,
    agentRegistry,
    bus,
    notificationStore,
    undefined,
    dispatchAdapters,
    undefined, // reflectionHook (legacy, replaced by criticModel)
    undefined, // strategyProvider (Strategy layer, later)
    criticModel,
    episodicStore,
  );

  // Auto-register pipeline definitions
  if (!pipelineStore.getDefinition("lead-generation-v1")) {
    unifiedEngine.createLeadGenerationDefinition();
    log.info("registered pipeline: lead-generation-v1");
  }
  if (!pipelineStore.getDefinition("site-generation-v1")) {
    unifiedEngine.createSiteGenerationDefinition();
    log.info("registered pipeline: site-generation-v1");
  }

  // Recover stale runs from previous crash
  unifiedEngine.recoverStaleRuns();

  // ── Legacy pipeline engine (for backward compat with PipelineScheduler) ──
  const agentRuntime = new MultiAgentRuntime();
  registerOutreachAgents(agentRuntime);
  for (const agentId of agentRuntime.listRegistered()) {
    const original = agentRuntime.getHandler(agentId);
    if (original) {
      agentRuntime.register(agentId, withLearning(agentId, original, decisionStore));
    }
  }
  const pipelineEngine = new PipelineEngine(
    pipelineStore,
    agentRuntime,
    notificationStore,
    undefined,
    dispatchAdapters,
  );
  pipelineEngine.recoverStaleRuns();

  const pipelineScheduler = new PipelineScheduler(pipelineStore, pipelineEngine);
  const telephonyBridgeUrl =
    process.env.MISSION_CONTROL_BRIDGE_URL ??
    `http://127.0.0.1:${process.env.OPENCLAW_BRIDGE_PORT ?? "4318"}`;
  const telephonyClient = new BridgeTelephonyControlClient(telephonyBridgeUrl);

  // ── Mode dispatch ──
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
    log.info("openclaw one-shot complete", {
      outbound_count: result.outbound.length,
    });
    for (const outbound of result.outbound) {
      if (
        outbound.event_type === "system.message_send" ||
        outbound.event_type === "system.voice_speak"
      ) {
        log.info("outbound", {
          type: outbound.event_type,
          text: outbound.payload.text,
        });
      } else if (outbound.event_type === "system.approval_request") {
        log.info("outbound", {
          type: outbound.event_type,
          task: outbound.payload.task_id,
        });
      } else if (
        outbound.event_type === "system.notify_user" ||
        outbound.event_type === "system.call_user"
      ) {
        log.info("outbound", {
          type: outbound.event_type,
          reason: outbound.payload.reason,
        });
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
      log.info("scheduler started", { mode: "internal" });
    } else if (schedulerMode === "openclaw-cron") {
      log.info("scheduler started", { mode: "openclaw-cron" });
    } else {
      throw new Error(
        `Unsupported SCHEDULER_MODE: ${schedulerMode}. Use "internal" or "openclaw-cron".`,
      );
    }
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

    // ── Graceful shutdown ──
    const shutdown = async (signal: string): Promise<void> => {
      log.info(`received ${signal}, shutting down`);
      pipelineScheduler.stop();
      await server.stop();
      for (const c of closeables) {
        try {
          c.close();
        } catch {
          // already closed
        }
      }
      log.info("shutdown complete");
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    return;
  }

  throw new Error(`Unsupported INTERFACE_MODE: ${mode}`);
}

main().catch((error) => {
  log.error("fatal startup error", { error: String(error) });
  process.exit(1);
});
