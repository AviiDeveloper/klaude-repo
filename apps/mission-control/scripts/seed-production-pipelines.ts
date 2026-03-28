#!/usr/bin/env npx tsx
/**
 * Seed Production Pipelines — idempotent.
 *
 * Creates the 5 autonomous pipeline DAGs in the pipeline_definitions table.
 * Safe to run multiple times — skips definitions that already exist.
 *
 * Usage: cd apps/mission-control && npx tsx scripts/seed-production-pipelines.ts
 */

import { seedProductionPipelines } from '@/lib/production-pipelines';

const result = seedProductionPipelines();
console.log(`[Seed] Production pipelines: ${result.created} created, ${result.skipped} skipped`);
