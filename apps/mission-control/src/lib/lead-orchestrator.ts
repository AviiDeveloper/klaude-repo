import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import { buildMemoryPacket, getLearningSignal } from '@/lib/memory/packet';
import { runTaskEvaluation } from '@/lib/evals';
import type { Agent, AgentEvalRun, MemoryPacket, Task } from '@/lib/types';

type LeadQueueStatus = 'intake' | 'triage' | 'delegated' | 'monitoring' | 'awaiting_operator' | 'closed' | 'blocked';
type DelegationStatus = 'delegated' | 'running' | 'completed' | 'failed' | 'blocked';
type FindingStatus = 'new' | 'triaged' | 'approval_requested' | 'resolved';
type ApprovalStatus = 'pending' | 'approved' | 'denied';

export interface LeadQueueItem {
  task_id: string;
  workspace_id: string;
  status: LeadQueueStatus;
  triage_summary?: string | null;
  lead_agent_id: string;
  created_at: string;
  updated_at: string;
  task_title: string;
  task_description?: string | null;
  task_priority: string;
  task_status: string;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  latest_delegation_id?: string | null;
  latest_delegation_status?: string | null;
  latest_eval_status?: 'pass' | 'partial' | 'fail' | null;
  latest_eval_score?: number | null;
  latest_eval_fault?: 'agent_error' | 'input_gap' | 'mixed' | 'unknown' | null;
  latest_eval_at?: string | null;
}

export interface LeadDecisionLogRecord {
  id: string;
  workspace_id: string;
  task_id: string;
  decision_type: string;
  summary: string;
  details_json?: string | null;
  actor_type: string;
  actor_id?: string | null;
  created_at: string;
}

export interface LeadDelegationRecord {
  id: string;
  workspace_id: string;
  task_id: string;
  delegated_by_agent_id: string;
  delegated_to_agent_id: string;
  rationale: string;
  expected_output_contract: string;
  timeout_ms: number;
  retry_limit: number;
  status: DelegationStatus;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
}

interface WorkerScore {
  agent: Agent;
  score: number;
  reasons: string[];
}

interface AgentPerfRow {
  agent_id: string;
  rolling_score: number;
  pass_rate: number;
  failure_rate: number;
  avg_confidence: number;
  samples: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function ensureLeadAgent(workspaceId: string): Agent {
  const masters = queryAll<Agent>(
    `SELECT * FROM agents WHERE workspace_id = ? AND is_master = 1 ORDER BY updated_at DESC, created_at ASC`,
    [workspaceId],
  );

  if (masters.length > 1) {
    const keeper = masters[0];
    for (const duplicate of masters.slice(1)) {
      run('UPDATE agents SET is_master = 0, updated_at = ? WHERE id = ?', [nowIso(), duplicate.id]);
    }
    return keeper;
  }

  if (masters.length === 1) {
    return masters[0];
  }

  const existingCharlie = queryOne<Agent>(
    `SELECT * FROM agents
     WHERE workspace_id = ? AND LOWER(name) = 'charlie'
     ORDER BY created_at ASC
     LIMIT 1`,
    [workspaceId],
  );

  if (existingCharlie) {
    run('UPDATE agents SET is_master = 1, updated_at = ? WHERE id = ?', [nowIso(), existingCharlie.id]);
    return queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [existingCharlie.id]) as Agent;
  }

  const id = uuidv4();
  const now = nowIso();
  run(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      'Charlie',
      'Lead Orchestrator',
      'Lead control plane: intake, delegation, approvals, and operator mediation.',
      '🦞',
      'working',
      1,
      workspaceId,
      now,
      now,
    ],
  );

  run(
    `INSERT INTO events (id, type, agent_id, message, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), 'agent_joined', id, 'Charlie (Lead Orchestrator) initialized', now],
  );

  return queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]) as Agent;
}

export function logLeadDecision(input: {
  workspaceId: string;
  taskId: string;
  decisionType: string;
  summary: string;
  details?: Record<string, unknown>;
  actorType?: 'lead' | 'operator' | 'worker' | 'system';
  actorId?: string;
}): LeadDecisionLogRecord {
  const id = uuidv4();
  const now = nowIso();
  run(
    `INSERT INTO lead_decision_logs
      (id, workspace_id, task_id, decision_type, summary, details_json, actor_type, actor_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      input.taskId,
      input.decisionType,
      input.summary,
      input.details ? JSON.stringify(input.details) : null,
      input.actorType || 'lead',
      input.actorId || null,
      now,
    ],
  );
  return queryOne<LeadDecisionLogRecord>('SELECT * FROM lead_decision_logs WHERE id = ?', [id]) as LeadDecisionLogRecord;
}

