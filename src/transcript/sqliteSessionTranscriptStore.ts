import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  SessionTranscriptEntry,
  SessionTranscriptSession,
  SessionTranscriptStore,
} from "./sessionTranscriptStore.js";

interface SessionTranscriptRow {
  session_id: string;
  user_id: string;
  timestamp: string;
  direction: "user" | "assistant" | "system";
  kind: SessionTranscriptEntry["kind"];
  text: string;
  event_type: string;
  metadata_json: string;
}

interface SessionSummaryRow {
  session_id: string;
  user_id: string;
  last_event_at: string;
  entries_count: number;
}

export class SQLiteSessionTranscriptStore implements SessionTranscriptStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    this.createSchema();
  }

  async append(entry: SessionTranscriptEntry): Promise<void> {
    this.db
      .prepare(
        `
        INSERT INTO session_transcripts (
          session_id, user_id, timestamp, direction, kind, text, event_type, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        entry.session_id,
        entry.user_id,
        entry.timestamp,
        entry.direction,
        entry.kind,
        entry.text,
        entry.event_type,
        JSON.stringify(entry.metadata ?? {}),
      );
  }

  async listBySession(sessionId: string): Promise<SessionTranscriptEntry[]> {
    const rows = this.db
      .prepare(
        `
        SELECT session_id, user_id, timestamp, direction, kind, text, event_type, metadata_json
        FROM session_transcripts
        WHERE session_id = ?
        ORDER BY id ASC
        `,
      )
      .all(sessionId) as SessionTranscriptRow[];

    return rows.map((row) => ({
      session_id: row.session_id,
      user_id: row.user_id,
      timestamp: row.timestamp,
      direction: row.direction,
      kind: row.kind,
      text: row.text,
      event_type: row.event_type,
      metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    }));
  }

  async listSessions(): Promise<SessionTranscriptSession[]> {
    const rows = this.db
      .prepare(
        `
        SELECT
          session_id,
          user_id,
          MAX(timestamp) AS last_event_at,
          COUNT(*) AS entries_count
        FROM session_transcripts
        GROUP BY session_id, user_id
        ORDER BY last_event_at DESC
        `,
      )
      .all() as SessionSummaryRow[];

    return rows.map((row) => ({
      session_id: row.session_id,
      user_id: row.user_id,
      last_event_at: row.last_event_at,
      entries_count: row.entries_count,
    }));
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        direction TEXT NOT NULL,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        event_type TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_transcripts_session_id
      ON session_transcripts(session_id, id);
    `);
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
