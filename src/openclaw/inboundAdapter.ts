import { randomUUID } from "node:crypto";
import {
  InterfaceController,
  InterfaceNotificationRequest,
} from "../interface/controller.js";
import {
  ApprovalDecisionPayload,
  MessageReceivedPayload,
  OpenClawEvent,
  SessionEndedPayload,
  SessionStartedPayload,
  VoiceTranscriptFinalPayload,
  VoiceTranscriptPartialPayload,
} from "./types.js";
import { SessionTranscriptStore } from "../transcript/sessionTranscriptStore.js";
import { NotificationStore } from "../notifications/notificationStore.js";

export interface OutboundMessage {
  event_id: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  event_type: "system.message_send";
  payload: {
    text: string;
    active_task_id?: string;
    phase?: "ack" | "progress" | "detail";
    latency_ms?: number;
  };
}

export interface OutboundApprovalRequest {
  event_id: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  event_type: "system.approval_request";
  payload: {
    task_id: string;
    side_effects: Array<{
      type: string;
      description: string;
      scope: string;
      risk_notes: string;
    }>;
    risks: string[];
    rollback_notes: string;
    decision_options: ["approve", "deny"];
  };
}

export interface OutboundVoiceSpeak {
  event_id: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  event_type: "system.voice_speak";
  payload: {
    text: string;
    phase?: "ack" | "progress" | "detail";
  };
}

export type OutboundEvent =
  | OutboundMessage
  | OutboundApprovalRequest
  | OutboundVoiceSpeak
  | OutboundNotifyUser
  | OutboundCallUser;

export interface OutboundNotifyUser {
  event_id: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  event_type: "system.notify_user";
  payload: {
    reason: InterfaceNotificationRequest["reason"];
    message: string;
    task_id?: string;
    severity: InterfaceNotificationRequest["severity"];
  };
}

export interface OutboundCallUser {
  event_id: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  event_type: "system.call_user";
  payload: {
    reason: InterfaceNotificationRequest["reason"];
    message: string;
    task_id?: string;
    severity: InterfaceNotificationRequest["severity"];
  };
}

export class OpenClawInboundAdapter {
  private readonly latestPartialBySession = new Map<string, string>();

  constructor(
    private readonly controller: InterfaceController,
    private readonly transcriptStore?: SessionTranscriptStore,
    private readonly notificationStore?: NotificationStore,
  ) {}

  async handle(
    event: OpenClawEvent,
  ): Promise<{ outbound: OutboundEvent[] }> {
    this.ensureEventFields(event);

    switch (event.event_type) {
      case "openclaw.message_received":
        return this.handleMessageReceived(this.asMessageEvent(event));
      case "openclaw.voice_transcript_partial":
        return this.handleVoiceTranscriptPartial(this.asVoicePartialEvent(event));
      case "openclaw.voice_transcript_final":
        return this.handleVoiceTranscriptFinal(this.asVoiceFinalEvent(event));
      case "openclaw.approval_decision":
        return this.handleApprovalDecision(this.asApprovalDecisionEvent(event));
      case "openclaw.session_started":
        return this.handleSessionStarted(this.asSessionStartedEvent(event));
      case "openclaw.session_ended":
        return this.handleSessionEnded(this.asSessionEndedEvent(event));
      default:
        return this.assertNever(event.event_type);
    }
  }