export function intakeTask(input: {
  taskId: string;
  workspaceId: string;
  triageSummary?: string;
}): LeadQueueItem {
  const lead = ensureLeadAgent(input.workspaceId);
  const now = nowIso();

  run(
    `INSERT INTO lead_task_intake (task_id, workspace_id, status, triage_summary, lead_agent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET
       status = excluded.status,
       triage_summary = COALESCE(excluded.triage_summary, lead_task_intake.triage_summary),
       lead_agent_id = excluded.lead_agent_id,
       updated_at = excluded.updated_at`,
    [
      input.taskId,
      input.workspaceId,
      'intake',
      input.triageSummary || null,
      lead.id,
      now,
      now,
    ],
  );

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'intake',
    summary: 'Task entered Lead intake queue.',
    details: { lead_agent_id: lead.id },
  });

  run(
    `INSERT INTO events (id, type, task_id, agent_id, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), 'task_created', input.taskId, lead.id, 'Task queued for Lead triage', now],
  );

  const queueItem = queryOne<LeadQueueItem>(
    `SELECT
       li.task_id,
       li.workspace_id,
       li.status,
       li.triage_summary,
       li.lead_agent_id,
       li.created_at,
       li.updated_at,
       t.title as task_title,
       t.description as task_description,
       t.priority as task_priority,
       t.status as task_status,
       t.assigned_agent_id,
       a.name as assigned_agent_name,
       ld.id as latest_delegation_id,
       ld.status as latest_delegation_status,
       er.status as latest_eval_status,
       er.quality_score as latest_eval_score,
       er.fault_attribution as latest_eval_fault,
       er.evaluated_at as latest_eval_at
     FROM lead_task_intake li
     JOIN tasks t ON t.id = li.task_id
     LEFT JOIN agents a ON a.id = t.assigned_agent_id
     LEFT JOIN lead_task_delegations ld ON ld.id = (
       SELECT id
       FROM lead_task_delegations
       WHERE task_id = li.task_id
       ORDER BY created_at DESC
       LIMIT 1
     )
     LEFT JOIN agent_eval_runs er ON er.id = (
       SELECT id
       FROM agent_eval_runs
       WHERE task_id = li.task_id
       ORDER BY evaluated_at DESC
       LIMIT 1
     )
     WHERE li.task_id = ?`,
    [input.taskId],
  );
  return queueItem as LeadQueueItem;
}

export function listLeadQueue(workspaceId: string): LeadQueueItem[] {
  return queryAll<LeadQueueItem>(
    `SELECT
       li.task_id,
       li.workspace_id,
       li.status,
       li.triage_summary,
       li.lead_agent_id,
       li.created_at,
       li.updated_at,
       t.title as task_title,
       t.description as task_description,
       t.priority as task_priority,
       t.status as task_status,
       t.assigned_agent_id,
       a.name as assigned_agent_name,
       ld.id as latest_delegation_id,
       ld.status as latest_delegation_status,
       er.status as latest_eval_status,
       er.quality_score as latest_eval_score,
       er.fault_attribution as latest_eval_fault,
       er.evaluated_at as latest_eval_at
     FROM lead_task_intake li
     JOIN tasks t ON t.id = li.task_id
     LEFT JOIN agents a ON a.id = t.assigned_agent_id
     LEFT JOIN lead_task_delegations ld ON ld.id = (
       SELECT id
       FROM lead_task_delegations
       WHERE task_id = li.task_id
       ORDER BY created_at DESC
       LIMIT 1
     )
     LEFT JOIN agent_eval_runs er ON er.id = (
       SELECT id
       FROM agent_eval_runs
       WHERE task_id = li.task_id
       ORDER BY evaluated_at DESC
       LIMIT 1
     )
     WHERE li.workspace_id = ?
     ORDER BY
       CASE li.status
         WHEN 'awaiting_operator' THEN 0
         WHEN 'intake' THEN 1
         WHEN 'triage' THEN 2
         WHEN 'delegated' THEN 3
         WHEN 'monitoring' THEN 4
         WHEN 'blocked' THEN 5
         ELSE 6
       END ASC,
       li.updated_at DESC`,
    [workspaceId],
  );
}

function computeWorkerScores(task: Task, workspaceId: string, leadAgentId: string): WorkerScore[] {
  const workers = queryAll<Agent>(
    `SELECT * FROM agents
     WHERE workspace_id = ?
       AND is_master = 0
       AND status != 'offline'
     ORDER BY name ASC`,
    [workspaceId],
  );

  const text = slug(`${task.title} ${task.description || ''}`);
  const loadRows = queryAll<{ agent_id: string; active_count: number }>(
    `SELECT assigned_agent_id as agent_id, COUNT(*) as active_count
     FROM tasks
     WHERE workspace_id = ?
       AND assigned_agent_id IS NOT NULL
       AND status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review')
     GROUP BY assigned_agent_id`,
    [workspaceId],
  );
  const loadMap = new Map(loadRows.map((r) => [r.agent_id, r.active_count]));

  const reliabilityRows = queryAll<{ agent_id: string; completed_count: number; failed_tests: number }>(
    `SELECT
       ta.agent_id as agent_id,
       SUM(CASE WHEN ta.activity_type = 'completed' THEN 1 ELSE 0 END) as completed_count,
       SUM(CASE WHEN ta.activity_type = 'test_failed' THEN 1 ELSE 0 END) as failed_tests
     FROM task_activities ta
     JOIN tasks t ON t.id = ta.task_id
     WHERE t.workspace_id = ?
       AND ta.agent_id IS NOT NULL
     GROUP BY ta.agent_id`,
    [workspaceId],
  );
  const reliabilityMap = new Map(reliabilityRows.map((r) => [r.agent_id, r]));
  const performanceRows = queryAll<AgentPerfRow>(
    `SELECT agent_id, rolling_score, pass_rate, failure_rate, avg_confidence, samples
     FROM agent_performance_profiles
     WHERE workspace_id = ?`,
    [workspaceId],
  );
  const performanceMap = new Map(performanceRows.map((r) => [r.agent_id, r]));
  const learningSignal = getLearningSignal(workspaceId);
  const learningMode = learningSignal?.delegation_mode || 'balanced';

  return workers.map((agent) => {
    let score = 0;
    const reasons: string[] = [];
    const role = slug(agent.role);
    const name = slug(agent.name);

    if (text.includes(role) || role.split(' ').some((part) => part && text.includes(part))) {
      score += 40;
      reasons.push(`specialization match: ${agent.role}`);
    } else if (text.includes(name)) {
      score += 20;
      reasons.push(`name mention match: ${agent.name}`);
    } else {
      score += 8;
      reasons.push('generic capability fallback');
    }

    const load = loadMap.get(agent.id) || 0;
    score += Math.max(0, 30 - load * 8);
    reasons.push(`active load: ${load}`);

    const reliability = reliabilityMap.get(agent.id);
    if (reliability) {
      const completed = reliability.completed_count || 0;
      const failed = reliability.failed_tests || 0;
      score += Math.max(-10, Math.min(25, completed * 2 - failed * 3));
      reasons.push(`reliability: completed ${completed}, failed_tests ${failed}`);
    } else {
      score += 10;
      reasons.push('no history: starter bonus');
    }

    const perf = performanceMap.get(agent.id);
    if (perf && perf.samples > 0) {
      const evalWeighted =
        perf.rolling_score * 0.15 +
        perf.pass_rate * 20 +
        (1 - perf.failure_rate) * 10 +
        perf.avg_confidence * 8;
      score += Math.max(-10, Math.min(30, evalWeighted));
      reasons.push(
        `eval profile: score ${perf.rolling_score.toFixed(1)}, pass ${(perf.pass_rate * 100).toFixed(0)}%, samples ${perf.samples}`,
      );
    } else {
      reasons.push('eval profile: no samples yet');
    }

    if (learningMode === 'conservative') {
      if (perf && perf.samples >= 3) {
        score += 10;
        reasons.push('learning mode: conservative -> proven profile boost');
      } else {
        score -= 10;
        reasons.push('learning mode: conservative -> unproven profile penalty');
      }
    } else if (learningMode === 'exploratory') {
      if (perf && perf.samples >= 8) {
        score -= 8;
        reasons.push('learning mode: exploratory -> slight overfit penalty');
      } else {
        score += 18;
        reasons.push('learning mode: exploratory -> exploration boost');
      }
    } else {
      reasons.push('learning mode: balanced');
    }

    if (task.priority === 'urgent' && agent.status === 'working') {
      score += 4;
      reasons.push('already active for urgent turnaround');
    }

    // keep Lead from self-delegating
    if (agent.id === leadAgentId) {
      score = -9999;
      reasons.push('excluded: lead agent');
    }

    return { agent, score, reasons };
  });
}

export function delegateTask(input: {
  taskId: string;
  workspaceId: string;
  delegatedByAgentId?: string;
  delegatedToAgentId?: string;
  rationale?: string;
  expectedOutputContract?: string;
  timeoutMs?: number;
  retryLimit?: number;
}): { delegation: LeadDelegationRecord; selected: Agent; scoreReasons: string[] } {
  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [input.taskId]);
  if (!task) {
    throw new Error('Task not found');
  }

  const lead = ensureLeadAgent(input.workspaceId);
  const scored = computeWorkerScores(task, input.workspaceId, lead.id).sort((a, b) => b.score - a.score);
  let selected = scored[0]?.agent;
  let scoreReasons = scored[0]?.reasons || ['fallback assignment'];

  if (input.delegatedToAgentId) {
    const explicit = queryOne<Agent>(
      `SELECT * FROM agents WHERE id = ? AND workspace_id = ?`,
      [input.delegatedToAgentId, input.workspaceId],
    );
    if (!explicit) {
      throw new Error('delegated_to agent not found in workspace');
    }
    selected = explicit;
    scoreReasons = ['explicit operator/lead override'];
  }

  if (!selected) {
    throw new Error('No eligible worker agents found for delegation.');
  }

  const now = nowIso();
  const delegationId = uuidv4();
  const rationale =
    input.rationale ||
    `Lead selected ${selected.name} based on specialization/load/reliability scoring.`;
  const expectedOutputContract =
    input.expectedOutputContract ||
    'Return structured findings, evidence, risks, and next action recommendations.';
  const timeoutMs = input.timeoutMs ?? 600000;
  const retryLimit = input.retryLimit ?? 1;

  run(
    `INSERT INTO lead_task_delegations
      (id, workspace_id, task_id, delegated_by_agent_id, delegated_to_agent_id, rationale, expected_output_contract, timeout_ms, retry_limit, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      delegationId,
      input.workspaceId,
      input.taskId,
      input.delegatedByAgentId || lead.id,
      selected.id,
      rationale,
      expectedOutputContract,
      timeoutMs,
      retryLimit,
      'delegated',
      now,
      now,
    ],
  );

  run('UPDATE tasks SET assigned_agent_id = ?, status = ?, updated_at = ? WHERE id = ?', [
    selected.id,
    'assigned',
    now,
    input.taskId,
  ]);

  run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
    'delegated',
    now,
    input.taskId,
  ]);

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'delegate',
    summary: `Delegated task to ${selected.name}.`,
    details: {
      selected_agent_id: selected.id,
      selected_agent_name: selected.name,
      rationale,
      score_reasons: scoreReasons,
      expected_output_contract: expectedOutputContract,
      timeout_ms: timeoutMs,
      retry_limit: retryLimit,
    },
    actorType: 'lead',
    actorId: input.delegatedByAgentId || lead.id,
  });

  run(
    `INSERT INTO events (id, type, task_id, agent_id, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      'task_assigned',
      input.taskId,
      selected.id,
      `Lead delegated task "${task.title}" to ${selected.name}`,
      JSON.stringify({ delegated_by: lead.id, score_reasons: scoreReasons }),
      now,
    ],
  );

  const delegation = queryOne<LeadDelegationRecord>(
    'SELECT * FROM lead_task_delegations WHERE id = ?',
    [delegationId],
  ) as LeadDelegationRecord;
  return { delegation, selected, scoreReasons };
}

export function getLatestDelegation(taskId: string): LeadDelegationRecord | undefined {
  return queryOne<LeadDelegationRecord>(
    `SELECT * FROM lead_task_delegations
     WHERE task_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [taskId],
  );
}

