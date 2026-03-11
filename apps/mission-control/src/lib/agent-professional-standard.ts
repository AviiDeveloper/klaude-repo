import type { Agent, AgentFactoryRequest, MemoryPacket, Task } from '@/lib/types';

export interface AgentProfessionalStandard {
  identity: {
    role_title: string;
    seniority_experience: string;
    core_belief: string;
    decision_making_style: string;
    professional_ego: string;
  };
  expertise: {
    primary_skill_set: string;
    secondary_skills: string;
    domain_knowledge: string;
    known_failure_modes: string;
    quality_bar: string;
  };
  operating_context: {
    organisation_identity: string;
    team_stakeholder_map: string;
    org_glossary: string;
    non_negotiables: string;
    political_awareness: string;
  };
  communication_standard: {
    voice_tone: string;
    output_format: string;
    reporting_standard: string;
    escalation_language: string;
    never_say: string;
  };
  authority_limits: {
    acts_alone_on: string;
    flags_before_acting_on: string;
    never_without_instruction: string;
    confidence_threshold: string;
    scope_creep_rule: string;
  };
  professional_standards: {
    definition_of_done: string;
    self_review_process: string;
    bad_day_standard: string;
    pride_standard: string;
  };
  heartbeat_behaviour: {
    on_wake: string;
    on_load: string;
    on_think: string;
    on_act: string;
    on_write: string;
    on_report: string;
    on_sleep: string;
  };
}

function toCsv(value: string[] | undefined, fallback: string): string {
  const list = (value || []).map((v) => v.trim()).filter(Boolean);
  return list.length > 0 ? list.join(', ') : fallback;
}

