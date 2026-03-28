import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import type {
  AgentEvalRun,
  AgentEvalSpec,
  AgentPerformanceProfile,
  EvalFaultAttribution,
  EvalStatus,
} from '@/lib/types';

interface EvalSignal {
  deliverableCount: number;
  findingCount: number;
  evidenceCount: number;
  activityCount: number;
  hasTaskDescription: boolean;
}

function safeParseArray(value: string | null | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function statusFromScore(score: number): EvalStatus {
  if (score >= 75) return 'pass';
  if (score >= 45) return 'partial';
  return 'fail';
}

function attributionFromSignals(status: EvalStatus, signals: EvalSignal): EvalFaultAttribution {
  if (status === 'pass') return 'unknown';
  if (!signals.hasTaskDescription) return 'input_gap';
  if (signals.deliverableCount === 0 && signals.findingCount === 0) return 'agent_error';
  if (signals.deliverableCount === 0 && signals.findingCount > 0) return 'mixed';
  return 'agent_error';
}

export function listEvalSpecs(workspaceId: string, agentId?: string): AgentEvalSpec[] {
  if (agentId) {
    return queryAll<AgentEvalSpec>(
      `SELECT * FROM agent_eval_specs
       WHERE workspace_id = ? AND (agent_id = ? OR agent_id IS NULL)
       ORDER BY task_type ASC, version DESC`,
      [workspaceId, agentId],
    );
  }

  return queryAll<AgentEvalSpec>(
    `SELECT * FROM agent_eval_specs
     WHERE workspace_id = ?
     ORDER BY task_type ASC, version DESC`,
    [workspaceId],
  );
}

export function getEvalSpecById(id: string): AgentEvalSpec | undefined {
  return queryOne<AgentEvalSpec>('SELECT * FROM agent_eval_specs WHERE id = ?', [id]);
}

export function createEvalSpec(input: {
  workspaceId: string;
  agentId?: string | null;
  taskType: string;
  criteria: unknown;
  rubric: unknown;
}): AgentEvalSpec {
  const now = new Date().toISOString();
  const id = uuidv4();

  const latest = queryOne<{ version: number }>(
    `SELECT version FROM agent_eval_specs
     WHERE workspace_id = ? AND task_type = ? AND ((agent_id IS NULL AND ? IS NULL) OR agent_id = ?)
     ORDER BY version DESC
     LIMIT 1`,
    [input.workspaceId, input.taskType, input.agentId ?? null, input.agentId ?? null],
  );
  const version = (latest?.version ?? 0) + 1;

  run(
    `INSERT INTO agent_eval_specs
      (id, workspace_id, agent_id, task_type, version, criteria_json, rubric_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      input.agentId ?? null,
      input.taskType,
      version,
      JSON.stringify(input.criteria ?? {}),
      JSON.stringify(input.rubric ?? {}),
      now,
      now,
    ],
  );

  return queryOne<AgentEvalSpec>('SELECT * FROM agent_eval_specs WHERE id = ?', [id]) as AgentEvalSpec;
}

export function updateEvalSpec(id: string, input: {
  taskType?: string;
  criteria?: unknown;
  rubric?: unknown;
}): AgentEvalSpec | undefined {
  const existing = getEvalSpecById(id);
  if (!existing) return undefined;

  run(
    `UPDATE agent_eval_specs
     SET task_type = ?, criteria_json = ?, rubric_json = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.taskType || existing.task_type,
      input.criteria ? JSON.stringify(input.criteria) : existing.criteria_json,
      input.rubric ? JSON.stringify(input.rubric) : existing.rubric_json,
      new Date().toISOString(),
      id,
    ],
  );
  return getEvalSpecById(id);
}

export function listTaskEvalRuns(taskId: string): AgentEvalRun[] {
  return queryAll<AgentEvalRun>(
    `SELECT * FROM agent_eval_runs WHERE task_id = ? ORDER BY evaluated_at DESC`,
    [taskId],
  );
}

export function getAgentPerformanceProfile(agentId: string): AgentPerformanceProfile | undefined {
  return queryOne<AgentPerformanceProfile>(
    `SELECT * FROM agent_performance_profiles WHERE agent_id = ?`,
    [agentId],
  );
}

function refreshAgentPerformanceProfile(workspaceId: string, agentId: string): AgentPerformanceProfile {
  const runs = queryAll<{
    quality_score: number;
    confidence: number;
    status: EvalStatus;
    fault_attribution: EvalFaultAttribution;
  }>(
    `SELECT quality_score, confidence, status, fault_attribution
     FROM agent_eval_runs
     WHERE workspace_id = ? AND agent_id = ?
     ORDER BY evaluated_at DESC
     LIMIT 30`,
    [workspaceId, agentId],
  );

  const samples = runs.length;
  const rollingScore = samples === 0 ? 0 : runs.reduce((acc, item) => acc + item.quality_score, 0) / samples;
  const avgConfidence = samples === 0 ? 0 : runs.reduce((acc, item) => acc + item.confidence, 0) / samples;
  const passRate = samples === 0 ? 0 : runs.filter((item) => item.status === 'pass').length / samples;
  const failureRate = samples === 0 ? 0 : runs.filter((item) => item.status === 'fail').length / samples;
  const inputGapRate = samples === 0 ? 0 : runs.filter((item) => item.fault_attribution === 'input_gap').length / samples;
  const now = new Date().toISOString();

  run(
    `INSERT INTO agent_performance_profiles
      (agent_id, workspace_id, rolling_score, pass_rate, failure_rate, input_gap_rate, avg_confidence, samples, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET
      workspace_id = excluded.workspace_id,
      rolling_score = excluded.rolling_score,
      pass_rate = excluded.pass_rate,
      failure_rate = excluded.failure_rate,
      input_gap_rate = excluded.input_gap_rate,
      avg_confidence = excluded.avg_confidence,
      samples = excluded.samples,
      updated_at = excluded.updated_at`,
    [agentId, workspaceId, rollingScore, passRate, failureRate, inputGapRate, avgConfidence, samples, now],
  );

  return queryOne<AgentPerformanceProfile>(
    `SELECT * FROM agent_performance_profiles WHERE agent_id = ?`,
    [agentId],
  ) as AgentPerformanceProfile;
}

