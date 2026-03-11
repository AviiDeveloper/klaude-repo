import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { OpenClawInboundAdapter, OutboundEvent } from "./inboundAdapter.js";
import { OpenClawEvent } from "./types.js";
import { SessionTranscriptStore } from "../transcript/sessionTranscriptStore.js";
import { RealtimeSessionBroker } from "./realtimeSessionBroker.js";
import {
  OutboundCallResponse,
  TelephonyDialer,
} from "../telephony/twilioDialer.js";

export interface OpenClawBridgeServerOptions {
  host: string;
  port: number;
}
type TelephonyConversationMode = "stream" | "gather";

export class OpenClawBridgeServer {
  private server?: ReturnType<typeof createServer>;
  private mediaWss?: WebSocketServer;
  private static readonly FINAL_RETRY_CACHE_LIMIT = 32;
  private readonly callState = new Map<
    string,
    {
      nextTurn: number;
      processingTurn?: number;
      interruptedTurns: Set<number>;
      finalRetryCache: Map<
        string,
        {
          session_id: string;
          turn_id: number;
          interrupted: boolean;
          outbound: OutboundEvent[];
          retry: boolean;
        }
      >;
    }
  >();
  private readonly activeSessions = new Map<
    string,
    {
      user_id: string;
      started_at: string;
      mode?: "voice" | "text";
      active_task_id?: string;
      changelog_change_id?: string;
    }
  >();
  private readonly telephonyMediaSessions = new Map<
    string,
    {
      session_id: string;
      call_sid?: string;
      stream_sid?: string;
      status: "connected" | "disconnected";
      connected_at: string;
      disconnected_at?: string;
      frames_in: number;
      bytes_in: number;
      last_event?: string;
      last_event_at?: string;
      }
  >();

  constructor(
    private readonly adapter: OpenClawInboundAdapter,
    private readonly transcriptStore?: SessionTranscriptStore,
    private readonly changelogChangeId?: string,
    private readonly realtimeSessionBroker?: RealtimeSessionBroker,
    private readonly telephonyDialer?: TelephonyDialer,
    private readonly telephonyPublicBaseUrl?: string,
    private readonly telephonyConversationMode: TelephonyConversationMode = "gather",
  ) {}

