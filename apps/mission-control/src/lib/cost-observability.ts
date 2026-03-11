import { queryAll, queryOne } from '@/lib/db';

export interface CostActionEstimate {
  action_key: string;
  label: string;
  count: number;
  unit_cost_usd: number;
  estimated_cost_usd: number;
  description: string;
}

export interface ActualCostBreakdown {
  provider: string;
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface AgentCostSummary {
  agent_id: string;
  agent_name: string;
  role: string;
  workspace_id: string;
  estimated_total_usd: number;
  actual_total_usd: number;
  delta_usd: number;
  action_breakdown: CostActionEstimate[];
  actual_breakdown: ActualCostBreakdown[];
}

export interface WorkspaceCostSummary {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  estimated_total_usd: number;
  actual_total_usd: number;
  delta_usd: number;
  task_count: number;
  agent_count: number;
  action_breakdown: CostActionEstimate[];
  actual_breakdown: ActualCostBreakdown[];
}

export interface CostOverview {
  generated_at: string;
  disclaimer: string;
  actual_disclaimer: string;
  total_estimated_usd: number;
  total_actual_usd: number;
  total_delta_usd: number;
  workspace_summaries: WorkspaceCostSummary[];
  agent_summaries: AgentCostSummary[];
}

type CostRule = {
  key: string;
  label: string;
  unit_cost_usd: number;
  description: string;
  workspaceCount: (workspaceId: string) => number;
  agentCount: (agentId: string, workspaceId?: string) => number;
};

const COST_RULES: CostRule[] = [
  {
    key: 'planning_sessions',
    label: 'Planning sessions',
    unit_cost_usd: 0.045,
    description: 'Estimated cost to open a planning turn with OpenClaw and generate/continue planning prompts.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM tasks
            WHERE workspace_id = ?
              AND planning_session_key IS NOT NULL
              AND TRIM(planning_session_key) != ''`,
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: (agentId, workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM tasks
            WHERE assigned_agent_id = ?
              ${workspaceId ? 'AND workspace_id = ?' : ''}
              AND planning_session_key IS NOT NULL
              AND TRIM(planning_session_key) != ''`,
          workspaceId ? [agentId, workspaceId] : [agentId],
        )?.count || 0,
      ),
  },
  {
    key: 'lead_delegations',
    label: 'Lead delegations',
    unit_cost_usd: 0.028,
    description: 'Estimated orchestration reasoning cost used by Lead when triaging and assigning work.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          'SELECT COUNT(*) AS count FROM lead_task_delegations WHERE workspace_id = ?',
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: (agentId, workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM lead_task_delegations
            WHERE delegated_to_agent_id = ?
              ${workspaceId ? 'AND workspace_id = ?' : ''}`,
          workspaceId ? [agentId, workspaceId] : [agentId],
        )?.count || 0,
      ),
  },
  {
    key: 'progress_requests',
    label: 'Progress requests',
    unit_cost_usd: 0.012,
    description: 'Estimated cost of a lightweight “what are you doing now?” progress update round-trip.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM task_activities ta
             JOIN tasks t ON t.id = ta.task_id
            WHERE t.workspace_id = ?
              AND ta.message LIKE 'Progress update requested%'`,
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: (agentId, workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM task_activities ta
             JOIN tasks t ON t.id = ta.task_id
            WHERE ta.agent_id = ?
              ${workspaceId ? 'AND t.workspace_id = ?' : ''}
              AND ta.message LIKE 'Progress update requested%'`,
          workspaceId ? [agentId, workspaceId] : [agentId],
        )?.count || 0,
      ),
  },
  {
    key: 'learning_questions',
    label: 'Learning questions',
    unit_cost_usd: 0.021,
    description: 'Estimated cost to generate architecture/self-improvement questions for Charlie learning.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          'SELECT COUNT(*) AS count FROM learning_questions WHERE workspace_id = ?',
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: () => 0,
  },
  {
    key: 'learning_scoring',
    label: 'Learning scoring',
    unit_cost_usd: 0.009,
    description: 'Estimated cost to score a learning answer and update the learning signal.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          'SELECT COUNT(*) AS count FROM learning_answers WHERE workspace_id = ?',
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: () => 0,
  },
  {
    key: 'agent_factory_outputs',
    label: 'Agent Factory profiles',
    unit_cost_usd: 0.16,
    description: 'Estimated cost of AI interview/context-sheet/profile generation for agent creation.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM agent_reference_sheets ars
             JOIN agents a ON a.id = ars.agent_id
            WHERE a.workspace_id = ?`,
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: (agentId) =>
      Number(
        queryOne<{ count: number }>(
          'SELECT COUNT(*) AS count FROM agent_reference_sheets WHERE agent_id = ?',
          [agentId],
        )?.count || 0,
      ),
  },
  {
    key: 'eval_runs',
    label: 'Evaluation runs',
    unit_cost_usd: 0.018,
    description: 'Estimated cost of eval/scoring passes used to grade agent work and update reliability.',
    workspaceCount: (workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          'SELECT COUNT(*) AS count FROM agent_eval_runs WHERE workspace_id = ?',
          [workspaceId],
        )?.count || 0,
      ),
    agentCount: (agentId, workspaceId) =>
      Number(
        queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM agent_eval_runs
            WHERE agent_id = ?
              ${workspaceId ? 'AND workspace_id = ?' : ''}`,
          workspaceId ? [agentId, workspaceId] : [agentId],
        )?.count || 0,
      ),
  },
];

function toBreakdown(
  counts: Array<{ rule: CostRule; count: number }>,
): CostActionEstimate[] {
  return counts
    .filter((item) => item.count > 0)
    .map((item) => ({
      action_key: item.rule.key,
      label: item.rule.label,
      count: item.count,
      unit_cost_usd: item.rule.unit_cost_usd,
      estimated_cost_usd: Number((item.count * item.rule.unit_cost_usd).toFixed(4)),
      description: item.rule.description,
    }))
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd);
}

function sumBreakdown(items: CostActionEstimate[]): number {
  return Number(items.reduce((sum, item) => sum + item.estimated_cost_usd, 0).toFixed(4));
}

function getActualBreakdownForWorkspace(workspaceId: string): ActualCostBreakdown[] {
  const rows = queryAll<{
    provider: string | null;
    model: string | null;
    requests: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  }>(
    `SELECT
       COALESCE(NULLIF(art.provider, ''), 'unknown') AS provider,
       COALESCE(NULLIF(art.model, ''), 'unknown') AS model,
       COUNT(*) AS requests,
       COALESCE(SUM(COALESCE(art.input_tokens, 0)), 0) AS input_tokens,
       COALESCE(SUM(COALESCE(art.output_tokens, 0)), 0) AS output_tokens,
       COALESCE(SUM(COALESCE(art.total_tokens, 0)), 0) AS total_tokens,
       COALESCE(SUM(COALESCE(art.cost_usd, 0)), 0) AS cost_usd
     FROM ai_request_telemetry art
     LEFT JOIN openclaw_sessions os ON os.openclaw_session_id = art.session_id
     LEFT JOIN agents a ON a.id = os.agent_id
     WHERE a.workspace_id = ?
     GROUP BY provider, model
     ORDER BY cost_usd DESC, requests DESC`,
    [workspaceId],
  );

  return rows.map((row) => ({
    provider: row.provider || 'unknown',
    model: row.model || 'unknown',
    requests: Number(row.requests || 0),
    input_tokens: Number(row.input_tokens || 0),
    output_tokens: Number(row.output_tokens || 0),
    total_tokens: Number(row.total_tokens || 0),
    cost_usd: Number(Number(row.cost_usd || 0).toFixed(4)),
  }));
}

function getActualTotalFromBreakdown(items: ActualCostBreakdown[]): number {
  return Number(items.reduce((sum, item) => sum + item.cost_usd, 0).toFixed(4));
}

export function getWorkspaceCostSummaries(): WorkspaceCostSummary[] {
  const workspaces = queryAll<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM workspaces ORDER BY name ASC`,
  );

  return workspaces.map((workspace) => {
    const counts = COST_RULES.map((rule) => ({
      rule,
      count: rule.workspaceCount(workspace.id),
    }));
    const action_breakdown = toBreakdown(counts);
    const actual_breakdown = getActualBreakdownForWorkspace(workspace.id);
    const estimated = sumBreakdown(action_breakdown);
    const actual = getActualTotalFromBreakdown(actual_breakdown);
    return {
      workspace_id: workspace.id,
      workspace_name: workspace.name,
      workspace_slug: workspace.slug,
      estimated_total_usd: estimated,
      actual_total_usd: actual,
      delta_usd: Number((estimated - actual).toFixed(4)),
      task_count: Number(
        queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM tasks WHERE workspace_id = ?', [
          workspace.id,
        ])?.count || 0,
      ),
      agent_count: Number(
        queryOne<{ count: number }>('SELECT COUNT(*) AS count FROM agents WHERE workspace_id = ?', [
          workspace.id,
        ])?.count || 0,
      ),
      action_breakdown,
      actual_breakdown,
    };
  });
}