function buildEvalSignals(taskId: string): EvalSignal {
  const task = queryOne<{ description?: string | null }>('SELECT description FROM tasks WHERE id = ?', [taskId]);
  const deliverableCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM task_deliverables WHERE task_id = ?',
    [taskId],
  )?.count ?? 0;
  const findingRows = queryAll<{ evidence_json?: string | null }>(
    'SELECT evidence_json FROM lead_findings WHERE task_id = ?',
    [taskId],
  );
  const activityCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM task_activities WHERE task_id = ?',
    [taskId],
  )?.count ?? 0;

  const evidenceCount = findingRows.reduce((acc, row) => acc + safeParseArray(row.evidence_json).length, 0);

  return {
    deliverableCount,
    findingCount: findingRows.length,
    evidenceCount,
    activityCount,
    hasTaskDescription: Boolean(task?.description && task.description.trim().length >= 20),
  };
}

export function runTaskEvaluation(input: {
  workspaceId: string;
  taskId: string;
  agentId: string;
  delegationId?: string;
  evalSpecId?: string;
}): AgentEvalRun {
  const id = uuidv4();
  const now = new Date().toISOString();
  const signals = buildEvalSignals(input.taskId);

  let score = 10;
  const reasonCodes: string[] = [];

  if (signals.deliverableCount > 0) {
    score += Math.min(40, signals.deliverableCount * 20);
    reasonCodes.push('deliverables_present');
  } else {
    reasonCodes.push('no_deliverables');
  }

  if (signals.findingCount > 0) {
    score += Math.min(20, signals.findingCount * 8);
    reasonCodes.push('findings_reported');
  } else {
    reasonCodes.push('no_findings');
  }

  if (signals.evidenceCount > 0) {
    score += Math.min(20, signals.evidenceCount * 5);
    reasonCodes.push('evidence_attached');
  } else {
    reasonCodes.push('no_evidence');
  }

  if (signals.activityCount >= 3) {
    score += 10;
    reasonCodes.push('execution_trace_present');
  } else {
    reasonCodes.push('thin_execution_trace');
  }

  if (!signals.hasTaskDescription) {
    score -= 10;
    reasonCodes.push('input_context_weak');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = statusFromScore(score);
  const faultAttribution = attributionFromSignals(status, signals);
  const confidence = Math.max(0.35, Math.min(0.95, Number((0.45 + (signals.evidenceCount * 0.08) + (signals.deliverableCount * 0.06)).toFixed(2))));

  const summary =
    status === 'pass'
      ? 'Agent output met core quality criteria.'
      : status === 'partial'
      ? 'Agent output is usable but below professional bar in at least one dimension.'
      : 'Agent output failed minimum quality bar and requires retry/rework.';

  const details = {
    signals,
    scoring: {
      score,
      status,
      confidence,
      reason_codes: reasonCodes,
    },
  };

  run(
    `INSERT INTO agent_eval_runs
      (id, workspace_id, task_id, delegation_id, agent_id, eval_spec_id, quality_score, status, confidence, fault_attribution, reason_codes_json, summary, details_json, evaluated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      input.taskId,
      input.delegationId ?? null,
      input.agentId,
      input.evalSpecId ?? null,
      score,
      status,
      confidence,
      faultAttribution,
      JSON.stringify(reasonCodes),
      summary,
      JSON.stringify(details),
      now,
    ],
  );

  const runRow = queryOne<AgentEvalRun>('SELECT * FROM agent_eval_runs WHERE id = ?', [id]) as AgentEvalRun;
  refreshAgentPerformanceProfile(input.workspaceId, input.agentId);

  // Fire-and-forget: index eval into memory system
  try {
    const evalText = `Evaluation of agent ${input.agentId}: score=${score} status=${status} fault=${faultAttribution} reasons=${reasonCodes.join(',')}`;
    const tags = JSON.stringify({
      agent_id: input.agentId,
      task_type: 'evaluation',
      outcome: status === 'pass' ? 'success' : status === 'partial' ? 'partial' : 'fail',
      concepts: reasonCodes,
    });
    run(
      `INSERT OR IGNORE INTO memory_documents
        (id, workspace_id, agent_id, source_type, source_id, routing_keys_json, tags_json, tier, compressed_content, full_content, relevance_decay, created_at, updated_at)
       VALUES (?, ?, ?, 'eval', ?, '[]', ?, 'detailed', ?, ?, 1.0, ?, ?)`,
      [id, input.workspaceId, input.agentId, id, tags, summary, evalText, now, now],
    );
    try {
      run(
        `INSERT INTO memory_fts (rowid, routing_text, compressed_text)
         VALUES ((SELECT rowid FROM memory_documents WHERE id = ?), ?, ?)`,
        [id, evalText, summary],
      );
    } catch { /* FTS table may not exist yet */ }
  } catch { /* Memory indexing is optional */ }

  return runRow;
}
