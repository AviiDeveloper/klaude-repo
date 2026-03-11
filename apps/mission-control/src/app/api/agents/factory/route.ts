import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run, transaction } from '@/lib/db';
import { buildAgentFactoryArtifacts } from '@/lib/agent-factory';
import type { Agent, AgentFactoryRequest } from '@/lib/types';

function parseCsvOrArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '')).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function readOptionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveObjective(objective: string, contextSheet: string): string {
  if (objective.length >= 8) return objective;
  if (!contextSheet) return objective;
  const fromContext = contextSheet
    .split(/[.!?]/)
    .map((line) => line.trim())
    .find((line) => line.length > 20);
  return fromContext || objective;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AgentFactoryRequest>;
    const contextSheet = readOptionalText(body.factory_context_sheet);
    const resolvedObjective = resolveObjective(readOptionalText(body.objective), contextSheet);

    if (!body.name || !body.role || !body.specialization || !body.output_contract || resolvedObjective.length < 8) {
      return NextResponse.json(
        { error: 'name, role, objective, specialization, and output_contract are required' },
        { status: 400 },
      );
    }

    const payload: AgentFactoryRequest = {
      workspace_id: body.workspace_id || 'default',
      name: body.name.trim(),
      role: body.role.trim(),
      objective: resolvedObjective,
      factory_context_sheet: contextSheet,
      specialization: body.specialization.trim(),
      autonomy_level:
        body.autonomy_level === 'assisted' || body.autonomy_level === 'autonomous'
          ? body.autonomy_level
          : 'semi-autonomous',
      risk_tolerance:
        body.risk_tolerance === 'low' || body.risk_tolerance === 'high' ? body.risk_tolerance : 'medium',
      tool_stack: parseCsvOrArray(body.tool_stack),
      handoff_targets: parseCsvOrArray(body.handoff_targets),
      approval_required_actions: parseCsvOrArray(body.approval_required_actions),
      output_contract: body.output_contract.trim(),
      cadence: (body.cadence || 'hourly').trim(),
      industry_context: (body.industry_context || '').trim(),
      competency_profile: parseCsvOrArray(body.competency_profile),
      knowledge_sources: parseCsvOrArray(body.knowledge_sources),
      quality_bar: (body.quality_bar || '').trim(),
      decision_framework: (body.decision_framework || '').trim(),
      constraints_and_policies: (body.constraints_and_policies || '').trim(),
      escalation_protocol: (body.escalation_protocol || '').trim(),
      reporting_contract: (body.reporting_contract || '').trim(),
      kpi_targets: parseCsvOrArray(body.kpi_targets),
      learning_loop: (body.learning_loop || '').trim(),
      identity_role_title: readOptionalText(body.identity_role_title),
      identity_seniority_experience: readOptionalText(body.identity_seniority_experience),
      identity_core_belief: readOptionalText(body.identity_core_belief),
      identity_decision_style: readOptionalText(body.identity_decision_style),
      identity_professional_ego: readOptionalText(body.identity_professional_ego),
      expertise_primary_skills: parseCsvOrArray(body.expertise_primary_skills),
      expertise_secondary_skills: parseCsvOrArray(body.expertise_secondary_skills),
      expertise_domain_knowledge: readOptionalText(body.expertise_domain_knowledge),
      expertise_failure_modes: readOptionalText(body.expertise_failure_modes),
      expertise_quality_bar: readOptionalText(body.expertise_quality_bar),
      operating_context_org_identity: readOptionalText(body.operating_context_org_identity),
      operating_context_team_map: readOptionalText(body.operating_context_team_map),
      operating_context_org_glossary: readOptionalText(body.operating_context_org_glossary),
      operating_context_non_negotiables: readOptionalText(body.operating_context_non_negotiables),
      operating_context_political_awareness: readOptionalText(body.operating_context_political_awareness),
      communication_voice_tone: readOptionalText(body.communication_voice_tone),
      communication_output_format: readOptionalText(body.communication_output_format),
      communication_reporting_standard: readOptionalText(body.communication_reporting_standard),
      communication_escalation_language: readOptionalText(body.communication_escalation_language),
      communication_never_says: readOptionalText(body.communication_never_says),
      authority_acts_alone_on: readOptionalText(body.authority_acts_alone_on),
      authority_flags_before_acting_on: readOptionalText(body.authority_flags_before_acting_on),
      authority_never_without_instruction: readOptionalText(body.authority_never_without_instruction),
      authority_confidence_threshold: readOptionalText(body.authority_confidence_threshold),
      authority_scope_creep_rule: readOptionalText(body.authority_scope_creep_rule),
      professional_definition_of_done: readOptionalText(body.professional_definition_of_done),
      professional_self_review_process: readOptionalText(body.professional_self_review_process),
      professional_bad_day_standard: readOptionalText(body.professional_bad_day_standard),
      professional_pride_standard: readOptionalText(body.professional_pride_standard),
      heartbeat_on_wake: readOptionalText(body.heartbeat_on_wake),
      heartbeat_on_load: readOptionalText(body.heartbeat_on_load),
      heartbeat_on_think: readOptionalText(body.heartbeat_on_think),
      heartbeat_on_act: readOptionalText(body.heartbeat_on_act),
      heartbeat_on_write: readOptionalText(body.heartbeat_on_write),
      heartbeat_on_report: readOptionalText(body.heartbeat_on_report),
      heartbeat_on_sleep: readOptionalText(body.heartbeat_on_sleep),
    };

    const now = new Date().toISOString();
    const agentId = uuidv4();
    const referenceId = uuidv4();
    const artifacts = buildAgentFactoryArtifacts(payload);
    if (!artifacts.readiness.ready) {
      return NextResponse.json(
        {
          error: `Agent not ready: missing mandatory professional-standard fields (${artifacts.readiness.missing.join(
            ', ',
          )})`,
        },
        { status: 400 },
      );
    }

    transaction(() => {
      run(
        `INSERT INTO agents (id, name, role, description, avatar_emoji, is_master, workspace_id, soul_md, user_md, agents_md, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          agentId,
          payload.name,
          payload.role,
          payload.objective,
          '🧠',
          0,
          payload.workspace_id,
          artifacts.soulMd,
          artifacts.userMd,
          artifacts.agentsMd,
          now,
          now,
        ],
      );

      run(
        `INSERT INTO agent_reference_sheets (id, agent_id, version, title, markdown, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          referenceId,
          agentId,
          1,
          `${payload.name} Reference Sheet`,
          artifacts.referenceSheet,
          JSON.stringify({
            objective: payload.objective,
            factory_context_sheet: payload.factory_context_sheet,
            specialization: payload.specialization,
            autonomy_level: payload.autonomy_level,
            risk_tolerance: payload.risk_tolerance,
            tool_stack: payload.tool_stack,
            handoff_targets: payload.handoff_targets,
            approval_required_actions: payload.approval_required_actions,
            output_contract: payload.output_contract,
            cadence: payload.cadence,
            industry_context: payload.industry_context,
            competency_profile: payload.competency_profile,
            knowledge_sources: payload.knowledge_sources,
            quality_bar: payload.quality_bar,
            decision_framework: payload.decision_framework,
            constraints_and_policies: payload.constraints_and_policies,
            escalation_protocol: payload.escalation_protocol,
            reporting_contract: payload.reporting_contract,
            kpi_targets: payload.kpi_targets,
            learning_loop: payload.learning_loop,
            professional_standard: artifacts.professionalStandard,
            professional_standard_readiness: artifacts.readiness,
          }),
          now,
        ],
      );

      run(
        `INSERT INTO events (id, type, agent_id, message, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'agent_joined',
          agentId,
          `${payload.name} generated by Agent Factory`,
          JSON.stringify({ source: 'agent_factory', reference_sheet_id: referenceId }),
          now,
        ],
      );
    });

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);

    return NextResponse.json(
      {
        agent,
        reference_sheet_id: referenceId,
        reference_sheet_markdown: artifacts.referenceSheet,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Failed to generate agent from factory:', error);
    return NextResponse.json({ error: 'Failed to generate agent from factory' }, { status: 500 });
  }
}
