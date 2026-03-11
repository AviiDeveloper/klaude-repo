import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';

export const dynamic = 'force-dynamic';
const PROFILE_POLL_ATTEMPTS = 160;
const PROFILE_POLL_INTERVAL_MS = 800;
const DEFAULT_POLL_ATTEMPTS = 48;
const DEFAULT_POLL_INTERVAL_MS = 700;

type SuggestMode = 'profile' | 'interview_questions' | 'interview_next' | 'interview_profile';

interface SuggestBody {
  mode?: SuggestMode;
  workspace_id?: string;
  name?: string;
  role?: string;
  objective?: string;
  specialization?: string;
  interview_answers?: Array<{ id?: string; question?: string; answer?: string }>;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractJSON(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {}

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

async function getLatestAssistantText(sessionKey: string): Promise<string | null> {
  const client = getOpenClawClient();
  const result = await withTimeout(
    client.call<{
      messages: Array<{
        role: string;
        content?: Array<{ type?: string; text?: string }>;
        errorMessage?: string;
      }>;
    }>('chat.history', { sessionKey, limit: 20 }),
    5000,
    'chat_history',
  );

  const assistantMessages = (result.messages || []).filter((m) => m.role === 'assistant');
  const last = assistantMessages[assistantMessages.length - 1];
  if (!last) return null;

  const textContent = (last.content || []).find((c) => c.type === 'text' && c.text);
  if (textContent?.text) return textContent.text;
  if (last.errorMessage) return `ERROR: ${last.errorMessage}`;
  return null;
}

function buildPrompt(mode: SuggestMode, body: SuggestBody, objective: string): string {
  if (mode === 'interview_next') {
    const prior = (body.interview_answers || [])
      .map((a, idx) => `${idx + 1}. Q: ${(a.question || '').trim()}\n   A: ${(a.answer || '').trim()}`)
      .join('\n');

    return `You are conducting a high-signal onboarding interview for building an industry-grade AI agent profile.

Return ONLY valid JSON with this exact shape:
{
  "done": false,
  "target_count": 6,
  "question": { "id": "qN", "question": "...", "why": "..." }
}

OR if sufficient information is collected:
{
  "done": true,
  "target_count": 6
}

Rules:
- Ask exactly ONE next best question.
- The next question must be tailored to prior answers.
- Do not repeat previous questions.
- Keep question short and concrete.
- Avoid over-indexing on tool stack too early; prioritize mission, outcomes, role identity, authority, quality bar, escalation/reporting.
- Ask tool/integration specifics only after mission + role boundaries are clear.
- target_count should usually be 6 (can be 5-7 if justified).
- Brief:
  - name: ${body.name || 'Agent'}
  - role: ${body.role || 'automation'}
  - specialization: ${body.specialization || 'generalist'}
  - objective: ${objective || 'not provided'}

Prior interview answers:
${prior || 'None yet'}
`;
  }

  if (mode === 'interview_questions') {
    return `You are an expert onboarding architect for professional AI agents.

Return ONLY valid JSON with this exact shape:
{
  "questions": [
    { "id": "q1", "question": "...", "why": "..." }
  ]
}

Rules:
- Return exactly 8 questions.
- Questions must be short, concrete, and directly useful to build a high-performing professional agent profile.
- Cover role identity, mission scope, authority limits, quality bar, escalation, and reporting expectations.
- "why" must explain why each answer improves downstream execution quality.
- Tailor questions to this brief:
  - name: ${body.name || 'Agent'}
  - role: ${body.role || 'automation'}
  - specialization: ${body.specialization || 'generalist'}
  - objective: ${objective || 'not provided'}
`;
  }

  if (mode === 'interview_profile') {
    const interview = (body.interview_answers || [])
      .map((a, idx) => `${idx + 1}. Q: ${(a.question || '').trim()}\n   A: ${(a.answer || '').trim()}`)
      .join('\n');

    return `You are designing a highly capable professional AI employee profile from interview answers.

Return ONLY valid JSON (no markdown) with these exact keys:
- context_sheet
- identity_role_title
- identity_seniority_experience
- identity_core_belief
- identity_decision_style
- identity_professional_ego
- expertise_primary_skills
- expertise_secondary_skills
- expertise_domain_knowledge
- expertise_failure_modes
- expertise_quality_bar
- industry_context
- operating_context_org_identity
- operating_context_team_map
- operating_context_org_glossary
- operating_context_non_negotiables
- operating_context_political_awareness
- competency_profile
- knowledge_sources
- autonomy_level
- risk_tolerance
- tool_stack
- handoff_targets
- approval_required_actions
- output_contract
- quality_bar
- decision_framework
- constraints_and_policies
- escalation_protocol
- reporting_contract
- communication_voice_tone
- communication_output_format
- communication_reporting_standard
- communication_escalation_language
- communication_never_says
- authority_acts_alone_on
- authority_flags_before_acting_on
- authority_never_without_instruction
- authority_confidence_threshold
- authority_scope_creep_rule
- professional_definition_of_done
- professional_self_review_process
- professional_bad_day_standard
- professional_pride_standard
- heartbeat_on_wake
- heartbeat_on_load
- heartbeat_on_think
- heartbeat_on_act
- heartbeat_on_write
- heartbeat_on_report
- heartbeat_on_sleep
- kpi_targets
- learning_loop
- cadence

Rules:
- context_sheet must be a concise operator-facing synthesis used as the source context during profile creation.
- Each other key must be a concise but specific string.
- autonomy_level must be exactly one of: assisted, semi-autonomous, autonomous.
- risk_tolerance must be exactly one of: low, medium, high.
- The following keys must be comma-separated: competency_profile, knowledge_sources, tool_stack, handoff_targets, approval_required_actions, expertise_primary_skills, expertise_secondary_skills, kpi_targets.
- Preserve user intent from the interview.
- Brief:
  - name: ${body.name || 'Agent'}
  - role: ${body.role || 'automation'}
  - specialization: ${body.specialization || 'generalist'}
  - objective: ${objective || 'not provided'}

Interview answers:
${interview || 'No interview answers provided.'}
`;
  }

  return `You are designing a highly capable professional AI employee profile.

Return ONLY valid JSON (no markdown) with these exact string keys:
- identity_role_title
- identity_seniority_experience
- identity_core_belief
- identity_decision_style
- identity_professional_ego
- expertise_primary_skills
- expertise_secondary_skills
- expertise_domain_knowledge
- expertise_failure_modes
- expertise_quality_bar
- industry_context
- operating_context_org_identity
- operating_context_team_map
- operating_context_org_glossary
- operating_context_non_negotiables
- operating_context_political_awareness
- competency_profile
- knowledge_sources
- autonomy_level
- risk_tolerance
- tool_stack
- handoff_targets
- approval_required_actions
- output_contract
- quality_bar
- decision_framework
- constraints_and_policies
- escalation_protocol
- reporting_contract
- communication_voice_tone
- communication_output_format
- communication_reporting_standard
- communication_escalation_language
- communication_never_says
- authority_acts_alone_on
- authority_flags_before_acting_on
- authority_never_without_instruction
- authority_confidence_threshold
- authority_scope_creep_rule
- professional_definition_of_done
- professional_self_review_process
- professional_bad_day_standard
- professional_pride_standard
- heartbeat_on_wake
- heartbeat_on_load
- heartbeat_on_think
- heartbeat_on_act
- heartbeat_on_write
- heartbeat_on_report
- heartbeat_on_sleep
- kpi_targets
- learning_loop
- cadence

Rules:
- each key must be a concise but thorough string with clear practical detail.
- autonomy_level must be exactly one of: assisted, semi-autonomous, autonomous.
- risk_tolerance must be exactly one of: low, medium, high.
- competency_profile, knowledge_sources, tool_stack, handoff_targets, approval_required_actions, expertise_primary_skills, expertise_secondary_skills, and kpi_targets must be comma-separated values.
- cadence should be a concise schedule phrase (example: hourly, daily 08:00, event-driven).
- tailor output to this agent brief:
  - name: ${body.name || 'Agent'}
  - role: ${body.role || 'automation'}
  - specialization: ${body.specialization || 'generalist'}
  - objective: ${objective}
`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SuggestBody;
    const objective = (body.objective || '').trim();
    const mode: SuggestMode = body.mode || 'profile';

    if (mode === 'profile' && objective.length < 8) {
      return NextResponse.json({ error: 'objective is required (min 8 chars)' }, { status: 400 });
    }

    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await withTimeout(client.connect(), 8000, 'openclaw_connect');
      } catch {
        return NextResponse.json({ error: 'OpenClaw is offline. Connect gateway first.' }, { status: 503 });
      }
    }