  private async handleMessageReceived(
    event: OpenClawEvent<MessageReceivedPayload>,
    options: { voiceOutput?: boolean; recordInput?: boolean } = {},
  ): Promise<{ outbound: OutboundEvent[] }> {
    if (options.recordInput !== false) {
      await this.appendTranscript({
        session_id: event.session_id,
        user_id: event.user_id,
        timestamp: event.timestamp,
        direction: "user",
        kind: "message",
        text: event.payload.text,
        event_type: event.event_type,
      });
    }

    const result = await this.controller.handleMessage({
      session_id: event.session_id,
      user_id: event.user_id,
      text: event.payload.text,
      source: "openclaw",
    });

    const outbound = [
      ...result.messages.map((message) =>
        this.createMessage(event, message.text, message.active_task_id, {
          phase: message.phase,
          latency_ms: message.latency_ms,
        }),
      ),
      ...(options.voiceOutput
        ? result.messages.map((message) =>
            this.createVoiceSpeak(event, message.text, message.phase),
          )
        : []),
      ...result.approvalRequests.map((approval) =>
        this.createApprovalRequest(event, approval),
      ),
      ...result.notifications.map((notification) =>
        this.createNotification(event, notification),
      ),
    ];

    await this.appendOutbound(event, outbound);
    return { outbound };
  }

  private async handleApprovalDecision(
    event: OpenClawEvent<ApprovalDecisionPayload>,
  ): Promise<{ outbound: OutboundEvent[] }> {
    await this.appendTranscript({
      session_id: event.session_id,
      user_id: event.user_id,
      timestamp: event.timestamp,
      direction: "user",
      kind: "message",
      text: `approval ${event.payload.decision} for task ${event.payload.task_id}`,
      event_type: event.event_type,
      metadata: {
        task_id: event.payload.task_id,
        approval_id: event.payload.approval_id,
      },
    });

    const result = await this.controller.handleApprovalDecision({
      session_id: event.session_id,
      user_id: event.user_id,
      task_id: event.payload.task_id,
      approval_id: event.payload.approval_id,
      decision: event.payload.decision,
    });

    const outbound: OutboundEvent[] = result.messages.map((message) =>
      this.createMessage(event, message.text, message.active_task_id, {
        phase: message.phase,
        latency_ms: message.latency_ms,
      }),
    );
    outbound.push(
      ...result.notifications.map((notification) =>
        this.createNotification(event, notification),
      ),
    );
    await this.appendOutbound(event, outbound);
    return { outbound };
  }

  private async handleVoiceTranscriptPartial(
    event: OpenClawEvent<VoiceTranscriptPartialPayload>,
  ): Promise<{ outbound: OutboundEvent[] }> {
    this.latestPartialBySession.set(event.session_id, event.payload.text);
    await this.appendTranscript({
      session_id: event.session_id,
      user_id: event.user_id,
      timestamp: event.timestamp,
      direction: "user",
      kind: "voice_partial",
      text: event.payload.text,
      event_type: event.event_type,
    });

    const outbound = [this.createMessage(event, `Voice partial: ${event.payload.text}`)];
    await this.appendOutbound(event, outbound);
    return {
      outbound,
    };
  }

  private async handleVoiceTranscriptFinal(
    event: OpenClawEvent<VoiceTranscriptFinalPayload>,
  ): Promise<{ outbound: OutboundEvent[] }> {
    this.latestPartialBySession.delete(event.session_id);
    await this.appendTranscript({
      session_id: event.session_id,
      user_id: event.user_id,
      timestamp: event.timestamp,
      direction: "user",
      kind: "voice_final",
      text: event.payload.text,
      event_type: event.event_type,
    });
    return this.handleMessageReceived({
      ...event,
      event_type: "openclaw.message_received",
      payload: { text: event.payload.text },
    }, { voiceOutput: true, recordInput: false });
  }

  private async handleSessionStarted(
    event: OpenClawEvent<SessionStartedPayload>,
  ): Promise<{ outbound: OutboundEvent[] }> {
    await this.appendTranscript({
      session_id: event.session_id,
      user_id: event.user_id,
      timestamp: event.timestamp,
      direction: "system",
      kind: "session_start",
      text: event.payload.mode === "voice" ? "session started (voice)" : "session started",
      event_type: event.event_type,
      metadata: { mode: event.payload.mode },
    });

    const text =
      event.payload.mode === "voice"
        ? "Voice session started."
        : "Session started.";
    const outbound = [this.createMessage(event, text)];
    await this.appendOutbound(event, outbound);
    return { outbound };
  }

