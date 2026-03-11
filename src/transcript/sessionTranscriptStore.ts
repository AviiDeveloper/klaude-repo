export type SessionTranscriptDirection = "user" | "assistant" | "system";

export type SessionTranscriptKind =
  | "message"
  | "voice_partial"
  | "voice_final"
  | "session_start"
  | "session_end";

export interface SessionTranscriptEntry {
  session_id: string;
  user_id: string;
  timestamp: string;
  direction: SessionTranscriptDirection;
  kind: SessionTranscriptKind;
  text: string;
  event_type: string;
  metadata?: Record<string, unknown>;
}

export interface SessionTranscriptSession {
  session_id: string;
  user_id: string;
  last_event_at: string;
  entries_count: number;
}

export interface SessionTranscriptStore {
  append(entry: SessionTranscriptEntry): Promise<void>;
  listBySession(sessionId: string): Promise<SessionTranscriptEntry[]>;
  listSessions(): Promise<SessionTranscriptSession[]>;
}