export function createFinding(input: {
  workspaceId: string;
  taskId: string;
  agentId: string;
  summary: string;
  evidence?: unknown;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}): { id: string; status: FindingStatus } {
  const id = uuidv4();
  const now = nowIso();
  run(
    `INSERT INTO lead_findings
      (id, workspace_id, task_id, agent_id, summary, evidence_json, risk_level, recommendation, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      input.taskId,
      input.agentId,
      input.summary,
      input.evidence ? JSON.stringify(input.evidence) : null,
      input.riskLevel || 'medium',
      input.recommendation || null,
      'new',
      now,
      now,
    ],
  );

  run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
    'monitoring',
    now,
    input.taskId,
  ]);

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'finding_received',
    summary: `Finding submitted by worker ${input.agentId}.`,
    details: { finding_id: id, risk_level: input.riskLevel || 'medium' },
    actorType: 'worker',
    actorId: input.agentId,
  });

  return { id, status: 'new' };
}

export function evaluateDelegationOutcome(input: {
  workspaceId: string;
  taskId: string;
  agentId: string;
  delegationId?: string;
}): { eval_run: AgentEvalRun; action: 'continue' | 'request_input' | 'retry_candidate' } {
  const delegation =
    (input.delegationId
      ? queryOne<LeadDelegationRecord>('SELECT * FROM lead_task_delegations WHERE id = ?', [input.delegationId])
      : getLatestDelegation(input.taskId)) || undefined;

  const evalRun = runTaskEvaluation({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    agentId: input.agentId,
    delegationId: delegation?.id,
  });

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'evaluation',
    summary: `Eval result ${evalRun.status} (${evalRun.quality_score}) for agent ${input.agentId}.`,
    details: {
      eval_run_id: evalRun.id,
      quality_score: evalRun.quality_score,
      status: evalRun.status,
      confidence: evalRun.confidence,
      fault_attribution: evalRun.fault_attribution,
    },
    actorType: 'lead',
  });

  appendLeadMemoryJournal({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    entryType: 'eval_result',
    content: `Agent ${input.agentId} eval=${evalRun.status} score=${evalRun.quality_score} fault=${evalRun.fault_attribution}`,
    metadata: {
      eval_run_id: evalRun.id,
      confidence: evalRun.confidence,
    },
  });

  const now = nowIso();
  if (evalRun.status === 'fail' && evalRun.fault_attribution === 'input_gap') {
    run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
      'awaiting_operator',
      now,
      input.taskId,
    ]);
    run(
      `INSERT INTO events (id, type, task_id, agent_id, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        'system',
        input.taskId,
        input.agentId,
        'Evaluation indicates input/context gap; operator input required.',
        JSON.stringify({ eval_run_id: evalRun.id, fault: evalRun.fault_attribution }),
        now,
      ],
    );
    return { eval_run: evalRun, action: 'request_input' };
  }

  if (evalRun.status === 'fail') {
    run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
      'blocked',
      now,
      input.taskId,
    ]);
    if (delegation?.id) {
      run(
        'UPDATE lead_task_delegations SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
        ['failed', `quality_gate_fail:${evalRun.quality_score}`, now, delegation.id],
      );
    }
    run(
      `INSERT INTO events (id, type, task_id, agent_id, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        'system',
        input.taskId,
        input.agentId,
        'Evaluation failed quality gate; candidate for retry/reassignment.',
        JSON.stringify({ eval_run_id: evalRun.id, fault: evalRun.fault_attribution }),
        now,
      ],
    );
    return { eval_run: evalRun, action: 'retry_candidate' };
  }

  run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
    'monitoring',
    now,
    input.taskId,
  ]);
  return { eval_run: evalRun, action: 'continue' };
}

export function createApprovalRequest(input: {
  workspaceId: string;
  taskId: string;
  requestedByAgentId: string;
  recommendation: string;
  risks: string[];
  decisionOptions?: string[];
  findingId?: string;
}): { id: string; status: ApprovalStatus } {
  const id = uuidv4();
  const now = nowIso();
  run(
    `INSERT INTO lead_approval_requests
      (id, workspace_id, task_id, finding_id, requested_by_agent_id, recommendation, risks_json, decision_options_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      input.taskId,
      input.findingId || null,
      input.requestedByAgentId,
      input.recommendation,
      JSON.stringify(input.risks || []),
      JSON.stringify(input.decisionOptions || ['approve', 'deny']),
      'pending',
      now,
      now,
    ],
  );

  run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
    'awaiting_operator',
    now,
    input.taskId,
  ]);

  if (input.findingId) {
    run('UPDATE lead_findings SET status = ?, updated_at = ? WHERE id = ?', [
      'approval_requested',
      now,
      input.findingId,
    ]);
  }

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'approval_request',
    summary: 'Lead requested operator decision.',
    details: {
      approval_request_id: id,
      finding_id: input.findingId || null,
      recommendation: input.recommendation,
      risks: input.risks,
    },
  });

  return { id, status: 'pending' };
}

