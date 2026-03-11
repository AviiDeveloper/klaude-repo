import type { AgentFactoryRequest } from '@/lib/types';
import {
  buildProfessionalStandardFromFactory,
  validateProfessionalStandardCompleteness,
} from '@/lib/agent-professional-standard';

function normalizeList(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v.length > 0);
}

export function buildAgentFactoryArtifacts(input: AgentFactoryRequest): {
  soulMd: string;
  userMd: string;
  agentsMd: string;
  referenceSheet: string;
  professionalStandard: ReturnType<typeof buildProfessionalStandardFromFactory>;
  readiness: { ready: boolean; missing: string[] };
} {
  const tools = normalizeList(input.tool_stack);
  const handoffs = normalizeList(input.handoff_targets);
  const approvalActions = normalizeList(input.approval_required_actions);
  const competencies = normalizeList(input.competency_profile || []);
  const knowledgeSources = normalizeList(input.knowledge_sources || []);
  const kpiTargets = normalizeList(input.kpi_targets || []);
  const generatedAt = new Date().toISOString();
  const industryContext = input.industry_context || 'General digital operations and automation';
  const qualityBar =
    input.quality_bar ||
    'Outputs must be decision-ready, evidence-backed, and production-safe with explicit uncertainty handling.';
  const decisionFramework =
    input.decision_framework ||
    '1) Verify source quality, 2) score options, 3) select highest expected value, 4) emit rationale + fallback.';
  const constraintsAndPolicies =
    input.constraints_and_policies ||
    'Respect policy, legal, budget, privacy, and approval-gated side effects before execution.';
  const escalationProtocol =
    input.escalation_protocol ||
    'Escalate on missing critical inputs, policy ambiguity, high-risk actions, or repeated downstream failures.';
  const reportingContract =
    input.reporting_contract ||
    'Report status in concise checkpoints: start, midpoint, blockers, handoff, completion with confidence score.';
  const learningLoop =
    input.learning_loop ||
    'After each run, log misses, classify root causes, and update heuristics/weights for the next run.';
  const professionalStandard = buildProfessionalStandardFromFactory(input);
  const readiness = validateProfessionalStandardCompleteness(professionalStandard);

  const soulMd = [
    `# ${input.name} - SOUL`,
    '',
    `## Core Mission`,
    input.objective,
    '',
    `## Behavioral Profile`,
    `- Role: ${input.role}`,
    `- Specialization: ${input.specialization}`,
    `- Autonomy: ${input.autonomy_level}`,
    `- Risk tolerance: ${input.risk_tolerance}`,
    '',
    `## Decision Priorities`,
    '- Protect factual quality before speed.',
    '- Operate as a senior domain specialist, not a generic assistant.',
    '- Prefer deterministic outputs over vague prose.',
    '- Escalate when approvals are required.',
    '- Keep handoffs explicit and machine-readable.',
    '',
    `## Professional Standard`,
    `- Industry context: ${industryContext}`,
    `- Quality bar: ${qualityBar}`,
    `- Decision framework: ${decisionFramework}`,
  ].join('\n');

  const userMd = [
    `# ${input.name} - USER CONTEXT`,
    '',
    `## Operator Expectations`,
    '- Deliver production-ready outputs, not drafts unless requested.',
    '- Report blockers with exact missing inputs.',
    '- Provide concise status updates and next action.',
    '',
    `## Approval Protocol`,
    approvalActions.length > 0
      ? approvalActions.map((action) => `- Approval required for: ${action}`).join('\n')
      : '- No explicit approval-only actions configured.',
    '',
    `## Delivery Contract`,
    input.output_contract,
    '',
    `## Reporting Contract`,
    reportingContract,
  ].join('\n');

  const agentsMd = [
    `# ${input.name} - TEAM HANDOFFS`,
    '',
    `## Upstream / Downstream`,
    handoffs.length > 0
      ? handoffs.map((target) => `- Handoff target: ${target}`).join('\n')
      : '- No handoff targets configured yet.',
    '',
    `## Operating Cadence`,
    `- ${input.cadence}`,
    '',
    `## Tooling`,
    tools.length > 0 ? tools.map((tool) => `- ${tool}`).join('\n') : '- No tools configured.',
    '',
    `## Escalation Protocol`,
    escalationProtocol,
  ].join('\n');

  const referenceSheet = [
    `# Agent Professional Reference Dossier: ${input.name}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    `---`,
    '',
    `## Page 1: Identity and Strategic Charter`,
    '',
    `- Name: ${input.name}`,
    `- Role: ${input.role}`,
    `- Specialization: ${input.specialization}`,
    `- Workspace: ${input.workspace_id || 'default'}`,
    `- Industry context: ${industryContext}`,
    '',
    `### Mission Objective`,
    input.objective,
    '',
    `### Executive Intent`,
    '- Function as a high-accountability specialist equivalent to an experienced industry contributor.',
    '- Prioritize outcomes that are actionable, verifiable, and transferable across shifts.',
    '',
    `---`,
    '',
    `## Page 2: Competency and Knowledge Baseline`,
    '',
    `### Competency Profile`,
    competencies.length > 0
      ? competencies.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
      : '1. Domain analysis\n2. Source validation\n3. Structured reporting\n4. Risk-aware execution',
    '',
    `### Required Knowledge Sources`,
    knowledgeSources.length > 0
      ? knowledgeSources.map((item) => `- ${item}`).join('\n')
      : '- Internal runbooks\n- Trusted primary sources\n- Platform documentation\n- Policy references',
    '',
    `### Professional Knowledge Expectations`,
    '- Distinguish signal from noise using source provenance and recency checks.',
    '- Explicitly label assumptions, confidence, and unresolved ambiguity.',
    '- Maintain auditable rationale for every non-trivial decision.',
    '',
    `---`,
    '',
    `## Page 3: Execution Operating System`,
    '',
    `### Execution Policy`,
    `- Autonomy level: ${input.autonomy_level}`,
    `- Risk tolerance: ${input.risk_tolerance}`,
    `- Cadence: ${input.cadence}`,
    '',
    `### Decision Framework`,
    decisionFramework,
    '',
    `### Tool Stack`,
    tools.length > 0 ? tools.map((tool) => `- ${tool}`).join('\n') : '- None specified',
    '',
    `### Output Contract`,
    input.output_contract,
    '',
    `### Quality Bar`,
    qualityBar,
    '',
    `### Constraints and Policies`,
    constraintsAndPolicies,
    '',
    `### Approval Gates`,
    approvalActions.length > 0
      ? approvalActions.map((action) => `- ${action}`).join('\n')
      : '- No explicit gates configured',
    '',
    `---`,
    '',
    `## Page 4: Collaboration, Handoffs, and Escalation`,
    '',
    `### Handoff Map`,
    handoffs.length > 0 ? handoffs.map((target) => `- ${target}`).join('\n') : '- No downstream targets configured',
    '',
    `### Reporting Contract`,
    reportingContract,
    '',
    `### Escalation Protocol`,
    escalationProtocol,
    '',
    `### Failure Playbook`,
    '- If source quality is low: return `needs_input` with missing fields.',
    '- If policy uncertainty exists: halt and request approval.',
    '- If downstream agent unavailable: queue handoff task to inbox.',
    '',
    `---`,
    '',
    `## Page 5: Performance and Continuous Improvement`,
    '',
    `### KPI Targets`,
    kpiTargets.length > 0
      ? kpiTargets.map((item) => `- ${item}`).join('\n')
      : '- Accuracy above 90% on verifiable claims\n- On-time completion above 95%\n- Rework rate below 10%',
    '',
    `### Telemetry Expectations`,
    '- Emit activity events at: started, fetched, ranked, handed_off, blocked, completed.',
    '- Persist ranked candidates and scoring rationale in deliverables.',
    '',
    `### Learning Loop`,
    learningLoop,
    '',
    `### Prompt Anchors`,
    '- Always return machine-readable JSON plus concise operator summary.',
    '- Always include confidence and recency score for external-news outputs.',
    '- Explicitly flag policy/budget/approval constraints before side effects.',
    '',
    `---`,
    '',
    `## Page 6: Agent Context & Identity Standard (Mandatory Runtime Contract)`,
    '',
    `### 1) Identity`,
    `- Role title: ${professionalStandard.identity.role_title}`,
    `- Seniority & experience: ${professionalStandard.identity.seniority_experience}`,
    `- Core belief: ${professionalStandard.identity.core_belief}`,
    `- Decision-making style: ${professionalStandard.identity.decision_making_style}`,
    `- Professional ego: ${professionalStandard.identity.professional_ego}`,
    '',
    `### 2) Expertise`,
    `- Primary skill set: ${professionalStandard.expertise.primary_skill_set}`,
    `- Secondary skills: ${professionalStandard.expertise.secondary_skills}`,
    `- Domain knowledge: ${professionalStandard.expertise.domain_knowledge}`,
    `- Known failure modes: ${professionalStandard.expertise.known_failure_modes}`,
    `- Quality bar: ${professionalStandard.expertise.quality_bar}`,
    '',
    `### 3) Operating Context`,
    `- Organisation identity: ${professionalStandard.operating_context.organisation_identity}`,
    `- Team/stakeholder map: ${professionalStandard.operating_context.team_stakeholder_map}`,
    `- Org glossary: ${professionalStandard.operating_context.org_glossary}`,
    `- Non-negotiables: ${professionalStandard.operating_context.non_negotiables}`,
    `- Political awareness: ${professionalStandard.operating_context.political_awareness}`,
    '',
    `### 4) Current Situation (loaded each cycle)`,
    '- Active task with zero ambiguity',
    '- Priority and deadline impact',
    '- Dependencies and blocker state',
    '- Last 1-3 cycle outcomes and current blockers',
    '',
    `### 5) Memory (semantic retrieval each run)`,
    '- Similar past tasks and outcomes',
    '- Learned stakeholder preferences',
    '- Prior mistakes to avoid',
    '- Successful org-specific patterns',
    '- Open unresolved threads',
    '',
    `### 6) Tools & Capabilities`,
    '- Enumerate available tools + usage conditions',
    '- Explicit constraints and permission boundaries',
    '- Preferred tool pattern by role',
    '- Fallback behavior on tool failure (no silent fail)',
    '',
    `### 7) Communication Standard`,
    `- Voice/tone: ${professionalStandard.communication_standard.voice_tone}`,
    `- Output format: ${professionalStandard.communication_standard.output_format}`,
    `- Reporting standard: ${professionalStandard.communication_standard.reporting_standard}`,
    `- Escalation language: ${professionalStandard.communication_standard.escalation_language}`,
    `- Never says: ${professionalStandard.communication_standard.never_say}`,
    '',
    `### 8) Authority & Limits`,
    `- Acts alone on: ${professionalStandard.authority_limits.acts_alone_on}`,
    `- Flags before acting on: ${professionalStandard.authority_limits.flags_before_acting_on}`,
    `- Never without explicit instruction: ${professionalStandard.authority_limits.never_without_instruction}`,
    `- Confidence threshold: ${professionalStandard.authority_limits.confidence_threshold}`,
    `- Scope creep rule: ${professionalStandard.authority_limits.scope_creep_rule}`,
    '',
    `### 9) Professional Standards`,
    `- Definition of done: ${professionalStandard.professional_standards.definition_of_done}`,
    `- Self-review process: ${professionalStandard.professional_standards.self_review_process}`,
    `- Bad-day standard: ${professionalStandard.professional_standards.bad_day_standard}`,
    `- Pride standard: ${professionalStandard.professional_standards.pride_standard}`,
    '',
    `### 10) Heartbeat Behaviour`,
    `- On WAKE: ${professionalStandard.heartbeat_behaviour.on_wake}`,
    `- On LOAD: ${professionalStandard.heartbeat_behaviour.on_load}`,
    `- On THINK: ${professionalStandard.heartbeat_behaviour.on_think}`,
    `- On ACT: ${professionalStandard.heartbeat_behaviour.on_act}`,
    `- On WRITE: ${professionalStandard.heartbeat_behaviour.on_write}`,
    `- On REPORT: ${professionalStandard.heartbeat_behaviour.on_report}`,
    `- On SLEEP: ${professionalStandard.heartbeat_behaviour.on_sleep}`,
    '',
    `### Readiness`,
    readiness.ready
      ? '- READY: all mandatory sections populated.'
      : `- NOT READY: missing sections -> ${readiness.missing.join(', ')}`,
  ].join('\n');

  return { soulMd, userMd, agentsMd, referenceSheet, professionalStandard, readiness };
}
