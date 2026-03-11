export interface PlannerAgent {
  name: string;
  role: string;
  avatar_emoji?: string;
  soul_md?: string;
  instructions?: string;
}

export interface SideEffectProposal {
  type: string;
  description: string;
  scope: string;
  risk_notes?: string;
  requires_approval: boolean;
}

export interface NormalizedPlanSpec {
  title: string;
  objective: string;
  constraints: string[];
  plan_steps: string[];
  assigned_agents: string[];
  approvals_required: string[];
  side_effects: SideEffectProposal[];
  rollback_plan: string;
  stop_conditions: string[];
  inputs_needed: string[];
  summary?: string;
  deliverables?: string[];
  success_criteria?: string[];
}

export interface NormalizedPlanningResult {
  spec: NormalizedPlanSpec;
  agents: PlannerAgent[];
}

const DEFAULT_AGENTS: PlannerAgent[] = [
  {
    name: 'Code Agent',
    role: 'code_agent',
    avatar_emoji: '🧠',
    soul_md: 'Specialist in coding, refactoring, and tests.',
    instructions: 'Execute code-focused plan steps and report artifacts.',
  },
  {
    name: 'Ops Agent',
    role: 'ops_agent',
    avatar_emoji: '🛠️',
    soul_md: 'Specialist in operations, runtime checks, and deployments.',
    instructions: 'Execute operations-focused plan steps with approval discipline.',
  },
];

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asString(item))
    .filter((item) => item.length > 0);
}

function coerceSteps(value: unknown): string[] {
  const raw = asStringArray(value);
  if (raw.length > 0) {
    return raw.slice(0, 8);
  }
  return [];
}

function normalizeAgents(value: unknown): PlannerAgent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const agents: PlannerAgent[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const name = asString(record.name);
    const role = asString(record.role);
    if (!name || !role) {
      continue;
    }
    agents.push({
      name,
      role,
      avatar_emoji: asString(record.avatar_emoji) || undefined,
      soul_md: asString(record.soul_md) || undefined,
      instructions: asString(record.instructions) || undefined,
    });
  }
  return agents;
}

function normalizeSideEffects(value: unknown): SideEffectProposal[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const sideEffects: SideEffectProposal[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const type = asString(record.type);
    const description = asString(record.description);
    const scope = asString(record.scope) || 'local';
    const riskNotes = asString(record.risk_notes) || undefined;
    const requiresApproval =
      typeof record.requires_approval === 'boolean'
        ? record.requires_approval
        : ['shell_exec', 'network_call', 'git_push', 'message_send', 'deploy'].includes(type);
    if (!type || !description) {
      continue;
    }
    sideEffects.push({
      type,
      description,
      scope,
      risk_notes: riskNotes,
      requires_approval: requiresApproval,
    });
  }
  return sideEffects;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function normalizePlanningCompletion(input: {
  parsed: Record<string, unknown>;
  taskTitle: string;
  taskDescription?: string | null;
}): NormalizedPlanningResult {
  const parsed = input.parsed;
  const spec = (parsed.spec && typeof parsed.spec === 'object' ? parsed.spec : {}) as Record<string, unknown>;
  const executionPlan =
    parsed.execution_plan && typeof parsed.execution_plan === 'object'
      ? (parsed.execution_plan as Record<string, unknown>)
      : {};

  const objective =
    asString(spec.objective) ||
    asString(spec.summary) ||
    asString(input.taskDescription) ||
    `Complete task: ${input.taskTitle}`;
  const summary = asString(spec.summary) || objective;

  let planSteps = coerceSteps(spec.plan_steps);
  if (planSteps.length === 0) {
    planSteps = coerceSteps(executionPlan.steps);
  }
  if (planSteps.length === 0) {
    planSteps = [
      `Clarify success criteria for "${input.taskTitle}".`,
      'Implement the core deliverable with required constraints.',
      'Verify output quality against success criteria and log artifacts.',
    ];
  }
  if (planSteps.length < 3) {
    planSteps = [...planSteps, 'Validate result quality and document final output.'].slice(0, 8);
  }
  if (planSteps.length > 8) {
    planSteps = planSteps.slice(0, 8);
  }

  const sideEffects = normalizeSideEffects(spec.side_effects);
  const approvalsRequired = dedupe(
    asStringArray(spec.approvals_required).concat(
      sideEffects.filter((effect) => effect.requires_approval).map((effect) => effect.type),
    ),
  );

  const agents = normalizeAgents(parsed.agents);
  if (agents.length < 2) {
    const existingKeys = new Set(agents.map((agent) => `${agent.name.toLowerCase()}|${agent.role.toLowerCase()}`));
    for (const template of DEFAULT_AGENTS) {
      const key = `${template.name.toLowerCase()}|${template.role.toLowerCase()}`;
      if (!existingKeys.has(key)) {
        agents.push(template);
        existingKeys.add(key);
      }
      if (agents.length >= 2) {
        break;
      }
    }
  }

  const assignedAgentsRaw = asStringArray(spec.assigned_agents);
  const assignedAgents =
    assignedAgentsRaw.length > 0 ? dedupe(assignedAgentsRaw) : agents.map((agent) => agent.name).slice(0, 2);

  const normalizedSpec: NormalizedPlanSpec = {
    title: asString(spec.title) || input.taskTitle,
    objective,
    constraints: dedupe(asStringArray(spec.constraints)),
    plan_steps: planSteps,
    assigned_agents: assignedAgents,
    approvals_required: approvalsRequired,
    side_effects: sideEffects,
    rollback_plan:
      asString(spec.rollback_plan) ||
      'Revert created/modified artifacts and restore previous task state before side effects.',
    stop_conditions:
      dedupe(asStringArray(spec.stop_conditions)).length > 0
        ? dedupe(asStringArray(spec.stop_conditions))
        : ['Missing required credentials', 'Risk threshold exceeded', 'Repeated execution failure'],
    inputs_needed: dedupe(asStringArray(spec.inputs_needed)),
    summary,
    deliverables: dedupe(asStringArray(spec.deliverables)),
    success_criteria: dedupe(asStringArray(spec.success_criteria)),
  };

  return {
    spec: normalizedSpec,
    agents,
  };
}
