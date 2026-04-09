/**
 * Episodic Memory — records every pipeline run with full context.
 *
 * Each episode captures the complete story of a pipeline run:
 * - Which agents ran and what they produced
 * - Critic scores and reflection iterations
 * - Working memory state
 * - Strategies that were injected
 * - Total cost
 *
 * Later, when a pitch outcome arrives (closed/rejected/no_show), it's
 * attached to the episode. This creates the training data for the
 * Strategy Ranker and eventually the LoRA fine-tuning pipeline.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyProductionPragmas } from "../lib/sqliteDefaults.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("episodic-store");

// ── Interfaces ──

export interface Episode {
  id: string;
  pipeline_run_id: string;
  pipeline_definition_id: string;
  lead_id?: string;
  business_name?: string;
  vertical?: string;
  region?: string;
  started_at: string;
  ended_at?: string;
  status: "running" | "completed" | "failed" | "blocked";
  total_cost_usd: number;
  reflection_iterations: number;
  agent_outputs: Record<string, unknown>;
  critic_scores: CriticScoreRecord[];
  working_memory_snapshot: Record<string, unknown>;
  strategies_used: StrategyUsedRecord[];
  plan?: Record<string, unknown>;
  // Outcome (filled later)
  pitch_outcome?: "closed" | "rejected" | "no_show";
  outcome_received_at?: string;
  close_amount_gbp?: number;
  salesperson_id?: string;
  days_to_outcome?: number;
  attribution?: Record<string, unknown>;
  created_at: string;
}

export interface CriticScoreRecord {
  agent_id: string;
  node_id: string;
  iteration: number;
  score: number;
  prediction: string;
  model_version: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface StrategyUsedRecord {
  strategy_id: string;
  vertical: string;
  strategy_type: string;
  parameters: Record<string, unknown>;
  close_rate?: number;
}

export interface EpisodeOutcome {
  pitch_outcome: "closed" | "rejected" | "no_show";
  close_amount_gbp?: number;
  salesperson_id?: string;
  days_to_outcome?: number;
}

export interface EpisodeFilter {
  vertical?: string;
  region?: string;
  status?: string;
  pitch_outcome?: string;
  limit?: number;
  offset?: number;
}

// ── Store ──

export class EpisodicStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const parent = path.dirname(dbPath);
    mkdirSync(parent, { recursive: true });
    this.db = new Database(dbPath);
    applyProductionPragmas(this.db);
    this.createSchema();
  }

  /** Record a new episode when a pipeline run starts. */
  createEpisode(input: {
    id: string;
    pipeline_run_id: string;
    pipeline_definition_id: string;
    lead_id?: string;
    business_name?: string;
    vertical?: string;
    region?: string;
  }): Episode {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO episodes (
        id, pipeline_run_id, pipeline_definition_id,
        lead_id, business_name, vertical, region,
        started_at, status, total_cost_usd, reflection_iterations,
        agent_outputs_json, critic_scores_json, working_memory_json,
        strategies_used_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', 0, 0, '{}', '[]', '{}', '[]', ?)
    `).run(
      input.id,
      input.pipeline_run_id,
      input.pipeline_definition_id,
      input.lead_id ?? null,
      input.business_name ?? null,
      input.vertical ?? null,
      input.region ?? null,
      now,
      now,
    );
    return this.getEpisode(input.id)!;
  }

  /** Update an episode with agent outputs, critic scores, etc. */
  updateEpisode(
    id: string,
    updates: {
      status?: Episode["status"];
      ended_at?: string;
      total_cost_usd?: number;
      reflection_iterations?: number;
      agent_outputs?: Record<string, unknown>;
      critic_scores?: CriticScoreRecord[];
      working_memory_snapshot?: Record<string, unknown>;
      strategies_used?: StrategyUsedRecord[];
      plan?: Record<string, unknown>;
    },
  ): void {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.status !== undefined) {
      sets.push("status = ?");
      params.push(updates.status);
    }
    if (updates.ended_at !== undefined) {
      sets.push("ended_at = ?");
      params.push(updates.ended_at);
    }
    if (updates.total_cost_usd !== undefined) {
      sets.push("total_cost_usd = ?");
      params.push(updates.total_cost_usd);
    }
    if (updates.reflection_iterations !== undefined) {
      sets.push("reflection_iterations = ?");
      params.push(updates.reflection_iterations);
    }
    if (updates.agent_outputs !== undefined) {
      sets.push("agent_outputs_json = ?");
      params.push(JSON.stringify(updates.agent_outputs));
    }
    if (updates.critic_scores !== undefined) {
      sets.push("critic_scores_json = ?");
      params.push(JSON.stringify(updates.critic_scores));
    }
    if (updates.working_memory_snapshot !== undefined) {
      sets.push("working_memory_json = ?");
      params.push(JSON.stringify(updates.working_memory_snapshot));
    }
    if (updates.strategies_used !== undefined) {
      sets.push("strategies_used_json = ?");
      params.push(JSON.stringify(updates.strategies_used));
    }
    if (updates.plan !== undefined) {
      sets.push("plan_json = ?");
      params.push(JSON.stringify(updates.plan));
    }

    if (sets.length === 0) return;
    params.push(id);
    this.db.prepare(`UPDATE episodes SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  /** Attach a pitch outcome to an episode. This is the learning signal. */
  recordOutcome(episodeId: string, outcome: EpisodeOutcome): void {
    this.db.prepare(`
      UPDATE episodes SET
        pitch_outcome = ?,
        outcome_received_at = ?,
        close_amount_gbp = ?,
        salesperson_id = ?,
        days_to_outcome = ?
      WHERE id = ?
    `).run(
      outcome.pitch_outcome,
      new Date().toISOString(),
      outcome.close_amount_gbp ?? null,
      outcome.salesperson_id ?? null,
      outcome.days_to_outcome ?? null,
      episodeId,
    );

    log.info("outcome recorded", {
      episode_id: episodeId,
      outcome: outcome.pitch_outcome,
      amount_gbp: outcome.close_amount_gbp,
    });
  }

  /** Attach attribution data (credit/blame per agent). */
  recordAttribution(episodeId: string, attribution: Record<string, unknown>): void {
    this.db.prepare("UPDATE episodes SET attribution_json = ? WHERE id = ?").run(
      JSON.stringify(attribution),
      episodeId,
    );
  }

  getEpisode(id: string): Episode | undefined {
    const row = this.db.prepare("SELECT * FROM episodes WHERE id = ?").get(id) as EpisodeRow | undefined;
    return row ? this.rowToEpisode(row) : undefined;
  }

  getByRunId(pipelineRunId: string): Episode | undefined {
    const row = this.db.prepare("SELECT * FROM episodes WHERE pipeline_run_id = ?").get(pipelineRunId) as EpisodeRow | undefined;
    return row ? this.rowToEpisode(row) : undefined;
  }

  /** List episodes with optional filtering. */
  listEpisodes(filter?: EpisodeFilter): Episode[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.vertical) {
      conditions.push("vertical = ?");
      params.push(filter.vertical);
    }
    if (filter?.region) {
      conditions.push("region = ?");
      params.push(filter.region);
    }
    if (filter?.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    if (filter?.pitch_outcome) {
      conditions.push("pitch_outcome = ?");
      params.push(filter.pitch_outcome);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit ?? 100;
    const offset = filter?.offset ?? 0;

    const rows = this.db.prepare(
      `SELECT * FROM episodes ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as EpisodeRow[];

    return rows.map((r) => this.rowToEpisode(r));
  }

  /** Count episodes with outcomes (for training readiness check). */
  countWithOutcomes(): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as count FROM episodes WHERE pitch_outcome IS NOT NULL",
    ).get() as { count: number };
    return row.count;
  }

  /** Get episodes with outcomes for strategy analysis. */
  listWithOutcomes(filter?: {
    vertical?: string;
    limit?: number;
  }): Episode[] {
    const conditions = ["pitch_outcome IS NOT NULL"];
    const params: unknown[] = [];

    if (filter?.vertical) {
      conditions.push("vertical = ?");
      params.push(filter.vertical);
    }

    const limit = filter?.limit ?? 500;
    const rows = this.db.prepare(
      `SELECT * FROM episodes WHERE ${conditions.join(" AND ")} ORDER BY outcome_received_at DESC LIMIT ?`,
    ).all(...params, limit) as EpisodeRow[];

    return rows.map((r) => this.rowToEpisode(r));
  }

  close(): void {
    this.db.close();
  }

  // ── Private ──

  private rowToEpisode(row: EpisodeRow): Episode {
    return {
      id: row.id,
      pipeline_run_id: row.pipeline_run_id,
      pipeline_definition_id: row.pipeline_definition_id,
      lead_id: row.lead_id ?? undefined,
      business_name: row.business_name ?? undefined,
      vertical: row.vertical ?? undefined,
      region: row.region ?? undefined,
      started_at: row.started_at,
      ended_at: row.ended_at ?? undefined,
      status: row.status as Episode["status"],
      total_cost_usd: row.total_cost_usd,
      reflection_iterations: row.reflection_iterations,
      agent_outputs: JSON.parse(row.agent_outputs_json),
      critic_scores: JSON.parse(row.critic_scores_json),
      working_memory_snapshot: JSON.parse(row.working_memory_json),
      strategies_used: JSON.parse(row.strategies_used_json),
      plan: row.plan_json ? JSON.parse(row.plan_json) : undefined,
      pitch_outcome: row.pitch_outcome as Episode["pitch_outcome"] ?? undefined,
      outcome_received_at: row.outcome_received_at ?? undefined,
      close_amount_gbp: row.close_amount_gbp ?? undefined,
      salesperson_id: row.salesperson_id ?? undefined,
      days_to_outcome: row.days_to_outcome ?? undefined,
      attribution: row.attribution_json ? JSON.parse(row.attribution_json) : undefined,
      created_at: row.created_at,
    };
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        pipeline_run_id TEXT NOT NULL UNIQUE,
        pipeline_definition_id TEXT NOT NULL,
        lead_id TEXT,
        business_name TEXT,
        vertical TEXT,
        region TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL,
        total_cost_usd REAL DEFAULT 0,
        reflection_iterations INTEGER DEFAULT 0,
        agent_outputs_json TEXT NOT NULL DEFAULT '{}',
        critic_scores_json TEXT NOT NULL DEFAULT '[]',
        working_memory_json TEXT NOT NULL DEFAULT '{}',
        strategies_used_json TEXT NOT NULL DEFAULT '[]',
        plan_json TEXT,
        pitch_outcome TEXT,
        outcome_received_at TEXT,
        close_amount_gbp REAL,
        salesperson_id TEXT,
        days_to_outcome REAL,
        attribution_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_episodes_vertical
      ON episodes(vertical) WHERE vertical IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_episodes_outcome
      ON episodes(pitch_outcome) WHERE pitch_outcome IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_episodes_run
      ON episodes(pipeline_run_id);

      CREATE INDEX IF NOT EXISTS idx_episodes_status
      ON episodes(status);
    `);
  }
}

// ── Internal row type ──

interface EpisodeRow {
  id: string;
  pipeline_run_id: string;
  pipeline_definition_id: string;
  lead_id: string | null;
  business_name: string | null;
  vertical: string | null;
  region: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_cost_usd: number;
  reflection_iterations: number;
  agent_outputs_json: string;
  critic_scores_json: string;
  working_memory_json: string;
  strategies_used_json: string;
  plan_json: string | null;
  pitch_outcome: string | null;
  outcome_received_at: string | null;
  close_amount_gbp: number | null;
  salesperson_id: string | null;
  days_to_outcome: number | null;
  attribution_json: string | null;
  created_at: string;
}
