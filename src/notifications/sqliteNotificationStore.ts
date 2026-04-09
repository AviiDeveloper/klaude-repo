import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { applyProductionPragmas } from "../lib/sqliteDefaults.js";
import {
  NotificationFilter,
  NotificationRecord,
  NotificationStore,
} from "./notificationStore.js";

interface NotificationRow {
  id: string;
  event_id: string;
  created_at: string;
  acknowledged_at: string | null;
  channel: "notify_user" | "call_user";
  reason: NotificationRecord["reason"];
  message: string;
  severity: NotificationRecord["severity"];
  status: NotificationRecord["status"];
  task_id: string | null;
  session_id: string;
  user_id: string;
}

export class SQLiteNotificationStore implements NotificationStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    applyProductionPragmas(this.db);
    this.createSchema();
  }

  close(): void {
    this.db.close();
  }

  async append(
    record: Omit<NotificationRecord, "id" | "status">,
  ): Promise<NotificationRecord> {
    const id = randomUUID();
    this.db
      .prepare(
        `
        INSERT INTO notifications (
          id, event_id, created_at, acknowledged_at, channel, reason,
          message, severity, status, task_id, session_id, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        record.event_id,
        record.created_at,
        record.acknowledged_at ?? null,
        record.channel,
        record.reason,
        record.message,
        record.severity,
        "pending",
        record.task_id ?? null,
        record.session_id,
        record.user_id,
      );

    return this.getById(id);
  }

  async list(filter: NotificationFilter = {}): Promise<NotificationRecord[]> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filter.channel) {
      where.push("channel = ?");
      params.push(filter.channel);
    }
    if (filter.reason) {
      where.push("reason = ?");
      params.push(filter.reason);
    }
    if (filter.severity) {
      where.push("severity = ?");
      params.push(filter.severity);
    }
    if (filter.status) {
      where.push("status = ?");
      params.push(filter.status);
    }
    if (filter.task_id) {
      where.push("task_id = ?");
      params.push(filter.task_id);
    }
    if (filter.session_id) {
      where.push("session_id = ?");
      params.push(filter.session_id);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Number.isFinite(filter.limit) ? Math.max(1, Number(filter.limit)) : 100;
    const rows = this.db
      .prepare(
        `
        SELECT * FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ?
        `,
      )
      .all(...params, limit) as NotificationRow[];

    return rows.map((row) => this.toRecord(row));
  }

  async acknowledge(id: string): Promise<NotificationRecord | undefined> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE notifications
        SET status = 'acknowledged', acknowledged_at = ?
        WHERE id = ?
        `,
      )
      .run(now, id);

    try {
      return this.getById(id);
    } catch {
      return undefined;
    }
  }

  private getById(id: string): NotificationRecord {
    const row = this.db
      .prepare("SELECT * FROM notifications WHERE id = ?")
      .get(id) as NotificationRow | undefined;
    if (!row) {
      throw new Error(`notification not found: ${id}`);
    }
    return this.toRecord(row);
  }

  private toRecord(row: NotificationRow): NotificationRecord {
    return {
      id: row.id,
      event_id: row.event_id,
      created_at: row.created_at,
      acknowledged_at: row.acknowledged_at ?? undefined,
      channel: row.channel,
      reason: row.reason,
      message: row.message,
      severity: row.severity,
      status: row.status,
      task_id: row.task_id ?? undefined,
      session_id: row.session_id,
      user_id: row.user_id,
    };
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        acknowledged_at TEXT,
        channel TEXT NOT NULL,
        reason TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        task_id TEXT,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_created
      ON notifications(created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_notifications_status
      ON notifications(status, created_at DESC);
    `);
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