export function resolveApprovalRequest(input: {
  workspaceId: string;
  taskId: string;
  approvalRequestId: string;
  operatorId: string;
  decision: 'approved' | 'denied';
  rationale?: string;
}): { id: string; status: ApprovalStatus } {
  const approval = queryOne<{
    id: string;
    status: ApprovalStatus;
    finding_id?: string | null;
  }>('SELECT id, status, finding_id FROM lead_approval_requests WHERE id = ? AND task_id = ?', [
    input.approvalRequestId,
    input.taskId,
  ]);

  if (!approval) {
    throw new Error('Approval request not found');
  }
  if (approval.status !== 'pending') {
    throw new Error('Approval request already resolved');
  }

  const now = nowIso();
  run(
    `UPDATE lead_approval_requests
     SET status = ?, decision = ?, operator_id = ?, rationale = ?, resolved_at = ?, updated_at = ?
     WHERE id = ?`,
    [input.decision, input.decision, input.operatorId, input.rationale || null, now, now, input.approvalRequestId],
  );

  const findingStatus: FindingStatus = 'resolved';
  if (approval.finding_id) {
    run('UPDATE lead_findings SET status = ?, updated_at = ? WHERE id = ?', [
      findingStatus,
      now,
      approval.finding_id,
    ]);
  }

  run('UPDATE lead_task_intake SET status = ?, updated_at = ? WHERE task_id = ?', [
    input.decision === 'approved' ? 'delegated' : 'blocked',
    now,
    input.taskId,
  ]);

  run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [
    input.decision === 'approved' ? 'assigned' : 'review',
    now,
    input.taskId,
  ]);

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'approval_decision',
    summary: `Operator ${input.decision} approval request.`,
    details: {
      approval_request_id: input.approvalRequestId,
      decision: input.decision,
      rationale: input.rationale || null,
    },
    actorType: 'operator',
    actorId: input.operatorId,
  });

  return { id: input.approvalRequestId, status: input.decision };
}