export function getAgentCostSummaries(workspaceId?: string): AgentCostSummary[] {
  const agents = queryAll<{ id: string; name: string; role: string; workspace_id: string }>(
    `SELECT id, name, role, workspace_id
       FROM agents
      ${workspaceId ? 'WHERE workspace_id = ?' : ''}
      ORDER BY name ASC`,
    workspaceId ? [workspaceId] : [],
  );

  return agents
    .map((agent) => {
      const counts = COST_RULES.map((rule) => ({
        rule,
        count: rule.agentCount(agent.id, workspaceId),
      }));
      const action_breakdown = toBreakdown(counts);
      const actual_breakdown = queryAll<{
        provider: string | null;
        model: string | null;
        requests: number;
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        cost_usd: number;
      }>(
        `SELECT
           COALESCE(NULLIF(art.provider, ''), 'unknown') AS provider,
           COALESCE(NULLIF(art.model, ''), 'unknown') AS model,
           COUNT(*) AS requests,
           COALESCE(SUM(COALESCE(art.input_tokens, 0)), 0) AS input_tokens,
           COALESCE(SUM(COALESCE(art.output_tokens, 0)), 0) AS output_tokens,
           COALESCE(SUM(COALESCE(art.total_tokens, 0)), 0) AS total_tokens,
           COALESCE(SUM(COALESCE(art.cost_usd, 0)), 0) AS cost_usd
         FROM ai_request_telemetry art
         JOIN openclaw_sessions os ON os.openclaw_session_id = art.session_id
         JOIN agents a ON a.id = os.agent_id
         WHERE a.id = ?
         GROUP BY provider, model
         ORDER BY cost_usd DESC, requests DESC`,
        [agent.id],
      ).map((row) => ({
        provider: row.provider || 'unknown',
        model: row.model || 'unknown',
        requests: Number(row.requests || 0),
        input_tokens: Number(row.input_tokens || 0),
        output_tokens: Number(row.output_tokens || 0),
        total_tokens: Number(row.total_tokens || 0),
        cost_usd: Number(Number(row.cost_usd || 0).toFixed(4)),
      }));
      const estimated = sumBreakdown(action_breakdown);
      const actual = getActualTotalFromBreakdown(actual_breakdown);
      return {
        agent_id: agent.id,
        agent_name: agent.name,
        role: agent.role,
        workspace_id: agent.workspace_id,
        estimated_total_usd: estimated,
        actual_total_usd: actual,
        delta_usd: Number((estimated - actual).toFixed(4)),
        action_breakdown,
        actual_breakdown,
      };
    })
    .filter((agent) => agent.estimated_total_usd > 0 || agent.actual_total_usd > 0)
    .sort((a, b) => b.actual_total_usd + b.estimated_total_usd - (a.actual_total_usd + a.estimated_total_usd));
}