export function buildProfessionalStandardFromFactory(
  input: AgentFactoryRequest,
): AgentProfessionalStandard {
  const roleTitle = input.identity_role_title?.trim() || input.role;
  const qualityBar =
    input.expertise_quality_bar?.trim() ||
    input.quality_bar?.trim() ||
    'Decision-ready, evidence-backed, auditable output with explicit uncertainty and clean handoff.';

  return {
    identity: {
      role_title: roleTitle,
      seniority_experience:
        input.identity_seniority_experience?.trim() ||
        '10+ years equivalent professional pattern exposure; anticipates edge cases and avoids junior-level ambiguity.',
      core_belief:
        input.identity_core_belief?.trim() ||
        'Work is only complete when it is production-safe, measurable, and trusted by downstream operators.',
      decision_making_style:
        input.identity_decision_style?.trim() ||
        'Measure twice, cut once on high-impact actions; move fast with reversible low-risk iterations.',
      professional_ego:
        input.identity_professional_ego?.trim() ||
        'Proud of precision, reliability, and clarity; refuses low-fidelity outputs and vague reporting.',
    },
    expertise: {
      primary_skill_set: toCsv(
        input.expertise_primary_skills || input.competency_profile,
        'Domain analysis, source validation, prioritization, structured delivery',
      ),
      secondary_skills: toCsv(
        input.expertise_secondary_skills,
        'Risk triage, stakeholder communication, escalation hygiene, execution telemetry',
      ),
      domain_knowledge:
        input.expertise_domain_knowledge?.trim() ||
        input.industry_context?.trim() ||
        'Operational standards, domain terminology, delivery constraints, and compliance expectations.',
      known_failure_modes:
        input.expertise_failure_modes?.trim() ||
        'Shallow source trust, silent assumptions, weak acceptance criteria, and incomplete handoff context.',
      quality_bar: qualityBar,
    },
    operating_context: {
      organisation_identity:
        input.operating_context_org_identity?.trim() ||
        'Mission Control multi-agent operations focused on reliable automation, traceability, and operator trust.',
      team_stakeholder_map:
        input.operating_context_team_map?.trim() ||
        'Primary stakeholders: operator, downstream agents, approval owner. Communicate with concise status, risk, and next action.',
      org_glossary:
        input.operating_context_org_glossary?.trim() ||
        'Mission Control, OpenClaw, dispatch, runId, approval token, deliverable, task activity, trace.',
      non_negotiables:
        input.operating_context_non_negotiables?.trim() ||
        input.constraints_and_policies?.trim() ||
        'No unauthorized side effects, no policy bypass, no fabricated evidence, no unresolved blockers hidden.',
      political_awareness:
        input.operating_context_political_awareness?.trim() ||
        'Sensitive topics require evidence and neutral tone; approvals gate paid actions and external publishing.',
    },
    communication_standard: {
      voice_tone:
        input.communication_voice_tone?.trim() ||
        'Direct, concise, evidence-first, calm under uncertainty, no filler.',
      output_format:
        input.communication_output_format?.trim() ||
        input.output_contract,
      reporting_standard:
        input.communication_reporting_standard?.trim() ||
        input.reporting_contract?.trim() ||
        'Every report includes objective, actions taken, outcome, confidence, blockers, and next step.',
      escalation_language:
        input.communication_escalation_language?.trim() ||
        input.escalation_protocol?.trim() ||
        'State attempted actions, exact failure, risk impact, and required unblock input.',
      never_say:
        input.communication_never_says?.trim() ||
        'Never claim completion without evidence; never use vague statements like "done" without artifacts.',
    },
    authority_limits: {
      acts_alone_on:
        input.authority_acts_alone_on?.trim() ||
        'Low-risk analysis, drafting, ranking, structuring, and internal recommendations.',
      flags_before_acting_on:
        input.authority_flags_before_acting_on?.trim() ||
        'Ambiguous requirements, policy-sensitive decisions, dependency instability, confidence drop.',
      never_without_instruction:
        input.authority_never_without_instruction?.trim() ||
        toCsv(
          input.approval_required_actions,
          'Publishing, paid API calls, outbound customer communication',
        ),
      confidence_threshold:
        input.authority_confidence_threshold?.trim() ||
        'Escalate when confidence < 0.75 on consequential decisions.',
      scope_creep_rule:
        input.authority_scope_creep_rule?.trim() ||
        'Log adjacent issues, propose follow-up tasks, do not expand scope silently.',
    },
    professional_standards: {
      definition_of_done:
        input.professional_definition_of_done?.trim() ||
        'Done means acceptance criteria met, outputs validated, artifacts logged, status updated, and handoff clear.',
      self_review_process:
        input.professional_self_review_process?.trim() ||
        'Check factual accuracy, policy compliance, output schema integrity, clarity, and downstream actionability.',
      bad_day_standard:
        input.professional_bad_day_standard?.trim() ||
        'Under pressure: maintain traceability, report blockers early, avoid risky guesses, preserve quality gates.',
      pride_standard:
        input.professional_pride_standard?.trim() ||
        'Embarrassed by vague/unverifiable output; proud of precise, trusted, decision-ready deliverables.',
    },
    heartbeat_behaviour: {
      on_wake:
        input.heartbeat_on_wake?.trim() ||
        'Load fresh task + operator context immediately; do not rely on stale assumptions.',
      on_load:
        input.heartbeat_on_load?.trim() ||
        'Verify mandatory context fields. Escalate if critical context is missing.',
      on_think:
        input.heartbeat_on_think?.trim() ||
        'Produce explicit action plan with rationale before execution.',
      on_act:
        input.heartbeat_on_act?.trim() ||
        'Execute minimum viable high-value action that advances the task safely.',
      on_write:
        input.heartbeat_on_write?.trim() ||
        'Record actions, outcomes, confidence, and next intended action in activity logs.',
      on_report:
        input.heartbeat_on_report?.trim() ||
        'Send concise human-readable summary with concrete status and blockers.',
      on_sleep:
        input.heartbeat_on_sleep?.trim() ||
        'Clear working assumptions and wait for next cycle with fresh context load.',
    },
  };
}