export function listTaskDecisionLog(taskId: string): LeadDecisionLogRecord[] {
  return queryAll<LeadDecisionLogRecord>(
    `SELECT *
     FROM lead_decision_logs
     WHERE task_id = ?
     ORDER BY created_at DESC`,
    [taskId],
  );
}

export function appendLeadMemoryJournal(input: {
  workspaceId: string;
  taskId?: string;
  decisionId?: string;
  entryType: string;
  content: string;
  metadata?: Record<string, unknown>;
}): void {
  run(
    `INSERT INTO lead_memory_journal
      (id, workspace_id, task_id, decision_id, entry_type, content, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      input.workspaceId,
      input.taskId || null,
      input.decisionId || null,
      input.entryType,
      input.content,
      input.metadata ? JSON.stringify(input.metadata) : null,
      nowIso(),
    ],
  );
}

export function recordLeadOperatorCommand(input: {
  workspaceId: string;
  taskId?: string;
  operatorId: string;
  command: string;
  metadata?: Record<string, unknown>;
}): void {
  run(
    `INSERT INTO lead_operator_commands
      (id, workspace_id, task_id, operator_id, command, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      input.workspaceId,
      input.taskId || null,
      input.operatorId,
      input.command,
      input.metadata ? JSON.stringify(input.metadata) : null,
      nowIso(),
    ],
  );
}

