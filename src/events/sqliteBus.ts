import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyProductionPragmas } from "../lib/sqliteDefaults.js";
import { createLogger } from "../lib/logger.js";
import { EventBus, EventName, Event } from "./bus.js";

const log = createLogger("event-bus");

type Listener<T> = (event: Event<T>) => void | Promise<void>;

export class SQLiteEventBus implements EventBus {
  private readonly db: Database.Database;
  private readonly listeners = new Map<EventName, Array<Listener<unknown>>>();

  constructor(dbPath: string) {
    const parent = path.dirname(dbPath);
    mkdirSync(parent, { recursive: true });
    this.db = new Database(dbPath);
    applyProductionPragmas(this.db);
    this.createSchema();
  }

  subscribe<T>(name: EventName, listener: Listener<T>): void {
    const existing = this.listeners.get(name) ?? [];
    this.listeners.set(name, [...existing, listener as Listener<unknown>]);
  }

  async publish<T>(name: EventName, payload: T, correlationId?: string): Promise<void> {
    const event: Event<T> = { name, payload, at: new Date().toISOString(), correlation_id: correlationId };

    // Persist first
    this.db
      .prepare(
        "INSERT INTO events (id, name, payload_json, created_at, correlation_id) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        JSON.stringify(payload),
        event.at,
        correlationId ?? null,
      );

    // Then dispatch to in-memory listeners
    const listeners = this.listeners.get(name) ?? [];
    for (const listener of listeners) {
      try {
        await listener(event as Event<unknown>);
      } catch (err) {
        log.error("event listener failed", {
          event_name: name,
          error: String(err),
        });
      }
    }

    // Mark as processed
    this.db
      .prepare(
        "UPDATE events SET processed_at = ? WHERE id = (SELECT id FROM events WHERE name = ? AND processed_at IS NULL ORDER BY created_at ASC LIMIT 1)",
      )
      .run(new Date().toISOString(), name);
  }

  /** Replay unprocessed events from a previous run */
  async replayUnprocessed(): Promise<number> {
    const rows = this.db
      .prepare(
        "SELECT name, payload_json, created_at FROM events WHERE processed_at IS NULL ORDER BY created_at ASC",
      )
      .all() as Array<{ name: EventName; payload_json: string; created_at: string }>;

    let replayed = 0;
    for (const row of rows) {
      const event: Event<unknown> = {
        name: row.name,
        payload: JSON.parse(row.payload_json),
        at: row.created_at,
      };

      const listeners = this.listeners.get(row.name) ?? [];
      for (const listener of listeners) {
        try {
          await listener(event);
        } catch (err) {
          log.error("replay listener failed", {
            event_name: row.name,
            error: String(err),
          });
        }
      }
      replayed++;
    }

    // Mark all as processed
    if (replayed > 0) {
      this.db
        .prepare("UPDATE events SET processed_at = ? WHERE processed_at IS NULL")
        .run(new Date().toISOString());
      log.info(`replayed ${replayed} unprocessed events`);
    }

    return replayed;
  }

  /** Prune processed events older than the given number of days */
  prune(olderThanDays = 7): number {
    const cutoff = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = this.db
      .prepare(
        "DELETE FROM events WHERE processed_at IS NOT NULL AND created_at < ?",
      )
      .run(cutoff);
    return result.changes;
  }

  close(): void {
    this.db.close();
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        processed_at TEXT,
        correlation_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_events_unprocessed
      ON events(created_at ASC) WHERE processed_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_events_correlation
      ON events(correlation_id) WHERE correlation_id IS NOT NULL;
    `);
  }
}
