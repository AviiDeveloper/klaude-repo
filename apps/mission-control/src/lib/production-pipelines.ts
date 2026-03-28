/**
 * Production Pipeline Definitions — 5 DAGs for the 11-agent autonomous system.
 *
 * Each pipeline maps to a group of agents with inter-agent dependencies
 * encoded as DAG nodes with `depends_on` relationships.
 */

import { queryOne, run } from '@/lib/db';

export interface PipelineNodeDef {
  id: string;
  agent_id: string;
  depends_on: string[];
  paid_action: boolean;
  config?: Record<string, unknown>;
}

export interface PipelineDefinitionDef {
  id: string;
  name: string;
  schedule_rrule: string;
  max_retries: number;
  nodes: PipelineNodeDef[];
  enabled: boolean;
}

export const PRODUCTION_PIPELINES: PipelineDefinitionDef[] = [
  // ─── Scrape → Generate → QC (every 5 min) ───
  {
    id: 'production-scrape-generate-qc',
    name: 'Scrape-Generate-QC Pipeline',
    schedule_rrule: 'FREQ=MINUTELY;INTERVAL=5',
    max_retries: 2,
    enabled: true,
    nodes: [
      {
        id: 'scrape',
        agent_id: 'production-scraper-agent',
        depends_on: [],
        paid_action: false,
        config: { target_buffer: 500, max_per_run: 30 },
      },
      {
        id: 'generate',
        agent_id: 'production-generator-agent',
        depends_on: ['scrape'],
        paid_action: false,
        config: { parallel_limit: 30, model: 'claude-sonnet-4-6' },
      },
      {
        id: 'qc',
        agent_id: 'production-qc-agent',
        depends_on: ['generate'],
        paid_action: false,
        config: { quality_threshold: 0.7 },
      },
    ],
  },

  // ─── Monitor → Train → Evaluate → Decide (every 6h) ───
  {
    id: 'production-monitoring-training',
    name: 'Monitoring-Training Pipeline',
    schedule_rrule: 'FREQ=HOURLY;INTERVAL=6',
    max_retries: 1,
    enabled: true,
    nodes: [
      {
        id: 'monitor',
        agent_id: 'production-monitoring-agent',
        depends_on: [],
        paid_action: false,
        config: { outcome_threshold: 100 },
      },
      {
        id: 'train',
        agent_id: 'production-training-agent',
        depends_on: ['monitor'],
        paid_action: true, // Requires approval — GPU cost
        config: { instance_type: 'on-demand', gpu: 'RTX_4090', max_cost_gbp: 20 },
      },
      {
        id: 'evaluate',
        agent_id: 'production-evaluation-agent',
        depends_on: ['train'],
        paid_action: false,
        config: { min_auc: 0.62, min_lift: 1.3, max_pvalue: 0.05 },
      },
      {
        id: 'decide',
        agent_id: 'production-decision-agent',
        depends_on: ['evaluate'],
        paid_action: true, // Requires manual approval for deployment
        config: { ab_test_duration_days: 14 },
      },
    ],
  },

  // ─── Cost Controller (hourly) ───
  {
    id: 'production-cost-controller',
    name: 'Cost Controller Pipeline',
    schedule_rrule: 'FREQ=HOURLY;INTERVAL=1',
    max_retries: 3,
    enabled: true,
    nodes: [
      {
        id: 'cost-control',
        agent_id: 'production-cost-controller-agent',
        depends_on: [],
        paid_action: false,
        config: { daily_budget_gbp: 10, alert_telegram: true },
      },
    ],
  },

  // ─── Analytics (nightly 02:00) ───
  {
    id: 'production-analytics',
    name: 'Analytics Pipeline',
    schedule_rrule: 'FREQ=DAILY;INTERVAL=1',
    max_retries: 2,
    enabled: true,
    nodes: [
      {
        id: 'analytics',
        agent_id: 'production-analytics-agent',
        depends_on: [],
        paid_action: false,
        config: { ema_weight: 0.3, weekly_summary_day: 'monday' },
      },
    ],
  },

  // ─── Data Validation (nightly 02:00) ───
  {
    id: 'production-data-validation',
    name: 'Data Validation Pipeline',
    schedule_rrule: 'FREQ=DAILY;INTERVAL=1',
    max_retries: 2,
    enabled: true,
    nodes: [
      {
        id: 'data-validation',
        agent_id: 'production-data-validation-agent',
        depends_on: [],
        paid_action: false,
        config: { poisoning_zscore_threshold: 3, min_sp_pitches: 10 },
      },
    ],
  },
];

/**
 * Seed production pipeline definitions into the pipeline_definitions table.
 * Idempotent — skips definitions that already exist.
 */
export function seedProductionPipelines(): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;

  for (const pipeline of PRODUCTION_PIPELINES) {
    const existing = queryOne<{ id: string }>(
      'SELECT id FROM pipeline_definitions WHERE id = ?',
      [pipeline.id],
    );

    if (existing) {
      skipped++;
      continue;
    }

    const now = new Date().toISOString();
    run(
      `INSERT INTO pipeline_definitions (id, name, enabled, schedule_rrule, max_retries, nodes_json, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
      [
        pipeline.id,
        pipeline.name,
        pipeline.enabled ? 1 : 0,
        pipeline.schedule_rrule,
        pipeline.max_retries,
        JSON.stringify(pipeline.nodes),
        now,
        now,
      ],
    );
    created++;
  }

  return { created, skipped };
}