  private async handleSessionEnded(
    event: OpenClawEvent<SessionEndedPayload>,
  ): Promise<{ outbound: OutboundEvent[] }> {
    await this.appendTranscript({
      session_id: event.session_id,
      user_id: event.user_id,
      timestamp: event.timestamp,
      direction: "system",
      kind: "session_end",
      text: event.payload.reason ?? "session ended",
      event_type: event.event_type,
      metadata: { reason: event.payload.reason },
    });

    const outbound = [this.createMessage(event, "Session ended.")];
    await this.appendOutbound(event, outbound);
    return { outbound };
  }

  private createMessage(
    event: OpenClawEvent,
    text: string,
    activeTaskId?: string,
    metadata?: { phase?: "ack" | "progress" | "detail"; latency_ms?: number },
  ): OutboundMessage {
    return {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: event.session_id,
      user_id: event.user_id,
      event_type: "system.message_send",
      payload: {
        text,
        active_task_id: activeTaskId,
        phase: metadata?.phase,
        latency_ms: metadata?.latency_ms,
      },
    };
  }

  private createApprovalRequest(
    event: OpenClawEvent,
    approval: {
      task_id: string;
      side_effects: Array<{
        type: string;
        description: string;
        scope: string;
        risk_notes: string;
      }>;
      risks: string[];
      rollback_notes: string;
      decision_options: ["approve", "deny"];
    },
  ): OutboundApprovalRequest {
    return {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: event.session_id,
      user_id: event.user_id,
      event_type: "system.approval_request",
      payload: approval,
    };
  }

  private createVoiceSpeak(
    event: OpenClawEvent,
    text: string,
    phase?: "ack" | "progress" | "detail",
  ): OutboundVoiceSpeak {
    return {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: event.session_id,
      user_id: event.user_id,
      event_type: "system.voice_speak",
      payload: {
        text,
        phase,
      },
    };
  }

  private createNotification(
    event: OpenClawEvent,
    notification: InterfaceNotificationRequest,
  ): OutboundNotifyUser | OutboundCallUser {
    const base = {
      event_id: randomUUID(),
      timestamp: new Date().toISOString(),
      session_id: event.session_id,
      user_id: event.user_id,
      payload: {
        reason: notification.reason,
        message: notification.message,
        task_id: notification.task_id,
        severity: notification.severity,
      },
    };

    if (notification.channel === "notify_user") {
      return {
        ...base,
        event_type: "system.notify_user",
      };
    }

    return {
      ...base,
      event_type: "system.call_user",
    };
  }

  private async appendOutbound(
    sourceEvent: OpenClawEvent,
    outbound: OutboundEvent[],
  ): Promise<void> {
    if (!this.transcriptStore) {
      return;
    }

    for (const event of outbound) {
      if (event.event_type === "system.message_send") {
        await this.appendTranscript({
          session_id: sourceEvent.session_id,
          user_id: sourceEvent.user_id,
          timestamp: event.timestamp,
          direction: "assistant",
          kind: "message",
          text: event.payload.text,
          event_type: event.event_type,
          metadata: {
            phase: event.payload.phase,
            active_task_id: event.payload.active_task_id,
          },
        });
      }

      if (event.event_type === "system.voice_speak") {
        await this.appendTranscript({
          session_id: sourceEvent.session_id,
          user_id: sourceEvent.user_id,
          timestamp: event.timestamp,
          direction: "assistant",
          kind: "message",
          text: event.payload.text,
          event_type: event.event_type,
          metadata: { phase: event.payload.phase },
        });
      }

      if (event.event_type === "system.notify_user" || event.event_type === "system.call_user") {
        await this.notificationStore?.append({
          event_id: event.event_id,
          created_at: event.timestamp,
          channel: event.event_type === "system.notify_user" ? "notify_user" : "call_user",
          reason: event.payload.reason,
          message: event.payload.message,
          severity: event.payload.severity,
          task_id: event.payload.task_id,
          session_id: sourceEvent.session_id,
          user_id: sourceEvent.user_id,
        });
        await this.appendTranscript({
          session_id: sourceEvent.session_id,
          user_id: sourceEvent.user_id,
          timestamp: event.timestamp,
          direction: "system",
          kind: "message",
          text: event.payload.message,
          event_type: event.event_type,
          metadata: {
            reason: event.payload.reason,
            task_id: event.payload.task_id,
            severity: event.payload.severity,
          },
        });
      }
    }
  }

