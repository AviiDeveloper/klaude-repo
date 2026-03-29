import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DecisionRecord, DecisionQuery, AccuracyReport, DecisionOutcome } from "./types.js";
import { DecisionStore } from "./decisionStore.js";

interface DecisionRow {
  decision_id: string;
  made_at: string;
  agent_id: string;
  decision_type: string;
  description: string | null;
  rationale: string | null;
  input_data_json: string | null;
  expected_outcome: string | null;
  expected_metric_json: string | null;
  actual_outcome: string | null;
  actual_metric_json: string | null;
  outcome_measured_at: string | null;
  prediction_accuracy: number | null;
  requires_human_review: number;
}

export class SQLiteDecisionStore implements DecisionStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    this.createSchema();
  }

  insert(record: DecisionRecord): void {
    this.db
      .prepare(
        `INSERT INTO decision_log (
          decision_id, made_at, agent_id, decision_type, description,
          rationale, input_data_json, expected_outcome, expected_metric_json,
          actual_outcome, actual_metric_json, outcome_measured_at,
          prediction_accuracy, requires_human_review
        ) VALUES (
          @decision_id, @made_at, @agent_id, @decision_type, @description,
          @rationale, @input_data_json, @expected_outcome, @expected_metric_json,
          @actual_outcome, @actual_metric_json, @outcome_measured_at,
          @prediction_accuracy, @requires_human_review
        )`,
      )
      .run(this.toRow(record));
  }

  get(decisionId: string): DecisionRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM decision_log WHERE decision_id = ?")
      .get(decisionId) as DecisionRow | undefined;
    return row ? this.toRecord(row) : undefined;
  }

  updateOutcome(
    decisionId: string,
    outcome: DecisionOutcome,
    measuredAt: string,
    accuracy: number | null,
  ): void {
    const result = this.db
      .prepare(
        `UPDATE decision_log SET
          actual_outcome = @actual_outcome,
          actual_metric_json = @actual_metric_json,
          outcome_measured_at = @outcome_measured_at,
          prediction_accuracy = @prediction_accuracy
        WHERE decision_id = @decision_id`,
      )
      .run({
        decision_id: decisionId,
        actual_outcome: outcome.actual_outcome,
        actual_metric_json: outcome.actual_metric ? JSON.stringify(outcome.actual_metric) : null,
        outcome_measured_at: measuredAt,
        prediction_accuracy: accuracy,
      });

    if (result.changes === 0) {
      throw new Error(`Decision not found: ${decisionId}`);
    }
  }

  query(q: DecisionQuery): DecisionRecord[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (q.agent_id) {
      conditions.push("agent_id = @agent_id");
      params.agent_id = q.agent_id;
    }
    if (q.decision_type) {
      conditions.push("decision_type = @decision_type");
      params.decision_type = q.decision_type;
    }
    if (q.pending_outcome_only) {
      conditions.push("actual_outcome IS NULL");
    }
    if (q.requires_human_review !== undefined) {
      conditions.push("requires_human_review = @requires_human_review");
      params.requires_human_review = q.requires_human_review ? 1 : 0;
    }
    if (q.since) {
      conditions.push("made_at >= @since");
      params.since = q.since;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = q.limit ? `LIMIT ${q.limit}` : "";
    const sql = `SELECT * FROM decision_log ${where} ORDER BY made_at DESC ${limit}`;

    const rows = this.db.prepare(sql).all(params) as DecisionRow[];
    return rows.map((row) => this.toRecord(row));
  }

  getAccuracy(agentId: string, since: string): AccuracyReport {
    const total = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM decision_log WHERE agent_id = ? AND made_at >= ?",
      )
      .get(agentId, since) as { count: number };

    const measured = this.db
      .prepare(
        "SELECT COUNT(*) as count, AVG(prediction_accuracy) as avg_accuracy FROM decision_log WHERE agent_id = ? AND made_at >= ? AND prediction_accuracy IS NOT NULL",
      )
      .get(agentId, since) as { count: number; avg_accuracy: number | null };

    return {
      agent_id: agentId,
      total_decisions: total.count,
      measured_decisions: measured.count,
      average_accuracy: measured.avg_accuracy,
      since,
    };
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decision_log (
        decision_id TEXT PRIMARY KEY,
        made_at TEXT NOT NULL DEFAULT (datetime('now')),
        agent_id TEXT NOT NULL,
        decision_type TEXT NOT NULL,
        description TEXT,
        rationale TEXT,
        input_data_json TEXT,
        expected_outcome TEXT,
        expected_metric_json TEXT,
        actual_outcome TEXT,
        actual_metric_json TEXT,
        outcome_measured_at TEXT,
        prediction_accuracy REAL,
        requires_human_review INTEGER DEFAULT 0
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_decision_log_agent ON decision_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_decision_log_type ON decision_log(decision_type);
      CREATE INDEX IF NOT EXISTS idx_decision_log_pending ON decision_log(actual_outcome) WHERE actual_outcome IS NULL;
    `);
  }

  private toRow(record: DecisionRecord): DecisionRow {
    return {
      decision_id: record.decision_id,
      made_at: record.made_at,
      agent_id: record.agent_id,
      decision_type: record.decision_type,
      description: record.description,
      rationale: record.rationale,
      input_data_json: JSON.stringify(record.input_data),
      expected_outcome: record.expected_outcome,
      expected_metric_json: record.expected_metric ? JSON.stringify(record.expected_metric) : null,
      actual_outcome: record.actual_outcome,
      actual_metric_json: record.actual_metric ? JSON.stringify(record.actual_metric) : null,
      outcome_measured_at: record.outcome_measured_at,
      prediction_accuracy: record.prediction_accuracy,
      requires_human_review: record.requires_human_review ? 1 : 0,
    };
  }

  private toRecord(row: DecisionRow): DecisionRecord {
    return {
      decision_id: row.decision_id,
      made_at: row.made_at,
      agent_id: row.agent_id,
      decision_type: row.decision_type,
      description: row.description ?? "",
      rationale: row.rationale ?? "",
      input_data: row.input_data_json ? (JSON.parse(row.input_data_json) as Record<string, unknown>) : {},
      expected_outcome: row.expected_outcome ?? "",
      expected_metric: row.expected_metric_json ? (JSON.parse(row.expected_metric_json) as Record<string, unknown>) : null,
      actual_outcome: row.actual_outcome,
      actual_metric: row.actual_metric_json ? (JSON.parse(row.actual_metric_json) as Record<string, unknown>) : null,
      outcome_measured_at: row.outcome_measured_at,
      prediction_accuracy: row.prediction_accuracy,
      requires_human_review: row.requires_human_review === 1,
    };
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