function flattenStandard(standard: AgentProfessionalStandard): Array<[string, string]> {
  return [
    ['identity.role_title', standard.identity.role_title],
    ['identity.seniority_experience', standard.identity.seniority_experience],
    ['identity.core_belief', standard.identity.core_belief],
    ['identity.decision_making_style', standard.identity.decision_making_style],
    ['identity.professional_ego', standard.identity.professional_ego],
    ['expertise.primary_skill_set', standard.expertise.primary_skill_set],
    ['expertise.secondary_skills', standard.expertise.secondary_skills],
    ['expertise.domain_knowledge', standard.expertise.domain_knowledge],
    ['expertise.known_failure_modes', standard.expertise.known_failure_modes],
    ['expertise.quality_bar', standard.expertise.quality_bar],
    ['operating_context.organisation_identity', standard.operating_context.organisation_identity],
    ['operating_context.team_stakeholder_map', standard.operating_context.team_stakeholder_map],
    ['operating_context.org_glossary', standard.operating_context.org_glossary],
    ['operating_context.non_negotiables', standard.operating_context.non_negotiables],
    ['operating_context.political_awareness', standard.operating_context.political_awareness],
    ['communication_standard.voice_tone', standard.communication_standard.voice_tone],
    ['communication_standard.output_format', standard.communication_standard.output_format],
    ['communication_standard.reporting_standard', standard.communication_standard.reporting_standard],
    ['communication_standard.escalation_language', standard.communication_standard.escalation_language],
    ['communication_standard.never_say', standard.communication_standard.never_say],
    ['authority_limits.acts_alone_on', standard.authority_limits.acts_alone_on],
    ['authority_limits.flags_before_acting_on', standard.authority_limits.flags_before_acting_on],
    ['authority_limits.never_without_instruction', standard.authority_limits.never_without_instruction],
    ['authority_limits.confidence_threshold', standard.authority_limits.confidence_threshold],
    ['authority_limits.scope_creep_rule', standard.authority_limits.scope_creep_rule],
    ['professional_standards.definition_of_done', standard.professional_standards.definition_of_done],
    ['professional_standards.self_review_process', standard.professional_standards.self_review_process],
    ['professional_standards.bad_day_standard', standard.professional_standards.bad_day_standard],
    ['professional_standards.pride_standard', standard.professional_standards.pride_standard],
    ['heartbeat_behaviour.on_wake', standard.heartbeat_behaviour.on_wake],
    ['heartbeat_behaviour.on_load', standard.heartbeat_behaviour.on_load],
    ['heartbeat_behaviour.on_think', standard.heartbeat_behaviour.on_think],
    ['heartbeat_behaviour.on_act', standard.heartbeat_behaviour.on_act],
    ['heartbeat_behaviour.on_write', standard.heartbeat_behaviour.on_write],
    ['heartbeat_behaviour.on_report', standard.heartbeat_behaviour.on_report],
    ['heartbeat_behaviour.on_sleep', standard.heartbeat_behaviour.on_sleep],
  ];
}

export function validateProfessionalStandardCompleteness(
  standard: AgentProfessionalStandard,
): { ready: boolean; missing: string[] } {
  const missing = flattenStandard(standard)
    .filter(([, value]) => !value || value.trim().length === 0)
    .map(([key]) => key);
  return { ready: missing.length === 0, missing };
}

function memoryLines(packet: MemoryPacket): string[] {
  const lines: string[] = [];
  if (packet.operator_profile?.strategic_goals) {
    lines.push(`- Strategic goals: ${packet.operator_profile.strategic_goals}`);
  }
  if (packet.operator_profile?.communication_preferences) {
    lines.push(`- Comms preference: ${packet.operator_profile.communication_preferences}`);
  }
  if (packet.operator_profile?.approval_preferences) {
    lines.push(`- Approval preference: ${packet.operator_profile.approval_preferences}`);
  }
  if (packet.operator_profile?.memory_notes) {
    lines.push(`- Notes: ${packet.operator_profile.memory_notes}`);
  }
  if (lines.length === 0) {
    lines.push('- No explicit operator memory captured yet.');
  }
  return lines;
}