  private async appendTranscript(entry: {
    session_id: string;
    user_id: string;
    timestamp: string;
    direction: "user" | "assistant" | "system";
    kind: "message" | "voice_partial" | "voice_final" | "session_start" | "session_end";
    text: string;
    event_type: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.transcriptStore?.append(entry);
  }

  private ensureEventFields(event: OpenClawEvent): void {
    if (
      !event.event_id ||
      !event.timestamp ||
      !event.session_id ||
      !event.user_id ||
      !event.payload
    ) {
      throw new Error("OpenClaw event missing required fields");
    }
  }

  private asMessageEvent(
    event: OpenClawEvent,
  ): OpenClawEvent<MessageReceivedPayload> {
    const payload = event.payload as Partial<MessageReceivedPayload>;
    if (!payload?.text || typeof payload.text !== "string") {
      throw new Error("openclaw.message_received payload requires text");
    }
    return event as OpenClawEvent<MessageReceivedPayload>;
  }

  private asApprovalDecisionEvent(
    event: OpenClawEvent,
  ): OpenClawEvent<ApprovalDecisionPayload> {
    const payload = event.payload as Partial<ApprovalDecisionPayload>;
    if (
      !payload?.task_id ||
      !payload?.approval_id ||
      (payload.decision !== "approved" && payload.decision !== "denied")
    ) {
      throw new Error(
        "openclaw.approval_decision payload requires task_id, approval_id, decision",
      );
    }
    return event as OpenClawEvent<ApprovalDecisionPayload>;
  }

  private asVoicePartialEvent(
    event: OpenClawEvent,
  ): OpenClawEvent<VoiceTranscriptPartialPayload> {
    const payload = event.payload as Partial<VoiceTranscriptPartialPayload>;
    if (!payload?.text || typeof payload.text !== "string") {
      throw new Error("openclaw.voice_transcript_partial payload requires text");
    }
    return event as OpenClawEvent<VoiceTranscriptPartialPayload>;
  }

  private asVoiceFinalEvent(
    event: OpenClawEvent,
  ): OpenClawEvent<VoiceTranscriptFinalPayload> {
    const payload = event.payload as Partial<VoiceTranscriptFinalPayload>;
    if (!payload?.text || typeof payload.text !== "string") {
      throw new Error("openclaw.voice_transcript_final payload requires text");
    }
    return event as OpenClawEvent<VoiceTranscriptFinalPayload>;
  }

  private asSessionStartedEvent(
    event: OpenClawEvent,
  ): OpenClawEvent<SessionStartedPayload> {
    const payload = event.payload as Partial<SessionStartedPayload>;
    if (
      payload.mode !== undefined &&
      payload.mode !== "voice" &&
      payload.mode !== "text"
    ) {
      throw new Error("openclaw.session_started payload mode must be voice|text");
    }
    return event as OpenClawEvent<SessionStartedPayload>;
  }

  private asSessionEndedEvent(
    event: OpenClawEvent,
  ): OpenClawEvent<SessionEndedPayload> {
    return event as OpenClawEvent<SessionEndedPayload>;
  }

  private assertNever(type: never): never {
    throw new Error(`Unsupported event type: ${String(type)}`);
  }
}
