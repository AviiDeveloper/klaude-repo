import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DemoRecord, DemoQuery, DesignElements, PitchOutcomeInput } from "./types.js";
import { DemoRecordStore } from "./demoRecordStore.js";

interface DemoRow {
  demo_id: string;
  business_id: string;
  generated_at: string;
  model_version: string;
  scrape_quality_score: number;
  design_elements_json: string;
  quality_score: number | null;
  quality_passed: number | null;
  demo_url: string | null;
  screenshot_url: string | null;
  salesperson_id: string | null;
  pitched_at: string | null;
  pitch_outcome: string | null;
  rejection_reason: string | null;
  salesperson_close_rate_at_time: number | null;
  outcome_logged_at: string | null;
}

export class SQLiteDemoRecordStore implements DemoRecordStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.ensureParentDir(dbPath);
    this.db = new Database(dbPath);
    this.createSchema();
  }

  insert(record: DemoRecord): void {
    this.db
      .prepare(
        `INSERT INTO demo_records (
          demo_id, business_id, generated_at, model_version, scrape_quality_score,
          design_elements_json, quality_score, quality_passed, demo_url, screenshot_url,
          salesperson_id, pitched_at, pitch_outcome, rejection_reason,
          salesperson_close_rate_at_time, outcome_logged_at
        ) VALUES (
          @demo_id, @business_id, @generated_at, @model_version, @scrape_quality_score,
          @design_elements_json, @quality_score, @quality_passed, @demo_url, @screenshot_url,
          @salesperson_id, @pitched_at, @pitch_outcome, @rejection_reason,
          @salesperson_close_rate_at_time, @outcome_logged_at
        )`,
      )
      .run(this.toRow(record));
  }

  get(demoId: string): DemoRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM demo_records WHERE demo_id = ?")
      .get(demoId) as DemoRow | undefined;
    return row ? this.toRecord(row) : undefined;
  }

  getByBusiness(businessId: string): DemoRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM demo_records WHERE business_id = ? ORDER BY generated_at DESC")
      .all(businessId) as DemoRow[];
    return rows.map((r) => this.toRecord(r));
  }

  updateQuality(demoId: string, score: number, passed: boolean): void {
    const result = this.db
      .prepare("UPDATE demo_records SET quality_score = ?, quality_passed = ? WHERE demo_id = ?")
      .run(score, passed ? 1 : 0, demoId);
    if (result.changes === 0) throw new Error(`Demo not found: ${demoId}`);
  }

  updateScreenshot(demoId: string, screenshotUrl: string): void {
    const result = this.db
      .prepare("UPDATE demo_records SET screenshot_url = ? WHERE demo_id = ?")
      .run(screenshotUrl, demoId);
    if (result.changes === 0) throw new Error(`Demo not found: ${demoId}`);
  }

  updatePitchOutcome(demoId: string, outcome: PitchOutcomeInput): void {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `UPDATE demo_records SET
          salesperson_id = @salesperson_id,
          pitch_outcome = @pitch_outcome,
          rejection_reason = @rejection_reason,
          salesperson_close_rate_at_time = @salesperson_close_rate_at_time,
          pitched_at = @pitched_at,
          outcome_logged_at = @outcome_logged_at
        WHERE demo_id = @demo_id`,
      )
      .run({
        demo_id: demoId,
        salesperson_id: outcome.salespersonId,
        pitch_outcome: outcome.outcome,
        rejection_reason: outcome.rejectionReason ?? null,
        salesperson_close_rate_at_time: outcome.salespersonCloseRateAtTime,
        pitched_at: now,
        outcome_logged_at: now,
      });
    if (result.changes === 0) throw new Error(`Demo not found: ${demoId}`);
  }

  query(q: DemoQuery): DemoRecord[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (q.business_id) {
      conditions.push("business_id = @business_id");
      params.business_id = q.business_id;
    }
    if (q.quality_passed !== undefined) {
      conditions.push("quality_passed = @quality_passed");
      params.quality_passed = q.quality_passed ? 1 : 0;
    }
    if (q.has_outcome !== undefined) {
      conditions.push(q.has_outcome ? "pitch_outcome IS NOT NULL" : "pitch_outcome IS NULL");
    }
    if (q.pitched_no_outcome) {
      conditions.push("pitched_at IS NOT NULL AND pitch_outcome IS NULL");
    }
    if (q.pending_qa) {
      conditions.push("quality_score IS NULL");
    }
    if (q.model_version) {
      conditions.push("model_version = @model_version");
      params.model_version = q.model_version;
    }
    if (q.since) {
      conditions.push("generated_at >= @since");
      params.since = q.since;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = q.limit ? `LIMIT ${q.limit}` : "";
    const sql = `SELECT * FROM demo_records ${where} ORDER BY generated_at DESC ${limit}`;

    const rows = this.db.prepare(sql).all(params) as DemoRow[];
    return rows.map((r) => this.toRecord(r));
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS demo_records (
        demo_id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        generated_at TEXT NOT NULL DEFAULT (datetime('now')),
        model_version TEXT NOT NULL,
        scrape_quality_score REAL NOT NULL DEFAULT 0,
        design_elements_json TEXT NOT NULL,
        quality_score REAL,
        quality_passed INTEGER,
        demo_url TEXT,
        screenshot_url TEXT,
        salesperson_id TEXT,
        pitched_at TEXT,
        pitch_outcome TEXT,
        rejection_reason TEXT,
        salesperson_close_rate_at_time REAL,
        outcome_logged_at TEXT
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_demo_records_business ON demo_records(business_id);
      CREATE INDEX IF NOT EXISTS idx_demo_records_quality ON demo_records(quality_passed);
      CREATE INDEX IF NOT EXISTS idx_demo_records_outcome ON demo_records(pitch_outcome);
      CREATE INDEX IF NOT EXISTS idx_demo_records_pending_qa ON demo_records(quality_score) WHERE quality_score IS NULL;
    `);
  }

  private toRow(record: DemoRecord): DemoRow {
    return {
      demo_id: record.demo_id,
      business_id: record.business_id,
      generated_at: record.generated_at,
      model_version: record.model_version,
      scrape_quality_score: record.scrape_quality_score,
      design_elements_json: JSON.stringify(record.design_elements),
      quality_score: record.quality_score,
      quality_passed: record.quality_passed === null ? null : record.quality_passed ? 1 : 0,
      demo_url: record.demo_url,
      screenshot_url: record.screenshot_url,
      salesperson_id: record.salesperson_id,
      pitched_at: record.pitched_at,
      pitch_outcome: record.pitch_outcome,
      rejection_reason: record.rejection_reason,
      salesperson_close_rate_at_time: record.salesperson_close_rate_at_time,
      outcome_logged_at: record.outcome_logged_at,
    };
  }

  private toRecord(row: DemoRow): DemoRecord {
    return {
      demo_id: row.demo_id,
      business_id: row.business_id,
      generated_at: row.generated_at,
      model_version: row.model_version,
      scrape_quality_score: row.scrape_quality_score,
      design_elements: JSON.parse(row.design_elements_json) as DesignElements,
      quality_score: row.quality_score,
      quality_passed: row.quality_passed === null ? null : row.quality_passed === 1,
      demo_url: row.demo_url,
      screenshot_url: row.screenshot_url,
      salesperson_id: row.salesperson_id,
      pitched_at: row.pitched_at,
      pitch_outcome: row.pitch_outcome,
      rejection_reason: row.rejection_reason,
      salesperson_close_rate_at_time: row.salesperson_close_rate_at_time,
      outcome_logged_at: row.outcome_logged_at,
    };
  }

  private ensureParentDir(targetPath: string): void {
    const parent = path.dirname(targetPath);
    mkdirSync(parent, { recursive: true });
  }
}