export function listLeadApprovals(workspaceId: string): Array<{
  id: string;
  task_id: string;
  recommendation: string;
  risks: string[];
  status: ApprovalStatus;
  decision?: string | null;
  created_at: string;
  updated_at: string;
}> {
  return queryAll<{
    id: string;
    task_id: string;
    recommendation: string;
    risks_json?: string | null;
    status: ApprovalStatus;
    decision?: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, task_id, recommendation, risks_json, status, decision, created_at, updated_at
     FROM lead_approval_requests
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [workspaceId],
  ).map((row) => ({
    id: row.id,
    task_id: row.task_id,
    recommendation: row.recommendation,
    risks: parseJson<string[]>(row.risks_json, []),
    status: row.status,
    decision: row.decision || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

function collectAgentPerformance(workspaceId: string): Array<{
  agent_id: string;
  name: string;
  role: string;
  active_load: number;
  completed_updates: number;
  failed_tests: number;
}> {
  const workers = queryAll<Agent>(
    `SELECT * FROM agents WHERE workspace_id = ? AND is_master = 0 ORDER BY name ASC`,
    [workspaceId],
  );

  const loadRows = queryAll<{ agent_id: string; active_load: number }>(
    `SELECT assigned_agent_id as agent_id, COUNT(*) as active_load
     FROM tasks
     WHERE workspace_id = ?
       AND assigned_agent_id IS NOT NULL
       AND status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review')
     GROUP BY assigned_agent_id`,
    [workspaceId],
  );
  const loadMap = new Map(loadRows.map((row) => [row.agent_id, row.active_load]));

  const perfRows = queryAll<{ agent_id: string; completed_updates: number; failed_tests: number }>(
    `SELECT
       ta.agent_id as agent_id,
       SUM(CASE WHEN ta.activity_type = 'completed' THEN 1 ELSE 0 END) as completed_updates,
       SUM(CASE WHEN ta.activity_type = 'test_failed' THEN 1 ELSE 0 END) as failed_tests
     FROM task_activities ta
     JOIN tasks t ON t.id = ta.task_id
     WHERE t.workspace_id = ?
       AND ta.agent_id IS NOT NULL
     GROUP BY ta.agent_id`,
    [workspaceId],
  );
  const perfMap = new Map(perfRows.map((row) => [row.agent_id, row]));

  return workers.map((agent) => ({
    agent_id: agent.id,
    name: agent.name,
    role: agent.role,
    active_load: loadMap.get(agent.id) || 0,
    completed_updates: perfMap.get(agent.id)?.completed_updates || 0,
    failed_tests: perfMap.get(agent.id)?.failed_tests || 0,
  }));
}

function collectOpenBlockers(workspaceId: string): Array<{ task_id: string; title: string; status: string }> {
  return queryAll<{ task_id: string; title: string; status: string }>(
    `SELECT t.id as task_id, t.title, t.status
     FROM tasks t
     LEFT JOIN lead_task_intake li ON li.task_id = t.id
     WHERE t.workspace_id = ?
       AND (
         t.status IN ('review', 'testing')
         OR li.status IN ('blocked', 'awaiting_operator')
       )
     ORDER BY t.updated_at DESC
     LIMIT 20`,
    [workspaceId],
  );
}

export function buildLeadMemoryPacket(input: {
  workspaceId: string;
  taskId?: string;
}): MemoryPacket & {
  lead_context: {
    performance: Array<{
      agent_id: string;
      name: string;
      role: string;
      active_load: number;
      completed_updates: number;
      failed_tests: number;
    }>;
    open_blockers: Array<{ task_id: string; title: string; status: string }>;
    recent_decisions: LeadDecisionLogRecord[];
  };
} {
  const base = buildMemoryPacket({ workspaceId: input.workspaceId, taskId: input.taskId });
  const recentDecisions = queryAll<LeadDecisionLogRecord>(
    `SELECT *
     FROM lead_decision_logs
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 40`,
    [input.workspaceId],
  );

  return {
    ...base,
    lead_context: {
      performance: collectAgentPerformance(input.workspaceId),
      open_blockers: collectOpenBlockers(input.workspaceId),
      recent_decisions: recentDecisions,
    },
  };
}

// ---------------------------------------------------------------------------
// LLM-enhanced delegation (uses charlie-brain for intelligent agent selection)
// ---------------------------------------------------------------------------

export async function intelligentDelegateTask(input: {
  taskId: string;
  workspaceId: string;
  subtaskDescription?: string;
}): Promise<{
  delegation: LeadDelegationRecord;
  selected: Agent;
  scoreReasons: string[];
  llmRationale?: string;
}> {
  // Dynamic import to avoid circular dependency at module load time
  const { selectAgentForSubtask } = await import('@/lib/charlie-brain');

  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [input.taskId]);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);

  const lead = ensureLeadAgent(input.workspaceId);
  const scores = computeWorkerScores(task, input.workspaceId, lead.id);

  if (scores.length === 0) {
    throw new Error('No worker agents available for delegation');
  }

  // Use LLM to enhance selection
  const llmSelection = await selectAgentForSubtask(
    {
      title: task.title,
      description: input.subtaskDescription || task.description || task.title,
      requiredSkills: [],
      estimatedComplexity: 'medium',
      dependencies: [],
    },
    scores,
  );

  // Delegate using the LLM-selected agent (or fallback to score-based)
  const targetAgentId = llmSelection.agentId || scores[0].agent.id;

  const result = delegateTask({
    taskId: input.taskId,
    workspaceId: input.workspaceId,
    delegatedToAgentId: targetAgentId,
    rationale: llmSelection.rationale,
  });

  // Log the LLM decision
  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'intelligent_delegation',
    summary: `LLM-enhanced delegation to ${result.selected.name}: ${llmSelection.rationale}`,
    details: {
      llmConfidence: llmSelection.confidence,
      fallbackAgentId: llmSelection.fallbackAgentId,
      topScores: scores.slice(0, 3).map((s) => ({ agent: s.agent.name, score: s.score })),
    },
    actorType: 'lead',
    actorId: lead.id,
  });

  return {
    ...result,
    llmRationale: llmSelection.rationale,
  };
}