    const sessionKey = `agent:main:factory-suggest:${mode}:${Date.now()}`;
    const prompt = buildPrompt(mode, body, objective);

    await withTimeout(
      client.call('chat.send', {
        sessionKey,
        message: prompt,
        idempotencyKey: `factory-suggest-${mode}-${Date.now()}`,
      }),
      8000,
      'chat_send',
    );

    const pollAttempts = mode === 'interview_profile' ? PROFILE_POLL_ATTEMPTS : DEFAULT_POLL_ATTEMPTS;
    const pollIntervalMs = mode === 'interview_profile' ? PROFILE_POLL_INTERVAL_MS : DEFAULT_POLL_INTERVAL_MS;

    let assistantText: string | null = null;
    let parsed: unknown = null;

    for (let i = 0; i < pollAttempts; i += 1) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      assistantText = await getLatestAssistantText(sessionKey);
      if (!assistantText || assistantText.startsWith('ERROR:')) continue;
      parsed = extractJSON(assistantText);
      if (parsed) break;
    }

    if (!assistantText) {
      return NextResponse.json(
        {
          error: `No model response from OpenClaw yet (waited ~${Math.round(
            (pollAttempts * pollIntervalMs) / 1000,
          )}s). Try again.`,
        },
        { status: 504 },
      );
    }

    if (assistantText.startsWith('ERROR:')) {
      return NextResponse.json({ error: assistantText.replace('ERROR:', '').trim() }, { status: 502 });
    }

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'Model returned invalid JSON for agent profile suggestion.' }, { status: 502 });
    }

    const payload = parsed as Record<string, unknown>;

    if (mode === 'interview_questions') {
      const rawQuestions = Array.isArray(payload.questions) ? payload.questions : [];
      const questions = rawQuestions
        .map((q, idx) => {
          const row = (q || {}) as Record<string, unknown>;
          return {
            id: String(row.id || `q${idx + 1}`),
            question: String(row.question || '').trim(),
            why: String(row.why || '').trim(),
          };
        })
        .filter((q) => q.question.length > 0)
        .slice(0, 8);

      if (questions.length === 0) {
        return NextResponse.json({ error: 'AI returned no interview questions.' }, { status: 502 });
      }

      return NextResponse.json({ questions });
    }

    if (mode === 'interview_next') {
      const done = Boolean(payload.done);
      const target_count = typeof payload.target_count === 'number' ? payload.target_count : 6;
      if (done) {
        return NextResponse.json({ done: true, target_count });
      }
      const row = (payload.question || {}) as Record<string, unknown>;
      const question = String(row.question || '').trim();
      if (!question) {
        return NextResponse.json({ error: 'AI did not return next interview question.' }, { status: 502 });
      }
      return NextResponse.json({
        done: false,
        target_count,
        question: {
          id: String(row.id || `q${(body.interview_answers || []).length + 1}`),
          question,
          why: String(row.why || '').trim(),
        },
      });
    }

    const suggestion: Record<string, string> = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (typeof value === 'string') suggestion[key] = value;
    });

    const context_sheet = typeof payload.context_sheet === 'string' ? payload.context_sheet : '';

    return NextResponse.json({ suggestion, context_sheet });
  } catch (error) {
    console.error('Failed to suggest agent profile:', error);
    return NextResponse.json({ error: 'Failed to suggest agent profile' }, { status: 500 });
  }
}