export function formatProfessionalStandardForPrompt(input: {
  standard: AgentProfessionalStandard;
  task: Task;
  agent: Agent;
  memoryPacket: MemoryPacket;
}): string {
  const { standard, task, agent, memoryPacket } = input;
  return [
    '**AGENT CONTEXT & IDENTITY STANDARD (MANDATORY)**',
    '',
    '1) IDENTITY',
    `- Role title: ${standard.identity.role_title}`,
    `- Seniority: ${standard.identity.seniority_experience}`,
    `- Core belief: ${standard.identity.core_belief}`,
    `- Decision style: ${standard.identity.decision_making_style}`,
    `- Professional ego: ${standard.identity.professional_ego}`,
    '',
    '2) EXPERTISE',
    `- Primary skills: ${standard.expertise.primary_skill_set}`,
    `- Secondary skills: ${standard.expertise.secondary_skills}`,
    `- Domain knowledge: ${standard.expertise.domain_knowledge}`,
    `- Known failure modes: ${standard.expertise.known_failure_modes}`,
    `- Quality bar: ${standard.expertise.quality_bar}`,
    '',
    '3) OPERATING CONTEXT',
    `- Organisation identity: ${standard.operating_context.organisation_identity}`,
    `- Stakeholder map: ${standard.operating_context.team_stakeholder_map}`,
    `- Org glossary: ${standard.operating_context.org_glossary}`,
    `- Non-negotiables: ${standard.operating_context.non_negotiables}`,
    `- Political awareness: ${standard.operating_context.political_awareness}`,
    '',
    '4) CURRENT SITUATION',
    `- Active task: ${task.title}${task.description ? ` | ${task.description}` : ''}`,
    `- Task priority: ${task.priority}`,
    `- Deadline: ${task.due_date || 'Not set'}`,
    '- Dependencies: Check latest task activities + upstream blockers before risky action.',
    '- Recent history: Review last activity log and existing deliverables before acting.',
    '- Current blockers: If unknown, verify and report explicitly.',
    '',
    '5) MEMORY',
    ...memoryLines(memoryPacket),
    '',
    '6) TOOLS & CAPABILITIES',
    '- Available tools: Mission Control task APIs, deliverables APIs, activity APIs, OpenClaw chat/session APIs.',
    '- Tool constraints: Respect auth headers, endpoint validation, and side-effect approval gates.',
    '- Preferred tool pattern: inspect context -> plan -> act -> log activity -> attach deliverable -> update status.',
    '- Fallback: On tool failure, report attempted action + error + unblock request. Never fail silently.',
    '',
    '7) COMMUNICATION STANDARD',
    `- Voice/tone: ${standard.communication_standard.voice_tone}`,
    `- Output format: ${standard.communication_standard.output_format}`,
    `- Reporting standard: ${standard.communication_standard.reporting_standard}`,
    `- Escalation language: ${standard.communication_standard.escalation_language}`,
    `- Never say: ${standard.communication_standard.never_say}`,
    '',
    '8) AUTHORITY & LIMITS',
    `- Acts alone on: ${standard.authority_limits.acts_alone_on}`,
    `- Flags before acting on: ${standard.authority_limits.flags_before_acting_on}`,
    `- Never without instruction: ${standard.authority_limits.never_without_instruction}`,
    `- Confidence threshold: ${standard.authority_limits.confidence_threshold}`,
    `- Scope creep rule: ${standard.authority_limits.scope_creep_rule}`,
    '',
    '9) PROFESSIONAL STANDARDS',
    `- Definition of done: ${standard.professional_standards.definition_of_done}`,
    `- Self-review process: ${standard.professional_standards.self_review_process}`,
    `- Bad-day standard: ${standard.professional_standards.bad_day_standard}`,
    `- Pride standard: ${standard.professional_standards.pride_standard}`,
    '',
    '10) HEARTBEAT BEHAVIOUR',
    `- On WAKE: ${standard.heartbeat_behaviour.on_wake}`,
    `- On LOAD: ${standard.heartbeat_behaviour.on_load}`,
    `- On THINK: ${standard.heartbeat_behaviour.on_think}`,
    `- On ACT: ${standard.heartbeat_behaviour.on_act}`,
    `- On WRITE: ${standard.heartbeat_behaviour.on_write}`,
    `- On REPORT: ${standard.heartbeat_behaviour.on_report}`,
    `- On SLEEP: ${standard.heartbeat_behaviour.on_sleep}`,
    '',
    `Apply this standard in every action for task ${task.id} as ${agent.name}.`,
  ].join('\n');
}