  start(options: OpenClawBridgeServerOptions): Promise<void> {
    this.server = createServer(async (req, res) => {
      try {
        await this.route(req, res);
      } catch (error) {
        this.sendJson(res, 500, { error: String(error) });
      }
    });
    this.mediaWss = new WebSocketServer({ noServer: true });
    this.mediaWss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
      this.handleTwilioMediaConnection(socket, req);
    });
    this.server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/twilio/media") {
        socket.destroy();
        return;
      }
      this.mediaWss?.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        this.mediaWss?.emit("connection", ws, req);
      });
    });

    return new Promise((resolve) => {
      this.server?.listen(options.port, options.host, () => {
        console.log(`openclaw-bridge listening at http://${options.host}:${options.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    if (!this.server) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.mediaWss?.clients.forEach((socket: WebSocket) => socket.close());
      this.mediaWss?.close();
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", "http://localhost");

    if (method === "GET" && url.pathname === "/health") {
      this.sendJson(res, 200, { status: "ok" });
      return;
    }

    if (method === "GET" && url.pathname === "/voice-lab") {
      this.sendHtml(res, this.renderVoiceLabPage());
      return;
    }

    if (method === "POST" && url.pathname === "/telephony/call") {
      if (!this.telephonyDialer || !this.telephonyPublicBaseUrl) {
        this.sendJson(res, 503, {
          error:
            "Telephony unavailable (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TELEPHONY_PUBLIC_BASE_URL).",
        });
        return;
      }
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const to = typeof body.to === "string" ? body.to : "";
      const from = typeof body.from === "string" ? body.from : process.env.TWILIO_FROM_NUMBER;
      if (!to || !from) {
        this.sendJson(res, 400, { error: "to and from are required" });
        return;
      }
      const sessionId =
        typeof body.session_id === "string"
          ? body.session_id
          : `pstn-call-${randomUUID()}`;
      const userId =
        typeof body.user_id === "string" ? body.user_id : "telephony-user";
      const callId = randomUUID();
      const voiceWebhookUrl = `${this.telephonyPublicBaseUrl.replace(/\/+$/, "")}/twilio/voice?session_id=${encodeURIComponent(sessionId)}&call_id=${encodeURIComponent(callId)}`;
      const statusWebhookUrl = `${this.telephonyPublicBaseUrl.replace(/\/+$/, "")}/twilio/status?session_id=${encodeURIComponent(sessionId)}&call_id=${encodeURIComponent(callId)}`;

      const dialed = await this.telephonyDialer.placeOutboundCall({
        to,
        from,
        voiceWebhookUrl,
        statusWebhookUrl,
      });

      this.activeSessions.set(sessionId, {
        user_id: userId,
        started_at: new Date().toISOString(),
        mode: "voice",
        changelog_change_id: this.changelogChangeId,
      });
      this.callState.set(sessionId, {
        ...this.createDefaultCallState(),
      });
      const event = this.createEvent(sessionId, userId, "openclaw.session_started", {
        mode: "voice",
      });
      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, {
        session_id: sessionId,
        outbound: result.outbound,
        telephony_call: dialed,
      });
      return;
    }

    if (method === "POST" && url.pathname === "/realtime/session") {
      if (!this.realtimeSessionBroker) {
        this.sendJson(res, 503, {
          error: "Realtime session broker unavailable (set OPENAI_API_KEY).",
        });
        return;
      }
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const session = await this.realtimeSessionBroker.createSession({
        voice: typeof body.voice === "string" ? body.voice : undefined,
        instructions:
          typeof body.instructions === "string" ? body.instructions : undefined,
      });
      this.sendJson(res, 200, {
        realtime_session: {
          id: session.id,
          model: session.model,
          voice: session.voice,
          expires_at: session.expires_at,
          client_secret: session.client_secret,
        },
      });
      return;
    }

    if (method === "POST" && url.pathname === "/twilio/voice") {
      const body = await this.readFormBody(req);
      const sessionId =
        url.searchParams.get("session_id") ??
        (typeof body.CallSid === "string" ? body.CallSid : `twilio-${randomUUID()}`);
      const callSid = typeof body.CallSid === "string" ? body.CallSid : undefined;
      await this.ensureTelephonySession(sessionId, "telephony-user");
      if (this.telephonyConversationMode === "gather") {
        this.sendXml(
          res,
          200,
          this.renderTwilioGatherPrompt({
            sessionId,
            callSid,
            prompt: "Connected. How can I help you today?",
          }),
        );
        return;
      }
      const streamUrl = this.toWebSocketUrl(
        `${this.telephonyPublicBaseUrl ?? "http://localhost:4318"}/twilio/media?session_id=${encodeURIComponent(sessionId)}${callSid ? `&call_sid=${encodeURIComponent(callSid)}` : ""}`,
      );

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Connecting your assistant.</Say><Connect><Stream url="${this.escapeXml(streamUrl)}" /></Connect></Response>`;
      this.sendXml(res, 200, twiml);
      return;
    }

    if (method === "POST" && url.pathname === "/twilio/gather") {
      const body = await this.readFormBody(req);
      const sessionId =
        url.searchParams.get("session_id") ??
        (typeof body.CallSid === "string" ? body.CallSid : `twilio-${randomUUID()}`);
      const callSid = typeof body.CallSid === "string" ? body.CallSid : undefined;
      const speech = typeof body.SpeechResult === "string" ? body.SpeechResult.trim() : "";
      const userId = this.activeSessions.get(sessionId)?.user_id ?? "telephony-user";
      await this.ensureTelephonySession(sessionId, userId);
      if (!speech) {
        this.sendXml(
          res,
          200,
          this.renderTwilioGatherPrompt({
            sessionId,
            callSid,
            prompt: "I did not catch that. Please say that again.",
          }),
        );
        return;
      }
      if (/(^|\s)(bye|goodbye|hang up|stop call)(\s|$)/i.test(speech)) {
        this.activeSessions.delete(sessionId);
        this.callState.delete(sessionId);
        const endEvent = this.createEvent(
          sessionId,
          userId,
          "openclaw.session_ended",
          { reason: "telephony-user-ended" },
        );
        const endResult = await this.adapter.handle(endEvent);
        this.trackSessionState(endEvent, endResult.outbound);
        this.sendXml(
          res,
          200,
          `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Goodbye.</Say><Hangup/></Response>`,
        );
        return;
      }
      const turnId = this.startTurn(sessionId);
      const event = this.createEvent(sessionId, userId, "openclaw.voice_transcript_final", {
        text: speech,
        source: "twilio.gather",
      });
      const result = await this.adapter.handle(event);
      const interrupted = this.isTurnInterrupted(sessionId, turnId);
      this.trackSessionState(event, result.outbound);
      this.finishTurn(sessionId, turnId);
      const assistantPrompt =
        interrupted
          ? "One moment, please continue."
          : this.pickAssistantPrompt(result.outbound) ??
            "I heard you. Please continue.";
      this.sendXml(
        res,
        200,
        this.renderTwilioGatherPrompt({
          sessionId,
          callSid,
          prompt: assistantPrompt,
        }),
      );
      return;
    }

    if (method === "POST" && url.pathname === "/twilio/status") {
      const body = await this.readFormBody(req);
      const sessionId = url.searchParams.get("session_id");
      const status = typeof body.CallStatus === "string" ? body.CallStatus : "unknown";
      if (
        sessionId &&
        ["completed", "failed", "busy", "no-answer", "canceled"].includes(status)
      ) {
        const existingUser = this.activeSessions.get(sessionId)?.user_id ?? "telephony-user";
        this.activeSessions.delete(sessionId);
        this.callState.delete(sessionId);
        const event = this.createEvent(sessionId, existingUser, "openclaw.session_ended", {
          reason: `telephony-${status}`,
        });
        const result = await this.adapter.handle(event);
        this.trackSessionState(event, result.outbound);
      }
      this.sendJson(res, 200, { status: "ok" });
      return;
    }

    if (method === "GET" && url.pathname === "/sessions") {
      this.sendJson(res, 200, {
        sessions: [...this.activeSessions.entries()].map(([session_id, value]) => ({
          session_id,
          ...value,
        })),
      });
      return;
    }

    if (method === "GET" && url.pathname === "/telephony/media/sessions") {
      this.sendJson(res, 200, {
        media_sessions: [...this.telephonyMediaSessions.values()],
      });
      return;
    }

    if (method === "GET" && this.isTranscriptPath(url.pathname)) {
      const sessionId = this.extractSessionId(url.pathname);
      const transcript = sessionId
        ? await this.transcriptStore?.listBySession(sessionId)
        : [];
      this.sendJson(res, 200, { transcript: transcript ?? [] });
      return;
    }

    if (method === "POST" && url.pathname === "/sessions/start") {
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const sessionId =
        typeof body.session_id === "string" ? body.session_id : undefined;
      const userId = typeof body.user_id === "string" ? body.user_id : "unknown-user";
      const mode =
        body.mode === "voice" || body.mode === "text" ? body.mode : "voice";
      if (!sessionId) {
        this.sendJson(res, 400, { error: "session_id required" });
        return;
      }

      this.activeSessions.set(sessionId, {
        user_id: userId,
        started_at: new Date().toISOString(),
        mode,
        changelog_change_id: this.changelogChangeId,
      });

      const event: OpenClawEvent = {
        event_id: `session-start-${sessionId}`,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        user_id: userId,
        event_type: "openclaw.session_started",
        payload: { mode },
      };

      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, { outbound: result.outbound });
      return;
    }

    if (method === "POST" && url.pathname === "/calls/start") {
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const sessionId =
        typeof body.session_id === "string"
          ? body.session_id
          : typeof body.call_id === "string"
            ? body.call_id
            : `call-${randomUUID()}`;
      const userId = typeof body.user_id === "string" ? body.user_id : "voice-user";

      this.activeSessions.set(sessionId, {
        user_id: userId,
        started_at: new Date().toISOString(),
        mode: "voice",
        changelog_change_id: this.changelogChangeId,
      });
      this.callState.set(sessionId, {
        ...this.createDefaultCallState(),
      });

      const event = this.createEvent(sessionId, userId, "openclaw.session_started", {
        mode: "voice",
      });
      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, { session_id: sessionId, outbound: result.outbound });
      return;
    }

    if (method === "POST" && url.pathname === "/sessions/end") {
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const sessionId =
        typeof body.session_id === "string" ? body.session_id : undefined;
      const reason = typeof body.reason === "string" ? body.reason : "ended";
      if (!sessionId) {
        this.sendJson(res, 400, { error: "session_id required" });
        return;
      }
      const existing = this.activeSessions.get(sessionId);
      this.activeSessions.delete(sessionId);

      const event: OpenClawEvent = {
        event_id: `session-end-${sessionId}`,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        user_id: existing?.user_id ?? "unknown-user",
        event_type: "openclaw.session_ended",
        payload: { reason },
      };

      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, { outbound: result.outbound });
      return;
    }

    if (method === "POST" && url.pathname === "/events") {
      const body = await this.readJsonBody(req);
      const event = this.asOpenClawEvent(body);
      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, { outbound: result.outbound });
      return;
    }

    if (method === "POST" && this.isCallPath(url.pathname, "partial")) {
      const callId = this.extractCallId(url.pathname, "partial");
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text : "";
      if (!callId || !text) {
        this.sendJson(res, 400, { error: "call_id and text required" });
        return;
      }
      const userId = this.activeSessions.get(callId)?.user_id ?? "voice-user";
      this.interruptActiveTurn(callId);
      const event = this.createEvent(callId, userId, "openclaw.voice_transcript_partial", {
        text,
      });
      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, { session_id: callId, outbound: result.outbound });
      return;
    }

    if (method === "POST" && this.isCallPath(url.pathname, "final")) {
      const callId = this.extractCallId(url.pathname, "final");
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const text = typeof body.text === "string" ? body.text : "";
      const clientTurnId =
        typeof body.client_turn_id === "string" ? body.client_turn_id : undefined;
      if (!callId || !text) {
        this.sendJson(res, 400, { error: "call_id and text required" });
        return;
      }
      if (clientTurnId) {
        const cached = this.callState.get(callId)?.finalRetryCache.get(clientTurnId);
        if (cached) {
          this.sendJson(res, 200, {
            ...cached,
            retry: true,
          });
          return;
        }
      }
      const userId = this.activeSessions.get(callId)?.user_id ?? "voice-user";
      const turnId = this.startTurn(callId);
      const event = this.createEvent(callId, userId, "openclaw.voice_transcript_final", {
        text,
      });
      const result = await this.adapter.handle(event);
      const interrupted = this.isTurnInterrupted(callId, turnId);
      const outbound = interrupted ? [] : result.outbound;
      this.trackSessionState(event, result.outbound);
      this.finishTurn(callId, turnId);
      const response = {
        session_id: callId,
        turn_id: turnId,
        interrupted,
        outbound,
        retry: false,
      };
      if (clientTurnId) {
        this.storeFinalRetryResponse(callId, clientTurnId, response);
      }
      this.sendJson(res, 200, response);
      return;
    }

    if (method === "POST" && this.isCallPath(url.pathname, "interrupt")) {
      const callId = this.extractCallId(url.pathname, "interrupt");
      if (!callId) {
        this.sendJson(res, 400, { error: "call_id required" });
        return;
      }
      const interruptedTurn = this.interruptActiveTurn(callId);
      this.sendJson(res, 200, {
        session_id: callId,
        interrupted: interruptedTurn !== undefined,
        turn_id: interruptedTurn,
      });
      return;
    }

    if (method === "POST" && this.isCallPath(url.pathname, "end")) {
      const callId = this.extractCallId(url.pathname, "end");
      const body = (await this.readJsonBody(req)) as Record<string, unknown>;
      const reason = typeof body.reason === "string" ? body.reason : "call-ended";
      if (!callId) {
        this.sendJson(res, 400, { error: "call_id required" });
        return;
      }
      const userId = this.activeSessions.get(callId)?.user_id ?? "voice-user";
      this.activeSessions.delete(callId);
      this.callState.delete(callId);
      const event = this.createEvent(callId, userId, "openclaw.session_ended", {
        reason,
      });
      const result = await this.adapter.handle(event);
      this.trackSessionState(event, result.outbound);
      this.sendJson(res, 200, { session_id: callId, outbound: result.outbound });
      return;
    }

    this.sendJson(res, 404, { error: "not found" });
  }

  private asOpenClawEvent(input: unknown): OpenClawEvent {
    if (!input || typeof input !== "object") {
      throw new Error("OpenClaw event body must be an object");
    }
    const candidate = input as Partial<OpenClawEvent>;
    if (
      !candidate.event_id ||
      !candidate.timestamp ||
      !candidate.session_id ||
      !candidate.user_id ||
      !candidate.event_type ||
      !candidate.payload
    ) {
      throw new Error("OpenClaw event missing required fields");
    }
    return candidate as OpenClawEvent;
  }

  private async readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    if (chunks.length === 0) {
      return {};
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(raw) as unknown;
  }

  private sendJson(
    res: ServerResponse,
    status: number,
    body: {
      outbound?: OutboundEvent[];
      status?: string;
      error?: string;
      sessions?: Array<{
        session_id: string;
        user_id: string;
        started_at: string;
        mode?: "voice" | "text";
        active_task_id?: string;
        changelog_change_id?: string;
      }>;
      transcript?: Array<{
        session_id: string;
        user_id: string;
        timestamp: string;
        direction: "user" | "assistant" | "system";
        kind: "message" | "voice_partial" | "voice_final" | "session_start" | "session_end";
        text: string;
        event_type: string;
        metadata?: Record<string, unknown>;
      }>;
      session_id?: string;
      turn_id?: number;
      interrupted?: boolean;
      retry?: boolean;
      realtime_session?: {
        id?: string;
        model?: string;
        voice?: string;
        expires_at?: number;
        client_secret?: {
          value: string;
          expires_at?: number;
        };
      };
      telephony_call?: OutboundCallResponse;
      media_sessions?: Array<{
        session_id: string;
        call_sid?: string;
        stream_sid?: string;
        status: "connected" | "disconnected";
        connected_at: string;
        disconnected_at?: string;
        frames_in: number;
        bytes_in: number;
        last_event?: string;
        last_event_at?: string;
      }>;
    },
  ): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(payload),
    });
    res.end(payload);
  }

  private sendHtml(res: ServerResponse, html: string): void {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  }

  private sendXml(res: ServerResponse, status: number, xml: string): void {
    res.writeHead(status, {
      "content-type": "application/xml; charset=utf-8",
      "content-length": Buffer.byteLength(xml),
    });
    res.end(xml);
  }

  private async readFormBody(req: IncomingMessage): Promise<Record<string, string>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    if (chunks.length === 0) {
      return {};
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    const params = new URLSearchParams(raw);
    const parsed: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      parsed[key] = value;
    }
    return parsed;
  }

  private trackSessionState(event: OpenClawEvent, outbound: OutboundEvent[]): void {
    const current = this.activeSessions.get(event.session_id);
    const firstMessage = outbound.find(
      (entry) => entry.event_type === "system.message_send",
    );
    const activeTaskId =
      firstMessage?.event_type === "system.message_send"
        ? firstMessage.payload.active_task_id
        : undefined;

    if (current) {
      this.activeSessions.set(event.session_id, {
        ...current,
        active_task_id: activeTaskId ?? current.active_task_id,
        changelog_change_id: this.changelogChangeId ?? current.changelog_change_id,
      });
      return;
    }

    this.activeSessions.set(event.session_id, {
      user_id: event.user_id,
      started_at: event.timestamp,
      active_task_id: activeTaskId,
      changelog_change_id: this.changelogChangeId,
    });
  }

  private isTranscriptPath(pathname: string): boolean {
    return pathname.startsWith("/sessions/") && pathname.endsWith("/transcript");
  }

  private extractSessionId(pathname: string): string | undefined {
    const match = pathname.match(/^\/sessions\/([^/]+)\/transcript$/);
    if (!match?.[1]) {
      return undefined;
    }
    return decodeURIComponent(match[1]);
  }

  private createEvent(
    sessionId: string,
    userId: string,
    eventType: OpenClawEvent["event_type"],
    payload: Record<string, unknown>,
  ): OpenClawEvent {
    return {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      user_id: userId,
      event_type: eventType,
      payload,
    };
  }

  private isCallPath(
    pathname: string,
    action: "partial" | "final" | "end" | "interrupt",
  ): boolean {
    return new RegExp(`^/calls/[^/]+/${action}$`).test(pathname);
  }

  private extractCallId(
    pathname: string,
    action: "partial" | "final" | "end" | "interrupt",
  ): string | undefined {
    const match = pathname.match(new RegExp(`^/calls/([^/]+)/${action}$`));
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  private startTurn(callId: string): number {
    const current = this.callState.get(callId) ?? this.createDefaultCallState();
    if (current.processingTurn !== undefined) {
      current.interruptedTurns.add(current.processingTurn);
    }
    current.nextTurn += 1;
    current.processingTurn = current.nextTurn;
    this.callState.set(callId, current);
    return current.nextTurn;
  }

  private finishTurn(callId: string, turnId: number): void {
    const current = this.callState.get(callId);
    if (!current) {
      return;
    }
    if (current.processingTurn === turnId) {
      current.processingTurn = undefined;
    }
    current.interruptedTurns.delete(turnId);
  }

  private interruptActiveTurn(callId: string): number | undefined {
    const current = this.callState.get(callId);
    if (!current?.processingTurn) {
      return undefined;
    }
    current.interruptedTurns.add(current.processingTurn);
    return current.processingTurn;
  }

  private isTurnInterrupted(callId: string, turnId: number): boolean {
    const current = this.callState.get(callId);
    if (!current) {
      return false;
    }
    return current.interruptedTurns.has(turnId) || current.processingTurn !== turnId;
  }

  private createDefaultCallState(): {
    nextTurn: number;
    processingTurn?: number;
    interruptedTurns: Set<number>;
    finalRetryCache: Map<
      string,
      {
        session_id: string;
        turn_id: number;
        interrupted: boolean;
        outbound: OutboundEvent[];
        retry: boolean;
      }
    >;
  } {
    return {
      nextTurn: 0,
      processingTurn: undefined,
      interruptedTurns: new Set<number>(),
      finalRetryCache: new Map(),
    };
  }

  private storeFinalRetryResponse(
    callId: string,
    clientTurnId: string,
    response: {
      session_id: string;
      turn_id: number;
      interrupted: boolean;
      outbound: OutboundEvent[];
      retry: boolean;
    },
  ): void {
    const call = this.callState.get(callId);
    if (!call) {
      return;
    }
    if (call.finalRetryCache.size >= OpenClawBridgeServer.FINAL_RETRY_CACHE_LIMIT) {
      const oldest = call.finalRetryCache.keys().next().value as string | undefined;
      if (oldest) {
        call.finalRetryCache.delete(oldest);
      }
    }
    call.finalRetryCache.set(clientTurnId, response);
  }

  private toWebSocketUrl(httpUrl: string): string {
    if (httpUrl.startsWith("https://")) {
      return `wss://${httpUrl.slice("https://".length)}`;
    }
    if (httpUrl.startsWith("http://")) {
      return `ws://${httpUrl.slice("http://".length)}`;
    }
    return httpUrl;
  }

  private escapeXml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  private async ensureTelephonySession(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      return;
    }
    this.activeSessions.set(sessionId, {
      user_id: userId,
      started_at: new Date().toISOString(),
      mode: "voice",
      changelog_change_id: this.changelogChangeId,
    });
    this.callState.set(sessionId, {
      ...this.createDefaultCallState(),
    });
    const event = this.createEvent(sessionId, userId, "openclaw.session_started", {
      mode: "voice",
    });
    const result = await this.adapter.handle(event);
    this.trackSessionState(event, result.outbound);
  }

  private pickAssistantPrompt(outbound: OutboundEvent[]): string | undefined {
    const voice = outbound.find(
      (entry) =>
        entry.event_type === "system.voice_speak" &&
        entry.payload.text &&
        entry.payload.phase !== "progress",
    );
    if (voice?.event_type === "system.voice_speak") {
      return voice.payload.text;
    }
    const message = outbound.find(
      (entry) => entry.event_type === "system.message_send" && entry.payload.text,
    );
    if (message?.event_type === "system.message_send") {
      return message.payload.text;
    }
    return undefined;
  }

  private renderTwilioGatherPrompt(input: {
    sessionId: string;
    callSid?: string;
    prompt: string;
  }): string {
    const actionUrl = `${this.telephonyPublicBaseUrl ?? "http://localhost:4318"}/twilio/gather?session_id=${encodeURIComponent(input.sessionId)}${input.callSid ? `&call_sid=${encodeURIComponent(input.callSid)}` : ""}`;
    const escapedPrompt = this.escapeXml(input.prompt);
    const escapedActionUrl = this.escapeXml(actionUrl);
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Gather input="speech" speechTimeout="auto" timeout="4" method="POST" action="${escapedActionUrl}"><Say voice="alice">${escapedPrompt}</Say></Gather><Redirect method="POST">${escapedActionUrl}</Redirect></Response>`;
  }

  private handleTwilioMediaConnection(socket: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? "/", "http://localhost");
    const sessionId =
      url.searchParams.get("session_id") ?? `twilio-media-${randomUUID()}`;
    const initialCallSid = url.searchParams.get("call_sid") ?? undefined;
    const mediaSession: {
      session_id: string;
      call_sid?: string;
      stream_sid?: string;
      status: "connected" | "disconnected";
      connected_at: string;
      disconnected_at?: string;
      frames_in: number;
      bytes_in: number;
      last_event?: string;
      last_event_at?: string;
    } = {
      session_id: sessionId,
      call_sid: initialCallSid,
      stream_sid: undefined,
      status: "connected",
      connected_at: new Date().toISOString(),
      frames_in: 0,
      bytes_in: 0,
      last_event: "connected",
      last_event_at: new Date().toISOString(),
    };
    this.telephonyMediaSessions.set(sessionId, mediaSession);

    socket.on("message", (data: RawData) => {
      const parsed = this.parseTwilioMediaPayload(data);
      if (!parsed) {
        return;
      }
      mediaSession.last_event = parsed.event;
      mediaSession.last_event_at = new Date().toISOString();
      if (parsed.start?.callSid) {
        mediaSession.call_sid = parsed.start.callSid;
      }
      if (parsed.start?.streamSid) {
        mediaSession.stream_sid = parsed.start.streamSid;
      }
      if (parsed.event === "media" && parsed.media?.payload) {
        mediaSession.frames_in += 1;
        mediaSession.bytes_in += this.estimateDecodedSize(parsed.media.payload);
      }
      if (parsed.event === "stop") {
        mediaSession.status = "disconnected";
        mediaSession.disconnected_at = new Date().toISOString();
      }
    });

    socket.on("close", () => {
      mediaSession.status = "disconnected";
      mediaSession.disconnected_at = new Date().toISOString();
      mediaSession.last_event = mediaSession.last_event ?? "closed";
      mediaSession.last_event_at = new Date().toISOString();
    });
  }

  private parseTwilioMediaPayload(raw: RawData): {
    event: string;
    start?: {
      callSid?: string;
      streamSid?: string;
    };
    media?: {
      payload?: string;
    };
  } | null {
    let text: string;
    if (typeof raw === "string") {
      text = raw;
    } else if (Array.isArray(raw)) {
      text = Buffer.concat(raw).toString("utf8");
    } else if (raw instanceof ArrayBuffer) {
      text = Buffer.from(raw).toString("utf8");
    } else {
      text = raw.toString("utf8");
    }
    try {
      const json = JSON.parse(text) as {
        event?: string;
        start?: { callSid?: string; streamSid?: string };
        media?: { payload?: string };
      };
      if (!json.event) {
        return null;
      }
      return {
        event: json.event,
        start: json.start,
        media: json.media,
      };
    } catch {
      return null;
    }
  }

  private estimateDecodedSize(base64Payload: string): number {
    try {
      return Buffer.from(base64Payload, "base64").length;
    } catch {
      return 0;
    }
  }

  private renderVoiceLabPage(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Voice Lab</title>
  <style>
    :root {
      --bg: #f7f3ec;
      --ink: #151515;
      --muted: #6f685d;
      --card: #fffdf9;
      --line: #d9d1c4;
      --accent: #bc4b2f;
      --accent-dark: #8f351f;
    }
    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      background: radial-gradient(circle at 10% 15%, #fff9ef, var(--bg));
      color: var(--ink);
    }
    .wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { margin: 0; font-size: 34px; }
    .sub { color: var(--muted); margin: 8px 0 16px; }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      margin-top: 14px;
    }
    .row { display: flex; gap: 10px; flex-wrap: wrap; }
    button, input {
      font: inherit;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      background: white;
    }
    button { cursor: pointer; }
    .primary {
      background: var(--accent);
      color: white;
      border-color: var(--accent-dark);
    }
    .danger {
      background: #3c312e;
      color: #fff;
      border-color: #2b201d;
    }
    #log {
      margin-top: 12px;
      max-height: 360px;
      overflow: auto;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      font-size: 13px;
      white-space: pre-wrap;
    }
    .pill {
      display: inline-block;
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 2px 8px;
      font-size: 12px;
      margin-left: 6px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Bridge Voice Lab</h1>
    <div class="sub">Local browser voice client for <code>/calls/*</code> endpoints<span id="status" class="pill">idle</span></div>

    <div class="card">
      <div class="row">
        <input id="callId" value="voice-lab-call" />
        <input id="userId" value="voice-lab-user" />
        <button id="startBtn" class="primary">Start Call</button>
        <button id="endBtn">End Call</button>
      </div>
      <div class="row" style="margin-top:10px">
        <button id="listenBtn" class="primary">Start Listening</button>
        <button id="stopBtn">Stop Listening</button>
        <button id="interruptBtn" class="danger">Interrupt</button>
        <button id="realtimeBtn">Realtime Mini Session</button>
      </div>
      <div style="margin-top:10px;color:var(--muted);font-size:13px">
        Browser support: Chrome/Edge/Safari (Web Speech API). If unavailable, use text input below.
      </div>
      <div class="row" style="margin-top:10px">
        <input id="manualInput" placeholder="Manual fallback: type a sentence and send as final transcript" style="flex:1" />
        <button id="manualSendBtn">Send Final</button>
      </div>
      <div id="log"></div>
    </div>
  </div>

<script>
const state = {
  callId: "",
  listening: false,
  recognition: null,
  speaking: false,
  restartAfterSpeech: false,
  turnSeq: 0,
};
const logEl = document.getElementById("log");
const statusEl = document.getElementById("status");
const callIdEl = document.getElementById("callId");
const userIdEl = document.getElementById("userId");
const manualInputEl = document.getElementById("manualInput");

function log(msg) {
  const line = "[" + new Date().toLocaleTimeString() + "] " + msg;
  logEl.textContent = line + "\\n" + logEl.textContent;
}

function setStatus(next) {
  statusEl.textContent = next;
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(path + " -> " + res.status + " " + text);
  }
  return res.json();
}

function speakText(text) {
  if (!("speechSynthesis" in window)) {
    log("TTS unavailable in this browser.");
    return;
  }
  if (state.recognition && state.listening) {
    state.restartAfterSpeech = true;
    try { state.recognition.stop(); } catch {}
  }
  state.speaking = true;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.onend = () => {
    state.speaking = false;
    if (state.restartAfterSpeech && state.recognition && !state.listening) {
      state.restartAfterSpeech = false;
      try { state.recognition.start(); } catch {}
    }
  };
  window.speechSynthesis.speak(utterance);
}

function handleOutbound(outbound) {
  for (const event of outbound || []) {
    if (event.event_type === "system.message_send") {
      log("assistant(text): " + event.payload.text);
    }
    if (event.event_type === "system.voice_speak") {
      log("assistant(voice): " + event.payload.text);
      if (event.payload.phase !== "progress" && !/session started/i.test(event.payload.text)) {
        speakText(event.payload.text);
      }
    }
    if (event.event_type === "system.approval_request") {
      log("approval needed for task " + event.payload.task_id);
    }
    if (event.event_type === "system.notify_user" || event.event_type === "system.call_user") {
      log(event.event_type + ": " + event.payload.message);
    }
  }
}

async function startCall() {
  const callId = callIdEl.value.trim() || "voice-lab-call";
  const userId = userIdEl.value.trim() || "voice-lab-user";
  const res = await post("/calls/start", { call_id: callId, user_id: userId });
  state.callId = res.session_id;
  setStatus("call:" + state.callId);
  log("call started " + state.callId);
  handleOutbound(res.outbound);
}

async function endCall() {
  if (!state.callId) return;
  const res = await post("/calls/" + encodeURIComponent(state.callId) + "/end", { reason: "voice-lab-end" });
  log("call ended " + state.callId);
  handleOutbound(res.outbound);
  state.callId = "";
  setStatus("idle");
}

async function sendPartial(text) {
  if (!state.callId) return;
  const res = await post("/calls/" + encodeURIComponent(state.callId) + "/partial", { text });
  handleOutbound(res.outbound);
}

async function sendFinal(text) {
  if (!state.callId) return;
  state.turnSeq += 1;
  const clientTurnId = state.callId + "-turn-" + state.turnSeq;
  const res = await post("/calls/" + encodeURIComponent(state.callId) + "/final", {
    text,
    client_turn_id: clientTurnId,
  });
  if (res.interrupted) {
    log("turn " + res.turn_id + " interrupted, output suppressed");
  }
  if (res.retry) {
    log("retried final turn response");
  }
  handleOutbound(res.outbound);
}

async function interruptCall() {
  if (!state.callId) return;
  const res = await post("/calls/" + encodeURIComponent(state.callId) + "/interrupt", {});
  log("interrupt sent (active=" + res.interrupted + ")");
}

async function requestRealtimeSession() {
  const res = await post("/realtime/session", {
    voice: "alloy",
    instructions: "Concise real-time assistant for local voice calls.",
  });
  if (!res.realtime_session || !res.realtime_session.client_secret) {
    log("realtime session unavailable");
    return;
  }
  log("realtime-mini session ready (expires_at=" + (res.realtime_session.expires_at || "n/a") + ")");
}

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function setupRecognition() {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    log("SpeechRecognition not available. Use manual text fallback.");
    return null;
  }

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onstart = () => {
    state.listening = true;
    setStatus("listening");
    log("mic listening");
  };

  rec.onerror = (event) => {
    log("recognition error: " + event.error);
  };

  rec.onend = () => {
    state.listening = false;
    if (state.callId) setStatus("call:" + state.callId);
    else setStatus("idle");
    log("mic stopped");
  };

  rec.onresult = async (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0] ? result[0].transcript.trim() : "";
      if (!text) continue;
      if (result.isFinal) {
        log("you(final): " + text);
        await sendFinal(text);
      } else {
        interim = text;
      }
    }
    if (interim) {
      log("you(partial): " + interim);
      await sendPartial(interim);
    }
  };

  return rec;
}

document.getElementById("startBtn").onclick = async () => {
  try { await startCall(); } catch (e) { log(String(e)); }
};
document.getElementById("endBtn").onclick = async () => {
  try { await endCall(); } catch (e) { log(String(e)); }
};
document.getElementById("interruptBtn").onclick = async () => {
  try { await interruptCall(); } catch (e) { log(String(e)); }
};
document.getElementById("realtimeBtn").onclick = async () => {
  try { await requestRealtimeSession(); } catch (e) { log(String(e)); }
};
document.getElementById("listenBtn").onclick = async () => {
  try {
    if (!state.callId) await startCall();
    if (!state.recognition) state.recognition = setupRecognition();
    if (state.recognition && !state.listening) state.recognition.start();
  } catch (e) {
    log(String(e));
  }
};
document.getElementById("stopBtn").onclick = () => {
  try {
    if (state.recognition && state.listening) state.recognition.stop();
  } catch (e) {
    log(String(e));
  }
};
document.getElementById("manualSendBtn").onclick = async () => {
  const text = manualInputEl.value.trim();
  if (!text) return;
  manualInputEl.value = "";
  log("you(final): " + text);
  try { await sendFinal(text); } catch (e) { log(String(e)); }
};
</script>
</body>
</html>`;
  }
}