export async function handleDelegationFailure(input: {
  workspaceId: string;
  taskId: string;
  delegationId: string;
  failureReason: string;
  evalSummary?: string;
}): Promise<{
  action: string;
  rationale: string;
}> {
  const { generateRecoveryPlan } = await import('@/lib/charlie-brain');

  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [input.taskId]);
  if (!task) throw new Error(`Task not found: ${input.taskId}`);

  const plan = await generateRecoveryPlan(task, input.failureReason, input.evalSummary);

  logLeadDecision({
    workspaceId: input.workspaceId,
    taskId: input.taskId,
    decisionType: 'recovery_plan',
    summary: `Recovery: ${plan.action} — ${plan.rationale}`,
    details: { plan, failureReason: input.failureReason },
    actorType: 'lead',
  });

  // Execute recovery action
  switch (plan.action) {
    case 'retry_same': {
      // Re-delegate to same agent
      const delegation = queryOne<LeadDelegationRecord>(
        'SELECT * FROM lead_task_delegations WHERE id = ?',
        [input.delegationId],
      );
      if (delegation) {
        delegateTask({
          taskId: input.taskId,
          workspaceId: input.workspaceId,
          delegatedToAgentId: delegation.delegated_to_agent_id,
          rationale: `Retry: ${plan.rationale}`,
        });
      }
      break;
    }
    case 'reassign': {
      // Delegate to a different agent via intelligent selection
      await intelligentDelegateTask({
        taskId: input.taskId,
        workspaceId: input.workspaceId,
        subtaskDescription: plan.modifiedInstructions,
      });
      break;
    }
    case 'escalate': {
      // Update intake status to awaiting_operator
      run(
        `UPDATE lead_task_intake SET status = 'awaiting_operator', updated_at = ? WHERE task_id = ?`,
        [nowIso(), input.taskId],
      );
      break;
    }
    case 'modify_task': {
      // Update task description with modified instructions
      if (plan.modifiedInstructions) {
        run(
          `UPDATE tasks SET description = ?, updated_at = ? WHERE id = ?`,
          [plan.modifiedInstructions, nowIso(), input.taskId],
        );
      }
      break;
    }
  }

  return { action: plan.action, rationale: plan.rationale };
}