export function getCostOverview(workspaceId?: string): CostOverview {
  const workspace_summaries = getWorkspaceCostSummaries();
  const filteredWorkspaces = workspaceId
    ? workspace_summaries.filter((workspace) => workspace.workspace_id === workspaceId)
    : workspace_summaries;

  const totalEstimated = Number(
    filteredWorkspaces.reduce((sum, workspace) => sum + workspace.estimated_total_usd, 0).toFixed(4),
  );
  const totalActual = Number(
    filteredWorkspaces.reduce((sum, workspace) => sum + workspace.actual_total_usd, 0).toFixed(4),
  );

  return {
    generated_at: new Date().toISOString(),
    disclaimer:
      'Estimated AI spend view. Mission Control currently infers OpenClaw-driven action cost from workflow events and profile/eval generation counts; it does not yet persist exact OpenRouter billing per request.',
    actual_disclaimer:
      'Actual spend is sourced from captured OpenClaw response telemetry (provider/model/tokens/cost). Only requests with explicit cost in payload are counted as actual billed cost.',
    total_estimated_usd: totalEstimated,
    total_actual_usd: totalActual,
    total_delta_usd: Number((totalEstimated - totalActual).toFixed(4)),
    workspace_summaries: filteredWorkspaces,
    agent_summaries: getAgentCostSummaries(workspaceId),
  };
}
