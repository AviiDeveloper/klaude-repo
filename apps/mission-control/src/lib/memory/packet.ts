import { queryAll, queryOne } from '@/lib/db';
import type { Agent, MemoryPacket, OperatorProfile, Task, Workspace } from '@/lib/types';

interface BuildMemoryPacketParams {
  workspaceId?: string;
  taskId?: string;
  agentId?: string;
}

type LearningAnswerRow = {
  score: number;
  grade: 'good' | 'partial' | 'wrong';
  concept_tag?: string | null;
};

function round(value: number): number {
  return Number(value.toFixed(2));
}

function getLearningTrend(scoresNewestFirst: number[]): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
  if (scoresNewestFirst.length < 4) return 'insufficient_data';
  const split = Math.floor(scoresNewestFirst.length / 2);
  if (split < 2) return 'insufficient_data';
  const recent = scoresNewestFirst.slice(0, split);
  const older = scoresNewestFirst.slice(split);
  const recentAvg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
  const olderAvg = older.reduce((sum, score) => sum + score, 0) / older.length;
  const delta = recentAvg - olderAvg;
  if (delta >= 8) return 'improving';
  if (delta <= -8) return 'declining';
  return 'stable';
}

export function getLearningSignal(workspaceId: string): MemoryPacket['learning_context'] {
  const answers = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM learning_answers
     WHERE workspace_id = ?`,
    [workspaceId],
  )?.count;

  if (!answers || answers < 1) {
    return null;
  }

  const learningRows = queryAll<LearningAnswerRow>(
    `SELECT a.score, a.grade, q.concept_tag
     FROM learning_answers a
     LEFT JOIN learning_questions q ON q.id = a.question_id
     WHERE a.workspace_id = ?
     ORDER BY a.created_at DESC
     LIMIT 12`,
    [workspaceId],
  );

  const sampleCount = learningRows.length;
  const scores = learningRows.map((row) => row.score);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / sampleCount;
  const latestScore = sampleCount > 0 ? learningRows[0].score : null;
  const goodCount = learningRows.filter((row) => row.grade === 'good').length;
  const partialCount = learningRows.filter((row) => row.grade === 'partial').length;
  const wrongCount = learningRows.filter((row) => row.grade === 'wrong').length;
  const goodRate = goodCount / sampleCount;
  const partialRate = partialCount / sampleCount;
  const wrongRate = wrongCount / sampleCount;
  const trend = getLearningTrend(scores);

  let delegationMode: 'conservative' | 'balanced' | 'exploratory' = 'balanced';
  if (sampleCount >= 3) {
    if (avgScore < 55 || wrongRate >= 0.5 || trend === 'declining') {
      delegationMode = 'conservative';
    } else if (avgScore >= 80 && goodRate >= 0.6) {
      delegationMode = 'exploratory';
    }
  }

  let coachingFocus = 'Keep balanced delegation and include explicit rationale in operator updates.';
  if (delegationMode === 'conservative') {
    coachingFocus = 'Favor proven workers and request tighter evidence before side-effect approvals.';
  } else if (delegationMode === 'exploratory') {
    coachingFocus = 'Introduce controlled experimentation and capture lessons in lead memory journal.';
  }

  const latestConcept = learningRows.find((row) => row.concept_tag)?.concept_tag || null;

  return {
    sample_count: answers,
    recent_answer_count: sampleCount,
    avg_score: round(avgScore),
    latest_score: latestScore,
    good_rate: round(goodRate),
    partial_rate: round(partialRate),
    wrong_rate: round(wrongRate),
    trend,
    delegation_mode: delegationMode,
    coaching_focus: coachingFocus,
    latest_concept_tag: latestConcept,
  };
}

export function buildMemoryPacket(params: BuildMemoryPacketParams): MemoryPacket {
  const workspaceId = params.workspaceId || 'default';

  const operator = queryOne<OperatorProfile>(
    'SELECT * FROM operator_profiles WHERE workspace_id = ?',
    [workspaceId],
  );
  const workspace = queryOne<Workspace>('SELECT * FROM workspaces WHERE id = ?', [workspaceId]);
  const task = params.taskId
    ? queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [params.taskId])
    : null;
  const agent = params.agentId
    ? queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [params.agentId])
    : null;
  const learning = getLearningSignal(workspaceId);

  return {
    workspace_id: workspaceId,
    operator_profile: operator
      ? {
          operator_name: operator.operator_name || undefined,
          identity_summary: operator.identity_summary || undefined,
          strategic_goals: operator.strategic_goals || undefined,
          communication_preferences: operator.communication_preferences || undefined,
          approval_preferences: operator.approval_preferences || undefined,
          risk_preferences: operator.risk_preferences || undefined,
          budget_preferences: operator.budget_preferences || undefined,
          schedule_preferences: operator.schedule_preferences || undefined,
          tool_preferences: operator.tool_preferences || undefined,
          escalation_preferences: operator.escalation_preferences || undefined,
          memory_notes: operator.memory_notes || undefined,
        }
      : null,
    workspace_context: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        }
      : null,
    task_context: task
      ? {
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          priority: task.priority,
          status: task.status,
          due_date: task.due_date || undefined,
        }
      : null,
    agent_context: agent
      ? {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
        }
      : null,
    learning_context: learning,
  };
}

export function formatMemoryPacketForPrompt(packet: MemoryPacket): string {
  const lines: string[] = [];
  lines.push('**OPERATOR MEMORY PACKET**');

  if (packet.operator_profile) {
    const p = packet.operator_profile;
    if (p.operator_name) lines.push(`- Operator: ${p.operator_name}`);
    if (p.identity_summary) lines.push(`- Identity: ${p.identity_summary}`);
    if (p.strategic_goals) lines.push(`- Strategic goals: ${p.strategic_goals}`);
    if (p.communication_preferences) lines.push(`- Communication preferences: ${p.communication_preferences}`);
    if (p.approval_preferences) lines.push(`- Approval preferences: ${p.approval_preferences}`);
    if (p.risk_preferences) lines.push(`- Risk preferences: ${p.risk_preferences}`);
    if (p.budget_preferences) lines.push(`- Budget preferences: ${p.budget_preferences}`);
    if (p.schedule_preferences) lines.push(`- Schedule preferences: ${p.schedule_preferences}`);
    if (p.tool_preferences) lines.push(`- Tool preferences: ${p.tool_preferences}`);
    if (p.escalation_preferences) lines.push(`- Escalation preferences: ${p.escalation_preferences}`);
    if (p.memory_notes) lines.push(`- Notes: ${p.memory_notes}`);
  } else {
    lines.push('- No operator profile set yet.');
  }

  if (packet.workspace_context) {
    lines.push(`- Workspace: ${packet.workspace_context.name} (${packet.workspace_context.slug})`);
  }
  if (packet.task_context) {
    lines.push(`- Task context: ${packet.task_context.title} [${packet.task_context.priority}]`);
  }
  if (packet.agent_context) {
    lines.push(`- Agent context: ${packet.agent_context.name} (${packet.agent_context.role})`);
  }
  if (packet.learning_context) {
    const learning = packet.learning_context;
    lines.push(
      `- Learning signal: mode=${learning.delegation_mode}, avg_score=${learning.avg_score}, trend=${learning.trend}, samples=${learning.recent_answer_count}`,
    );
    lines.push(`- Learning coaching focus: ${learning.coaching_focus}`);
    if (learning.latest_concept_tag) {
      lines.push(`- Latest learning concept: ${learning.latest_concept_tag}`);
    }
  } else {
    lines.push('- Learning signal: none yet (default balanced delegation).');
  }

  lines.push('- Apply this memory context to decisions and reporting style.');
  return lines.join('\n');
}
