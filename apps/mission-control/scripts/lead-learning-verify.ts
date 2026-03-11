import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-lead-learning-verify-'));
  const dbPath = path.join(tmpDir, 'mission-control.lead-learning.sqlite');
  process.env.DATABASE_PATH = dbPath;

  const dbMod = await import('../src/lib/db/index');
  const memoryMod = await import('../src/lib/memory/packet');
  const leadMod = await import('../src/lib/lead-orchestrator');

  const { run, closeDb } = dbMod;
  const { buildMemoryPacket } = memoryMod;
  const { delegateTask, ensureLeadAgent } = leadMod;

  function seedWorkspace(workspaceId: string, label: string) {
    const now = new Date().toISOString();
    run(
      `INSERT OR IGNORE INTO workspaces (id, name, slug, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [workspaceId, label, workspaceId, '🏠', now, now],
    );

    ensureLeadAgent(workspaceId);

    const strongWorkerId = uuidv4();
    const newWorkerId = uuidv4();
    run(
      `INSERT INTO agents (id, name, role, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [strongWorkerId, `${label} Proven`, 'Research Agent', '🧠', 'working', 0, workspaceId, now, now],
    );
    run(
      `INSERT INTO agents (id, name, role, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newWorkerId, `${label} New`, 'Research Agent', '🧪', 'working', 0, workspaceId, now, now],
    );

    run(
      `INSERT INTO agent_performance_profiles
       (agent_id, workspace_id, rolling_score, pass_rate, failure_rate, input_gap_rate, avg_confidence, samples, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [strongWorkerId, workspaceId, 20, 0.45, 0.35, 0.1, 0.55, 12, now],
    );

    const taskId = uuidv4();
    run(
      `INSERT INTO tasks
       (id, title, description, status, priority, workspace_id, business_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        `${label} delegation test`,
        'Pick the best worker for a neutral research objective.',
        'planning',
        'normal',
        workspaceId,
        'default',
        now,
        now,
      ],
    );

    return { strongWorkerId, newWorkerId, taskId };
  }

  function insertLearningSet(input: {
    workspaceId: string;
    conceptTag: string;
    scores: number[];
    gradeFromScore: (score: number) => 'good' | 'partial' | 'wrong';
  }) {
    const baseTs = Date.now();
    input.scores.forEach((score, index) => {
      const questionId = uuidv4();
      const answerId = uuidv4();
      const ts = new Date(baseTs + index * 1000).toISOString();
      run(
        `INSERT INTO learning_questions
         (id, workspace_id, source_type, source_ref, question, expected_answer_json, concept_tag, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          input.workspaceId,
          'manual',
          null,
          `Q${index + 1}`,
          JSON.stringify({ key_points: ['x'], tradeoff: 'x', risk_if_changed: 'x', concept: input.conceptTag }),
          input.conceptTag,
          ts,
        ],
      );
      run(
        `INSERT INTO learning_answers
         (id, question_id, workspace_id, operator_id, answer_text, score, grade, feedback, next_resource, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          answerId,
          questionId,
          input.workspaceId,
          null,
          `Answer ${index + 1}`,
          score,
          input.gradeFromScore(score),
          'feedback',
          null,
          ts,
        ],
      );
    });
  }

  const conservative = seedWorkspace('ws-conservative', 'Conservative');
  insertLearningSet({
    workspaceId: 'ws-conservative',
    conceptTag: 'approval-gated orchestration',
    scores: [22, 30, 35, 40, 28, 33],
    gradeFromScore: () => 'wrong',
  });
  const conservativePacket = buildMemoryPacket({
    workspaceId: 'ws-conservative',
    taskId: conservative.taskId,
  });
  assert.equal(conservativePacket.learning_context?.delegation_mode, 'conservative');
  const conservativeDelegation = delegateTask({
    workspaceId: 'ws-conservative',
    taskId: conservative.taskId,
  });
  assert.equal(conservativeDelegation.selected.id, conservative.strongWorkerId);
  assert.ok(
    conservativeDelegation.scoreReasons.some((reason) => reason.includes('conservative')),
    'Conservative mode reasons missing from delegation rationale',
  );

  const exploratory = seedWorkspace('ws-exploratory', 'Exploratory');
  insertLearningSet({
    workspaceId: 'ws-exploratory',
    conceptTag: 'supervisor delegation scoring',
    scores: [92, 90, 95, 88, 91, 93],
    gradeFromScore: () => 'good',
  });
  const exploratoryPacket = buildMemoryPacket({
    workspaceId: 'ws-exploratory',
    taskId: exploratory.taskId,
  });
  assert.equal(exploratoryPacket.learning_context?.delegation_mode, 'exploratory');
  const exploratoryDelegation = delegateTask({
    workspaceId: 'ws-exploratory',
    taskId: exploratory.taskId,
  });
  assert.equal(exploratoryDelegation.selected.id, exploratory.newWorkerId);
  assert.ok(
    exploratoryDelegation.scoreReasons.some((reason) => reason.includes('exploration boost')),
    'Exploratory mode reasons missing from delegation rationale',
  );

  console.log('Lead learning verification passed.');
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('Lead learning verification failed:', error);
  process.exit(1);
});
