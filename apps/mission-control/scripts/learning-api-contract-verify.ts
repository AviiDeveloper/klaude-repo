import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-learning-api-contract-'));
  const dbPath = path.join(tmpDir, 'mission-control.learning-api.sqlite');
  process.env.DATABASE_PATH = dbPath;

  const dbMod = await import('../src/lib/db/index');
  const generateRoute = await import('../src/app/api/learning/questions/generate/route');
  const answerRoute = await import('../src/app/api/learning/questions/[id]/answer/route');
  const memoryRoute = await import('../src/app/api/memory/packet/route');
  const { run, closeDb } = dbMod;

  const now = new Date().toISOString();
  run(
    `INSERT OR IGNORE INTO workspaces (id, name, slug, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['default', 'Default Workspace', 'default', '🏠', now, now],
  );
  run(
    `INSERT OR IGNORE INTO agents (id, name, role, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['lead-contract', 'Charlie', 'Lead Orchestrator', '🦞', 'working', 1, 'default', now, now],
  );
  run(
    `INSERT OR IGNORE INTO tasks (id, title, description, status, priority, workspace_id, business_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'task-contract',
      'learning contract smoke',
      'ensure learning response payload keeps compatibility and wrapper',
      'planning',
      'normal',
      'default',
      'default',
      now,
      now,
    ],
  );
  run(
    `INSERT INTO lead_decision_logs (id, workspace_id, task_id, decision_type, summary, actor_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'decision-contract',
      'default',
      'task-contract',
      'delegate',
      'Delegated for contract verification',
      'lead',
      now,
    ],
  );

  const generateReq = new NextRequest('http://localhost/api/learning/questions/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspace_id: 'default', source_type: 'decision_log' }),
  });
  const generateRes = await generateRoute.POST(generateReq);
  assert.equal(generateRes.status, 201);
  const generatePayload = (await generateRes.json()) as {
    id?: string;
    question_record?: { id?: string; question?: string };
    question?: { id?: string; question?: string };
  };
  assert.ok(generatePayload.id, 'generate payload missing top-level id');
  const nestedQuestion = generatePayload.question_record || generatePayload.question;
  assert.ok(nestedQuestion?.id, 'generate payload missing nested question record id');
  assert.equal(generatePayload.id, nestedQuestion?.id, 'generate payload id mismatch');
  const questionId = generatePayload.id as string;

  const answerReq = new NextRequest(`http://localhost/api/learning/questions/${questionId}/answer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      workspace_id: 'default',
      answer_text:
        'Delegation scoring should combine specialization, load, and reliability to avoid random assignments and quality regressions.',
    }),
  });
  const answerRes = await answerRoute.POST(answerReq, {
    params: Promise.resolve({ id: questionId }),
  });
  assert.equal(answerRes.status, 201);
  const answerPayload = (await answerRes.json()) as {
    id?: string;
    result_record?: { id?: string; grade?: string; score?: number };
    result?: { id?: string; grade?: string; score?: number };
    grade?: string;
    score?: number;
    confidence?: number;
    coverage_score?: number;
    reasoning_score?: number;
    scorer_flags?: Record<string, unknown>;
    learning_signal?: { trust_state?: string; tuning_enabled?: boolean };
  };
  const nestedResult = answerPayload.result_record || answerPayload.result;
  assert.ok(answerPayload.id, 'answer payload missing top-level id');
  assert.ok(nestedResult?.id, 'answer payload missing nested result id');
  assert.equal(answerPayload.id, nestedResult?.id, 'answer payload id mismatch');
  assert.equal(answerPayload.grade, nestedResult?.grade, 'answer payload grade mismatch');
  assert.equal(answerPayload.score, nestedResult?.score, 'answer payload score mismatch');
  assert.equal(typeof answerPayload.confidence, 'number', 'answer payload confidence missing');
  assert.equal(typeof answerPayload.coverage_score, 'number', 'answer payload coverage_score missing');
  assert.equal(typeof answerPayload.reasoning_score, 'number', 'answer payload reasoning_score missing');
  assert.equal(typeof answerPayload.scorer_flags, 'object', 'answer payload scorer_flags missing');
  assert.ok(answerPayload.learning_signal?.trust_state, 'answer payload trust_state missing');
  assert.equal(typeof answerPayload.learning_signal?.tuning_enabled, 'boolean', 'answer payload tuning_enabled missing');

  const packetReq = new NextRequest('http://localhost/api/memory/packet?workspace_id=default');
  const packetRes = await memoryRoute.GET(packetReq);
  assert.equal(packetRes.status, 200);
  const packetPayload = (await packetRes.json()) as {
    packet?: {
      learning_context?: {
        avg_confidence?: number;
        trust_state?: string;
        tuning_enabled?: boolean;
        trust_reasons?: string[];
      } | null;
    };
  };
  assert.ok(packetPayload.packet?.learning_context, 'memory packet learning_context missing');
  assert.equal(
    typeof packetPayload.packet?.learning_context?.avg_confidence,
    'number',
    'learning_context avg_confidence missing',
  );
  assert.ok(packetPayload.packet?.learning_context?.trust_state, 'learning_context trust_state missing');
  assert.equal(
    typeof packetPayload.packet?.learning_context?.tuning_enabled,
    'boolean',
    'learning_context tuning_enabled missing',
  );
  assert.ok(
    Array.isArray(packetPayload.packet?.learning_context?.trust_reasons),
    'learning_context trust_reasons missing',
  );

  console.log('Learning API contract verification passed.');
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('Learning API contract verification failed:', error);
  process.exit(1);
});
