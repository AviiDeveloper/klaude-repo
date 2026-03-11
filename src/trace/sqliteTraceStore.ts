import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Task } from "../types/task.js";
import { TimelineEvent, TraceSideEffect, ExecutionTraceRecord } from "./types.js";
import { TraceStore } from "./traceStore.js";

interface TraceRow {
  task_id: string;
  objective: string;
  created_at: string;
  build_version: string;
  changelog_change_id: string;
  final_state: string;
  approvals_json: string;
  side_effects_json: string;
  artifacts_json: string;
}

interface TimelineRow {
  timestamp: string;
  event_type: TimelineEvent["event_type"];
  component: TimelineEvent["component"];
  summary: string;
  details_json: string;
}

interface SQLiteTraceStoreOptions {
  dbPath: string;
  buildVersion: string;
  changelogChangeId: string;
}

export class SQLiteTraceStore implements TraceStore {
  private readonly db: Database.Database;

  constructor(private readonly options: SQLiteTraceStoreOptions) {
    this.ensureParentDir(options.dbPath);
    this.db = new Database(options.dbPath);
    this.createSchema();
  }

  async create(task: Task): Promise<void> {
    const existing = this.getRow(task.id);
    if (existing) {
      throw new Error(`Trace already exists for task: ${task.id}`);
    }

    this.db
      .prepare(
        `
        INSERT INTO traces (
          task_id, objective, created_at, build_version, changelog_change_id,
          final_state, approvals_json, side_effects_json, artifacts_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        task.id,
        task.objective,
        task.created_at,
        this.options.buildVersion,
        this.options.changelogChangeId,
        "in_progress",
        "[]",
        "[]",
        "[]",
      );
  }

  async appendTimeline(taskId: string, event: TimelineEvent): Promise<void> {
    this.assertMutable(taskId);
    this.db
      .prepare(
        `
        INSERT INTO trace_timeline (
          task_id, timestamp, event_type, component, summary, details_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        taskId,
        event.timestamp,
        event.event_type,
        event.component,
        event.summary,
        JSON.stringify(event.details),
      );
  }

  async finalize(input: {
    taskId: string;
    finalState: string;
    sideEffects: TraceSideEffect[];
    artifacts: string[];
  }): Promise<ExecutionTraceRecord> {
    this.assertMutable(input.taskId);
    this.db
      .prepare(
        `
        UPDATE traces
        SET final_state = ?, side_effects_json = ?, artifacts_json = ?
        WHERE task_id = ?
        `,
      )
      .run(
        input.finalState,
        JSON.stringify(input.sideEffects),
        JSON.stringify(input.artifacts),
        input.taskId,
      );

    return this.read(input.taskId);
  }

  async read(taskId: string): Promise<ExecutionTraceRecord> {
    const trace = this.getRow(taskId);
    if (!trace) {
      throw new Error(`Trace not found for task: ${taskId}`);
    }

    const timelineRows = this.db
      .prepare(
        "SELECT timestamp, event_type, component, summary, details_json FROM trace_timeline WHERE task_id = ? ORDER BY rowid ASC",
      )
      .all(taskId) as TimelineRow[];

    return {
      task_id: trace.task_id,
      objective: trace.objective,
      created_at: trace.created_at,
      build_version: trace.build_version,
      changelog_change_id: trace.changelog_change_id,
      final_state: trace.final_state,
      timeline: timelineRows.map((row) => ({
        timestamp: row.timestamp,
        event_type: row.event_type,
        component: row.component,
        summary: row.summary,
        details: JSON.parse(row.details_json) as Record<string, unknown>,
      })),
      approvals: JSON.parse(trace.approvals_json),
      side_effects: JSON.parse(trace.side_effects_json),
      artifacts: JSON.parse(trace.artifacts_json),
    };
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        task_id TEXT PRIMARY KEY,
        objective TEXT NOT NULL,
        created_at TEXT NOT NULL,
        build_version TEXT NOT NULL,
        changelog_change_id TEXT NOT NULL,
        final_state TEXT NOT NULL,
        approvals_json TEXT NOT NULL,
        side_effects_json TEXT NOT NULL,
        artifacts_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trace_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        component TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES traces(task_id)
      );

      CREATE INDEX IF NOT EXISTS idx_trace_timeline_task_id
      ON trace_timeline(task_id, id);
    `);
  }

  private getRow(taskId: string): TraceRow | undefined {
    return this.db
      .prepare("SELECT * FROM traces WHERE task_id = ?")
      .get(taskId) as TraceRow | undefined;
  }

  private assertMutable(taskId: string): void {
    const trace = this.getRow(taskId);
    if (!trace) {
      throw new Error(`Trace not initialized for task: ${taskId}`);
    }
    if (trace.final_state !== "in_progress") {
      throw new Error(`Trace is immutable after finalize for task: ${taskId}`);
    }
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
