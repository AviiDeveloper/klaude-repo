#!/usr/bin/env npx tsx
/**
 * Seed Production Pipelines into the runtime's pipeline_definitions table.
 *
 * Usage: npx tsx scripts/seed-production-pipelines.ts
 */

import { SQLitePipelineStore } from "../src/pipeline/sqlitePipelineStore.js";

const dbPath = process.env.DB_PATH ?? "data/mvp.sqlite";
const store = new SQLitePipelineStore(dbPath);

interface PipelineNodeDef {
  id: string;
  agent_id: string;
  depends_on: string[];
  paid_action?: boolean;
  config?: Record<string, unknown>;
}

const PIPELINES: Array<{
  id: string;
  name: string;
  schedule_rrule: string;
  max_retries: number;
  enabled: boolean;
  nodes: PipelineNodeDef[];
}> = [
  {
    id: "production-scrape-generate-qc",
    name: "Scrape-Generate-QC Pipeline",
    schedule_rrule: "FREQ=MINUTELY;INTERVAL=5",
    max_retries: 2,
    enabled: true,
    nodes: [
      { id: "scrape", agent_id: "production-scraper-agent", depends_on: [] },
      { id: "generate", agent_id: "production-generator-agent", depends_on: ["scrape"] },
      { id: "qc", agent_id: "production-qc-agent", depends_on: ["generate"] },
    ],
  },
  {
    id: "production-monitoring-training",
    name: "Monitoring-Training Pipeline",
    schedule_rrule: "FREQ=HOURLY;INTERVAL=6",
    max_retries: 1,
    enabled: true,
    nodes: [
      { id: "monitor", agent_id: "production-monitoring-agent", depends_on: [] },
      { id: "train", agent_id: "production-training-agent", depends_on: ["monitor"], paid_action: true },
      { id: "evaluate", agent_id: "production-evaluation-agent", depends_on: ["train"] },
      { id: "decide", agent_id: "production-decision-agent", depends_on: ["evaluate"], paid_action: true },
    ],
  },
  {
    id: "production-cost-controller",
    name: "Cost Controller Pipeline",
    schedule_rrule: "FREQ=HOURLY;INTERVAL=1",
    max_retries: 3,
    enabled: true,
    nodes: [
      { id: "cost-control", agent_id: "production-cost-controller-agent", depends_on: [] },
    ],
  },
  {
    id: "production-analytics",
    name: "Analytics Pipeline",
    schedule_rrule: "FREQ=DAILY;INTERVAL=1",
    max_retries: 2,
    enabled: true,
    nodes: [
      { id: "analytics", agent_id: "production-analytics-agent", depends_on: [] },
    ],
  },
  {
    id: "production-data-validation",
    name: "Data Validation Pipeline",
    schedule_rrule: "FREQ=DAILY;INTERVAL=1",
    max_retries: 2,
    enabled: true,
    nodes: [
      { id: "data-validation", agent_id: "production-data-validation-agent", depends_on: [] },
    ],
  },
];

let created = 0;
let skipped = 0;

for (const pipeline of PIPELINES) {
  const existing = store.getDefinition(pipeline.id);
  if (existing) {
    console.log(`  [skip] ${pipeline.name} — already exists`);
    skipped++;
    continue;
  }

  store.upsertDefinition({
    id: pipeline.id,
    name: pipeline.name,
    enabled: pipeline.enabled,
    schedule_rrule: pipeline.schedule_rrule,
    max_retries: pipeline.max_retries,
    nodes: pipeline.nodes,
    config: {},
  });

  console.log(`  [created] ${pipeline.name} (${pipeline.schedule_rrule})`);
  created++;
}

console.log(`\n[Seed] Pipelines: ${created} created, ${skipped} skipped`);
