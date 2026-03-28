#!/usr/bin/env npx tsx
/**
 * Seed Production Agents — idempotent script.
 *
 * Creates all 11 production agents via the factory with full reference sheets.
 * Safe to run multiple times — skips agents that already exist by name.
 *
 * Usage: npx tsx apps/mission-control/scripts/seed-production-agents.ts
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, queryOne, run } from '../src/lib/db';
import { buildAgentFactoryArtifacts } from '../src/lib/agent-factory';
import { PRODUCTION_AGENTS } from '../src/lib/production-agent-profiles';
import type { Agent } from '../src/lib/types';

function seed(): void {
  const db = getDb();
  const workspaceId = 'default';
  const now = new Date().toISOString();

  console.log(`[Seed] Seeding ${PRODUCTION_AGENTS.length} production agents into workspace '${workspaceId}'...`);

  let created = 0;
  let skipped = 0;

  for (const profile of PRODUCTION_AGENTS) {
    const existing = queryOne<Agent>(
      'SELECT * FROM agents WHERE name = ? AND workspace_id = ?',
      [profile.name, workspaceId],
    );

    if (existing) {
      console.log(`  [skip] ${profile.name} (${profile.role}) — already exists as ${existing.id}`);
      skipped++;
      continue;
    }

    // Generate factory artifacts
    const artifacts = buildAgentFactoryArtifacts({
      ...profile,
      workspace_id: workspaceId,
    });

    // Create agent
    const agentId = uuidv4();
    const isMaster = profile.name === 'Charlie';
    const emoji = getEmoji(profile.name);

    run(
      `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, user_md, agents_md, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'standby', ?, ?, ?, ?, ?, ?, ?)`,
      [
        agentId,
        profile.name,
        profile.role,
        profile.objective.slice(0, 200),
        emoji,
        isMaster ? 1 : 0,
        workspaceId,
        artifacts.soulMd,
        artifacts.userMd,
        artifacts.agentsMd,
        now,
        now,
      ],
    );

    // Create reference sheet v1
    const sheetId = uuidv4();
    run(
      `INSERT INTO agent_reference_sheets (id, agent_id, version, title, markdown, lifecycle_state, lifecycle_action, metadata, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, 'active', 'create', ?, ?, ?)`,
      [
        sheetId,
        agentId,
        `${profile.name} — Professional Reference Dossier v1`,
        artifacts.referenceSheet,
        JSON.stringify({
          factory_generated: true,
          readiness: artifacts.readiness,
          template_completeness: artifacts.templateCompleteness,
        }),
        now,
        now,
      ],
    );

    // Log transition
    run(
      `INSERT INTO agent_reference_sheet_transitions (id, sheet_id, agent_id, transition_type, from_state, to_state, actor, reason, created_at)
       VALUES (?, ?, ?, 'create', NULL, 'active', 'seed-script', 'Production agent seeding', ?)`,
      [uuidv4(), sheetId, agentId, now],
    );

    // Update schedule columns if they exist
    try {
      const scheduleType = inferScheduleType(profile.cadence);
      run(
        `UPDATE agents SET schedule_type = ?, schedule_config = ? WHERE id = ?`,
        [scheduleType, profile.cadence, agentId],
      );
    } catch {
      // schedule columns may not exist yet (migration 017 pending)
    }

    const status = artifacts.readiness.ready ? 'READY' : `NOT READY (${artifacts.readiness.missing.length} missing)`;
    console.log(`  [created] ${profile.name} (${profile.role}) — ${agentId} — ${status}`);
    created++;
  }

  console.log(`\n[Seed] Done. Created: ${created}, Skipped: ${skipped}, Total: ${PRODUCTION_AGENTS.length}`);
}

function getEmoji(name: string): string {
  const map: Record<string, string> = {
    Charlie: '🦞',
    Scout: '🔍',
    Builder: '🏗️',
    Inspector: '🔬',
    Sentinel: '👁️',
    Trainer: '🎓',
    Examiner: '📊',
    Arbiter: '⚖️',
    Treasurer: '💰',
    Analyst: '📈',
    Auditor: '🛡️',
  };
  return map[name] || '🤖';
}

function inferScheduleType(cadence: string): string {
  const lower = cadence.toLowerCase();
  if (lower.includes('continuous') || lower.includes('every 60')) return 'continuous';
  if (lower.includes('triggered')) return 'triggered';
  if (lower.includes('on-demand')) return 'triggered';
  if (lower.includes('hour') || lower.includes('nightly') || lower.includes('every')) return 'interval';
  return 'manual';
}

seed();
