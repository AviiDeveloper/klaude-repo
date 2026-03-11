export type OpenClawInboundEventType =
  | "openclaw.message_received"
  | "openclaw.voice_transcript_partial"
  | "openclaw.voice_transcript_final"
  | "openclaw.approval_decision"
  | "openclaw.session_started"
  | "openclaw.session_ended";

export interface OpenClawEvent<TPayload = unknown> {
  event_id: string;
  timestamp: string;
  session_id: string;
  user_id: string;
  event_type: OpenClawInboundEventType;
  payload: TPayload;
}

export interface MessageReceivedPayload {
  text: string;
}

export interface VoiceTranscriptPartialPayload {
  text: string;
}

export interface VoiceTranscriptFinalPayload {
  text: string;
}

export interface SessionStartedPayload {
  mode?: "voice" | "text";
}

export interface SessionEndedPayload {
  reason?: string;
}

export interface ApprovalDecisionPayload {
  task_id: string;
  decision: "approved" | "denied";
  approval_id: string;
}
