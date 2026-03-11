'use client';

import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, Sparkles, Wand2, X } from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import type { Agent } from '@/lib/types';

interface AgentFactoryModalProps {
  onClose: () => void;
  workspaceId?: string;
}

type Autonomy = 'assisted' | 'semi-autonomous' | 'autonomous';
type RiskTolerance = 'low' | 'medium' | 'high';

interface FactoryFormState {
  name: string;
  role: string;
  objective: string;
  specialization: string;
  autonomy_level: Autonomy;
  risk_tolerance: RiskTolerance;
  tool_stack: string;
  handoff_targets: string;
  approval_required_actions: string;
  output_contract: string;
  cadence: string;
  industry_context: string;
  competency_profile: string;
  knowledge_sources: string;
  quality_bar: string;
  decision_framework: string;
  constraints_and_policies: string;
  escalation_protocol: string;
  reporting_contract: string;
  kpi_targets: string;
  learning_loop: string;
  identity_role_title: string;
  identity_seniority_experience: string;
  identity_core_belief: string;
  identity_decision_style: string;
  identity_professional_ego: string;
  expertise_primary_skills: string;
  expertise_secondary_skills: string;
  expertise_domain_knowledge: string;
  expertise_failure_modes: string;
  expertise_quality_bar: string;
  operating_context_org_identity: string;
  operating_context_team_map: string;
  operating_context_org_glossary: string;
  operating_context_non_negotiables: string;
  operating_context_political_awareness: string;
  communication_voice_tone: string;
  communication_output_format: string;
  communication_reporting_standard: string;
  communication_escalation_language: string;
  communication_never_says: string;
  authority_acts_alone_on: string;
  authority_flags_before_acting_on: string;
  authority_never_without_instruction: string;
  authority_confidence_threshold: string;
  authority_scope_creep_rule: string;
  professional_definition_of_done: string;
  professional_self_review_process: string;
  professional_bad_day_standard: string;
  professional_pride_standard: string;
  heartbeat_on_wake: string;
  heartbeat_on_load: string;
  heartbeat_on_think: string;
  heartbeat_on_act: string;
  heartbeat_on_write: string;
  heartbeat_on_report: string;
  heartbeat_on_sleep: string;
}

interface OnboardingField {
  key: keyof FactoryFormState;
  title: string;
  description: string;
  required?: boolean;
}

interface OnboardingSection {
  id: string;
  title: string;
  subtitle: string;
  fields: Array<keyof FactoryFormState>;
}

interface InterviewQuestion {
  id: string;
  question: string;
  why: string;
}

const DEFAULT_FORM: FactoryFormState = {
  name: '',
  role: '',
  objective: '',
  specialization: '',
  autonomy_level: 'semi-autonomous',
  risk_tolerance: 'medium',
  tool_stack: '',
  handoff_targets: '',
  approval_required_actions: '',
  output_contract: '',
  cadence: '',
  industry_context: '',
  competency_profile: '',
  knowledge_sources: '',
  quality_bar: '',
  decision_framework: '',
  constraints_and_policies: '',
  escalation_protocol: '',
  reporting_contract: '',
  kpi_targets: '',
  learning_loop: '',
  identity_role_title: '',
  identity_seniority_experience: '',
  identity_core_belief: '',
  identity_decision_style: '',
  identity_professional_ego: '',
  expertise_primary_skills: '',
  expertise_secondary_skills: '',
  expertise_domain_knowledge: '',
  expertise_failure_modes: '',
  expertise_quality_bar: '',
  operating_context_org_identity: '',
  operating_context_team_map: '',
  operating_context_org_glossary: '',
  operating_context_non_negotiables: '',
  operating_context_political_awareness: '',
  communication_voice_tone: '',
  communication_output_format: '',
  communication_reporting_standard: '',
  communication_escalation_language: '',
  communication_never_says: '',
  authority_acts_alone_on: '',
  authority_flags_before_acting_on: '',
  authority_never_without_instruction: '',
  authority_confidence_threshold: '',
  authority_scope_creep_rule: '',
  professional_definition_of_done: '',
  professional_self_review_process: '',
  professional_bad_day_standard: '',
  professional_pride_standard: '',
  heartbeat_on_wake: '',
  heartbeat_on_load: '',
  heartbeat_on_think: '',
  heartbeat_on_act: '',
  heartbeat_on_write: '',
  heartbeat_on_report: '',
  heartbeat_on_sleep: '',
};

const ONBOARDING_FIELDS: OnboardingField[] = [
  { key: 'name', title: 'Agent Name', description: 'Define a clear professional identity.', required: true },
  { key: 'role', title: 'Role Label', description: 'Role type shown in orchestration and handoffs.', required: true },
  { key: 'identity_role_title', title: 'Identity: Role Title', description: 'Specific professional title, not generic.', required: true },
  { key: 'identity_seniority_experience', title: 'Identity: Seniority & Experience', description: 'Expected level of professional experience.', required: true },
  { key: 'identity_core_belief', title: 'Identity: Core Belief', description: 'What this agent fundamentally values in work quality.', required: true },
  { key: 'identity_decision_style', title: 'Identity: Decision Style', description: 'How the agent approaches decisions under uncertainty.', required: true },
  { key: 'identity_professional_ego', title: 'Identity: Professional Ego', description: 'What this agent is proud of and refuses to do poorly.', required: true },
  { key: 'objective', title: 'Mission Objective', description: 'Primary business outcome this agent must deliver.', required: true },
  { key: 'specialization', title: 'Specialization Domain', description: 'Operational focus domain.', required: true },
  { key: 'expertise_primary_skills', title: 'Expertise: Primary Skills', description: '3-5 strongest professional skills (comma-separated).', required: true },
  { key: 'expertise_secondary_skills', title: 'Expertise: Secondary Skills', description: 'Supporting competencies used regularly.', required: true },
  { key: 'expertise_domain_knowledge', title: 'Expertise: Domain Knowledge', description: 'Industry vocabulary, standards, and best practices.', required: true },
  { key: 'expertise_failure_modes', title: 'Expertise: Known Failure Modes', description: 'Mistakes this role must actively avoid.', required: true },
  { key: 'expertise_quality_bar', title: 'Expertise: Quality Bar', description: 'What excellent output specifically looks like.', required: true },
  { key: 'industry_context', title: 'Operating Context: Industry', description: 'Operating environment and context.', required: true },
  { key: 'operating_context_org_identity', title: 'Operating Context: Organisation Identity', description: 'Who this system serves and what it stands for.', required: true },
  { key: 'operating_context_team_map', title: 'Operating Context: Team & Stakeholders', description: 'Who this agent interacts with and why.', required: true },
  { key: 'operating_context_org_glossary', title: 'Operating Context: Org Glossary', description: 'Required terms/acronyms/product names.', required: true },
  { key: 'operating_context_non_negotiables', title: 'Operating Context: Non-Negotiables', description: 'Rules that cannot be broken.', required: true },
  { key: 'operating_context_political_awareness', title: 'Operating Context: Political Awareness', description: 'Sensitive topics and decision ownership boundaries.', required: true },
  { key: 'competency_profile', title: 'Competency Profile', description: 'Core competencies for this role (comma-separated).', required: true },
  { key: 'knowledge_sources', title: 'Knowledge Sources', description: 'Trusted knowledge sources (comma-separated).', required: true },
  { key: 'autonomy_level', title: 'Autonomy Level', description: 'How independently this agent operates.', required: true },
  { key: 'risk_tolerance', title: 'Risk Tolerance', description: 'Risk posture for uncertain decisions.', required: true },
  { key: 'tool_stack', title: 'Tool Stack', description: 'Available tools and capabilities (comma-separated).', required: true },
  { key: 'handoff_targets', title: 'Handoff Targets', description: 'Downstream agents this agent hands work to.', required: true },
  { key: 'approval_required_actions', title: 'Approval Required Actions', description: 'Actions requiring explicit approval.', required: true },
  { key: 'output_contract', title: 'Output Contract', description: 'Exact output shape and structure expected.', required: true },
  { key: 'quality_bar', title: 'Output Quality Gate', description: 'Legacy quality contract used by existing runtime modules.', required: true },
  { key: 'decision_framework', title: 'Decision Framework', description: 'Default reasoning flow for execution.', required: true },
  { key: 'constraints_and_policies', title: 'Constraints & Policies', description: 'Policy/legal/safety/budget constraints.', required: true },
  { key: 'escalation_protocol', title: 'Escalation Protocol', description: 'How and when this agent escalates blockers.', required: true },
  { key: 'reporting_contract', title: 'Reporting Contract', description: 'Status/completion update contract.', required: true },
  { key: 'communication_voice_tone', title: 'Communication: Voice & Tone', description: 'How this agent should sound in outputs.', required: true },
  { key: 'communication_output_format', title: 'Communication: Output Format', description: 'Default communication formatting standard.', required: true },
  { key: 'communication_reporting_standard', title: 'Communication: Reporting Standard', description: 'What every update must include.', required: true },
  { key: 'communication_escalation_language', title: 'Communication: Escalation Language', description: 'Exact style for blocker/escalation messages.', required: true },
  { key: 'communication_never_says', title: 'Communication: Never Says', description: 'Phrases/tones disallowed for this agent.', required: true },
  { key: 'authority_acts_alone_on', title: 'Authority: Acts Alone On', description: 'Decisions this agent can execute autonomously.', required: true },
  { key: 'authority_flags_before_acting_on', title: 'Authority: Flags Before Acting', description: 'Actions requiring heads-up before execution.', required: true },
  { key: 'authority_never_without_instruction', title: 'Authority: Never Without Explicit Instruction', description: 'Out-of-bounds actions without direct instruction.', required: true },
  { key: 'authority_confidence_threshold', title: 'Authority: Confidence Threshold', description: 'Escalation threshold for uncertainty.', required: true },
  { key: 'authority_scope_creep_rule', title: 'Authority: Scope Creep Rule', description: 'How to handle adjacent problems outside scope.', required: true },
  { key: 'professional_definition_of_done', title: 'Professional Standards: Definition of Done', description: 'Completion criteria for this role.', required: true },
  { key: 'professional_self_review_process', title: 'Professional Standards: Self-Review Process', description: 'Checks run before submission.', required: true },
  { key: 'professional_bad_day_standard', title: 'Professional Standards: Bad-Day Standard', description: 'Minimum behavior under pressure.', required: true },
  { key: 'professional_pride_standard', title: 'Professional Standards: Pride Standard', description: 'What good/bad output looks like for this agent.', required: true },
  { key: 'heartbeat_on_wake', title: 'Heartbeat: On WAKE', description: 'Behavior at wake cycle start.', required: true },
  { key: 'heartbeat_on_load', title: 'Heartbeat: On LOAD', description: 'Context validation behavior.', required: true },
  { key: 'heartbeat_on_think', title: 'Heartbeat: On THINK', description: 'Planning behavior before action.', required: true },
  { key: 'heartbeat_on_act', title: 'Heartbeat: On ACT', description: 'Execution behavior per cycle.', required: true },
  { key: 'heartbeat_on_write', title: 'Heartbeat: On WRITE', description: 'Logging behavior per cycle.', required: true },
  { key: 'heartbeat_on_report', title: 'Heartbeat: On REPORT', description: 'Operator reporting behavior.', required: true },
  { key: 'heartbeat_on_sleep', title: 'Heartbeat: On SLEEP', description: 'End-of-cycle memory handling.', required: true },
  { key: 'kpi_targets', title: 'KPI Targets', description: 'Performance targets (comma-separated).', required: true },
  { key: 'learning_loop', title: 'Learning Loop', description: 'How this agent improves run-over-run.', required: true },
  { key: 'cadence', title: 'Cadence', description: 'How frequently this agent runs.', required: true },
];

const FIELD_MAP: Record<keyof FactoryFormState, OnboardingField> = ONBOARDING_FIELDS.reduce(
  (acc, field) => {
    acc[field.key] = field;
    return acc;
  },
  {} as Record<keyof FactoryFormState, OnboardingField>,
);

const SECTIONS: OnboardingSection[] = [
  {
    id: 'identity',
    title: '1. Identity',
    subtitle: 'Define who this agent is as a professional.',
    fields: ['name', 'role', 'identity_role_title', 'identity_seniority_experience', 'identity_core_belief', 'identity_decision_style', 'identity_professional_ego'],
  },
  {
    id: 'expertise',
    title: '2. Expertise',
    subtitle: 'Define domain competence and quality benchmark.',
    fields: ['specialization', 'expertise_primary_skills', 'expertise_secondary_skills', 'expertise_domain_knowledge', 'expertise_failure_modes', 'expertise_quality_bar'],
  },
  {
    id: 'operating_context',
    title: '3. Operating Context',
    subtitle: 'Define organisational environment and boundaries.',
    fields: ['industry_context', 'operating_context_org_identity', 'operating_context_team_map', 'operating_context_org_glossary', 'operating_context_non_negotiables', 'operating_context_political_awareness'],
  },
  {
    id: 'current_situation',
    title: '4. Mission & Performance',
    subtitle: 'Define mission, outcomes, and recurring execution loop.',
    fields: ['objective', 'cadence', 'kpi_targets', 'learning_loop'],
  },
  {
    id: 'tools_capabilities',
    title: '5. Tools & Capabilities',
    subtitle: 'Define tooling, autonomy, and downstream handoffs.',
    fields: ['autonomy_level', 'risk_tolerance', 'tool_stack', 'handoff_targets', 'approval_required_actions'],
  },
  {
    id: 'communication',
    title: '6. Communication Standard',
    subtitle: 'Define voice, format, and escalation language.',
    fields: ['communication_voice_tone', 'communication_output_format', 'communication_reporting_standard', 'communication_escalation_language', 'communication_never_says'],
  },
  {
    id: 'authority',
    title: '7. Authority & Limits',
    subtitle: 'Define what the agent can and cannot do autonomously.',
    fields: ['authority_acts_alone_on', 'authority_flags_before_acting_on', 'authority_never_without_instruction', 'authority_confidence_threshold', 'authority_scope_creep_rule'],
  },
  {
    id: 'professional_standards',
    title: '8. Professional Standards',
    subtitle: 'Define definition of done and self-review quality discipline.',
    fields: ['professional_definition_of_done', 'professional_self_review_process', 'professional_bad_day_standard', 'professional_pride_standard'],
  },
  {
    id: 'heartbeat',
    title: '9. Heartbeat Behaviour',
    subtitle: 'Define per-cycle behavior from wake to sleep.',
    fields: ['heartbeat_on_wake', 'heartbeat_on_load', 'heartbeat_on_think', 'heartbeat_on_act', 'heartbeat_on_write', 'heartbeat_on_report', 'heartbeat_on_sleep'],
  },
  {
    id: 'contracts',
    title: '10. Execution Contracts',
    subtitle: 'Define hard execution contracts used at runtime.',
    fields: ['output_contract', 'quality_bar', 'decision_framework', 'constraints_and_policies', 'escalation_protocol', 'reporting_contract', 'competency_profile', 'knowledge_sources'],
  },
];

const LONG_FIELDS = new Set<keyof FactoryFormState>([
  'objective',
  'output_contract',
  'quality_bar',
  'decision_framework',
  'constraints_and_policies',
  'escalation_protocol',
  'reporting_contract',
  'learning_loop',
  'identity_seniority_experience',
  'identity_core_belief',
  'identity_decision_style',
  'identity_professional_ego',
  'expertise_domain_knowledge',
  'expertise_failure_modes',
  'expertise_quality_bar',
  'operating_context_org_identity',
  'operating_context_team_map',
  'operating_context_org_glossary',
  'operating_context_non_negotiables',
  'operating_context_political_awareness',
  'communication_voice_tone',
  'communication_output_format',
  'communication_reporting_standard',
  'communication_escalation_language',
  'communication_never_says',
  'authority_acts_alone_on',
  'authority_flags_before_acting_on',
  'authority_never_without_instruction',
  'authority_confidence_threshold',
  'authority_scope_creep_rule',
  'professional_definition_of_done',
  'professional_self_review_process',
  'professional_bad_day_standard',
  'professional_pride_standard',
  'heartbeat_on_wake',
  'heartbeat_on_load',
  'heartbeat_on_think',
  'heartbeat_on_act',
  'heartbeat_on_write',
  'heartbeat_on_report',
  'heartbeat_on_sleep',
]);

const CSV_FIELDS = new Set<keyof FactoryFormState>([
  'tool_stack',
  'handoff_targets',
  'approval_required_actions',
  'competency_profile',
  'knowledge_sources',
  'kpi_targets',
  'expertise_primary_skills',
  'expertise_secondary_skills',
]);

function isFieldSatisfied(form: FactoryFormState, fieldKey: keyof FactoryFormState): boolean {
  const value = String(form[fieldKey] ?? '').trim();
  return value.length > (LONG_FIELDS.has(fieldKey) ? 8 : 2);
}

function mergeSuggestionPreservingManual(base: FactoryFormState, suggestion: Record<string, string>): FactoryFormState {
  const next: FactoryFormState = { ...base };
  (Object.keys(base) as Array<keyof FactoryFormState>).forEach((key) => {
    const incoming = suggestion[key];
    if (typeof incoming !== 'string' || incoming.trim().length === 0) return;
    if (String(base[key] ?? '').trim().length > 0) return;
    if (key === 'autonomy_level' && (incoming === 'assisted' || incoming === 'semi-autonomous' || incoming === 'autonomous')) {
      next[key] = incoming as FactoryFormState[typeof key];
      return;
    }
    if (key === 'risk_tolerance' && (incoming === 'low' || incoming === 'medium' || incoming === 'high')) {
      next[key] = incoming as FactoryFormState[typeof key];
      return;
    }
    (next as Record<keyof FactoryFormState, string>)[key] = incoming.trim();
  });
  return next;
}

function withBaselineRequiredFields(form: FactoryFormState, contextSheet: string): FactoryFormState {
  const next = { ...form };
  if (!next.role.trim()) next.role = 'automation';
  if (!next.specialization.trim()) next.specialization = 'operations';
  if (!next.name.trim()) {
    next.name = next.identity_role_title?.trim()
      ? `${next.identity_role_title.trim().split(' ')[0]} Agent`
      : 'Professional Agent';
  }
  if (!next.objective.trim()) {
    const fallbackObjective = contextSheet
      .split(/[.!?]/)
      .map((s) => s.trim())
      .find((s) => s.length > 12);
    if (fallbackObjective) next.objective = fallbackObjective;
  }
  return next;
}

export function AgentFactoryModal({ onClose, workspaceId }: AgentFactoryModalProps) {
  const { addAgent } = useMissionControl();

  const [form, setForm] = useState<FactoryFormState>(DEFAULT_FORM);
  const [currentSection, setCurrentSection] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isInterviewing, setIsInterviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSheet, setGeneratedSheet] = useState('');
  const [generatedAgent, setGeneratedAgent] = useState<Agent | null>(null);
  const [operationKind, setOperationKind] = useState<'interview' | 'draft' | 'generate' | null>(null);
  const [operationStage, setOperationStage] = useState('');
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [operationElapsedSec, setOperationElapsedSec] = useState(0);
  const [logicTrace, setLogicTrace] = useState<string[]>([]);

  const [aiBootstrapDone, setAiBootstrapDone] = useState(false);
  const [manualFallbackEnabled, setManualFallbackEnabled] = useState(false);
  const [contextSheet, setContextSheet] = useState('');
  const [interviewHistory, setInterviewHistory] = useState<Array<InterviewQuestion & { answer: string }>>([]);
  const [currentInterviewQuestion, setCurrentInterviewQuestion] = useState<InterviewQuestion | null>(null);
  const [currentInterviewAnswer, setCurrentInterviewAnswer] = useState('');
  const [targetInterviewCount, setTargetInterviewCount] = useState(6);

  const section = SECTIONS[currentSection];
  const isLastSection = currentSection === SECTIONS.length - 1;
  const sectionCompletionPct = Math.round(((currentSection + 1) / SECTIONS.length) * 100);
  const bootstrapReady = aiBootstrapDone || manualFallbackEnabled;

  const canProceedSection = useMemo(
    () => section.fields.every((fieldKey) => isFieldSatisfied(form, fieldKey)),
    [form, section.fields],
  );

  const allRequiredDone = useMemo(
    () => ONBOARDING_FIELDS.filter((f) => f.required).every((f) => isFieldSatisfied(form, f.key)),
    [form],
  );

  const canGenerate = allRequiredDone && bootstrapReady;

  useEffect(() => {
    if (!operationStartedAt) {
      setOperationElapsedSec(0);
      return;
    }
    const tick = () => setOperationElapsedSec(Math.max(0, Math.floor((Date.now() - operationStartedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [operationStartedAt]);

  function pushTrace(message: string) {
    const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLogicTrace((prev) => [...prev.slice(-10), `${stamp} · ${message}`]);
  }

  function startOperation(kind: 'interview' | 'draft' | 'generate', stage: string) {
    setOperationKind(kind);
    setOperationStage(stage);
    setOperationStartedAt(Date.now());
    setLogicTrace([]);
    pushTrace(`${kind.toUpperCase()} started`);
    pushTrace(stage);
  }

  function updateOperationStage(stageText: string) {
    setOperationStage(stageText);
    pushTrace(stageText);
  }

  function finishOperation(finalStage: string) {
    setOperationStage(finalStage);
    pushTrace(finalStage);
    setOperationKind(null);
    setOperationStartedAt(null);
  }

  async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('request_timeout')), timeoutMs);
    });
    const res = (await Promise.race([fetch(url, init), timeoutPromise])) as Response;
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function csvToArray(input: string): string[] {
    return input
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  async function requestNextInterviewQuestion(
    answers: Array<{ id: string; question: string; answer: string }>,
  ): Promise<{ question: InterviewQuestion | null; done: boolean; target_count: number }> {
    const { res, data } = await fetchJsonWithTimeout(
      '/api/agents/factory/suggest',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'interview_next',
          workspace_id: workspaceId || 'default',
          name: form.name,
          role: form.role,
          objective: form.objective,
          specialization: form.specialization,
          interview_answers: answers,
        }),
      },
      30000,
    );

    const payload = data as {
      error?: string;
      question?: { id?: string; question?: string; why?: string };
      done?: boolean;
      target_count?: number;
    };

    if (!res.ok) {
      throw new Error(payload.error || 'Failed to get next interview question');
    }

    const done = Boolean(payload.done);
    const target_count = typeof payload.target_count === 'number' ? payload.target_count : 6;

    if (done) {
      return { question: null, done: true, target_count };
    }

    const q = payload.question || {};
    const questionText = String(q.question || '').trim();
    if (!questionText) throw new Error('AI did not return a valid next question.');
    return {
      question: {
        id: String(q.id || `q${answers.length + 1}`),
        question: questionText,
        why: String(q.why || '').trim(),
      },
      done: false,
      target_count,
    };
  }

  async function startAIInterview() {
    if (isGenerating || isDrafting) return;
    startOperation('interview', 'Generating first interview question');
    setIsInterviewing(true);
    setError(null);

    try {
      const first = await requestNextInterviewQuestion([]);
      setInterviewHistory([]);
      setCurrentInterviewAnswer('');
      setCurrentInterviewQuestion(first.question);
      setTargetInterviewCount(first.target_count);
      setAiBootstrapDone(false);
      setManualFallbackEnabled(false);
      finishOperation('Interview started');
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'request_timeout'
          ? 'Interview request timed out. Check OpenClaw and retry.'
          : err instanceof Error
            ? err.message
            : 'Failed to start AI interview';
      setError(message);
      finishOperation(`Interview failed: ${message}`);
    } finally {
      setIsInterviewing(false);
    }
  }

  async function submitCurrentInterviewAnswer() {
    if (!currentInterviewQuestion || isInterviewing || isDrafting || isGenerating) return;
    const answer = currentInterviewAnswer.trim();
    if (answer.length < 3) {
      setError('Please answer the current question before continuing.');
      return;
    }

    startOperation('interview', 'Evaluating answer and generating next question');
    setIsInterviewing(true);
    setError(null);

    try {
      const nextAnswers = [
        ...interviewHistory.map((q) => ({ id: q.id, question: q.question, answer: q.answer })),
        { id: currentInterviewQuestion.id, question: currentInterviewQuestion.question, answer },
      ];

      const next = await requestNextInterviewQuestion(nextAnswers);
      setInterviewHistory((prev) => [
        ...prev,
        { ...currentInterviewQuestion, answer },
      ]);
      setCurrentInterviewAnswer('');
      setTargetInterviewCount(next.target_count);
      setCurrentInterviewQuestion(next.question);

      finishOperation(next.done ? 'Interview complete. Build context sheet next.' : 'Next interview question ready');
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'request_timeout'
          ? 'Next question request timed out. Retry.'
          : err instanceof Error
            ? err.message
            : 'Failed to continue interview';
      setError(message);
      finishOperation(`Interview failed: ${message}`);
    } finally {
      setIsInterviewing(false);
    }
  }

  async function buildFromInterview() {
    if (isGenerating || isDrafting || isInterviewing) return;
    const answered = interviewHistory.filter((q) => q.answer.trim().length >= 4);
    if (answered.length < 3) {
      setError('Answer at least 3 AI interview questions before generating the context sheet.');
      return;
    }

    startOperation('draft', 'Building AI context sheet from interview answers');
    setIsDrafting(true);
    setError(null);

    try {
      const { res, data } = await fetchJsonWithTimeout(
        '/api/agents/factory/suggest',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'interview_profile',
            workspace_id: workspaceId || 'default',
            name: form.name,
            role: form.role,
            objective: form.objective,
            specialization: form.specialization,
            interview_answers: answered.map((q) => ({
              id: q.id,
              question: q.question,
              answer: q.answer,
            })),
          }),
        },
        140000,
      );

      const payload = data as {
        error?: string;
        suggestion?: Record<string, string>;
        context_sheet?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error || 'Failed to build profile from interview');
      }

      const suggestion = payload.suggestion || {};
      const firstContextSheet = (payload.context_sheet || '').trim();
      const firstPass = withBaselineRequiredFields(mergeSuggestionPreservingManual(form, suggestion), firstContextSheet);
      const missingRequired = ONBOARDING_FIELDS.filter((f) => f.required && !isFieldSatisfied(firstPass, f.key));

      let finalForm = firstPass;
      let finalContextSheet = firstContextSheet;

      if (missingRequired.length > 0) {
        updateOperationStage(`Backfilling ${missingRequired.length} required fields with AI`);
        const fallbackObjective =
          firstPass.objective.trim() ||
          firstContextSheet.slice(0, 180) ||
          'Define mission objective from interview responses';
        const secondPassRes = await fetchJsonWithTimeout(
          '/api/agents/factory/suggest',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'profile',
              workspace_id: workspaceId || 'default',
              name: firstPass.name,
              role: firstPass.role,
              objective: fallbackObjective,
              specialization: firstPass.specialization,
            }),
          },
          100000,
        );

        const secondPayload = secondPassRes.data as {
          error?: string;
          suggestion?: Record<string, string>;
          context_sheet?: string;
        };
        if (!secondPassRes.res.ok) {
          throw new Error(secondPayload.error || 'Failed to backfill required profile fields');
        }
        finalForm = withBaselineRequiredFields(
          mergeSuggestionPreservingManual(firstPass, secondPayload.suggestion || {}),
          finalContextSheet,
        );
        if (!finalContextSheet && typeof secondPayload.context_sheet === 'string' && secondPayload.context_sheet.trim().length > 0) {
          finalContextSheet = secondPayload.context_sheet.trim();
        }
      }

      setForm(finalForm);
      setContextSheet(finalContextSheet);
      setAiBootstrapDone(true);
      setManualFallbackEnabled(false);

      const remainingRequired = ONBOARDING_FIELDS.filter((f) => f.required && !isFieldSatisfied(finalForm, f.key)).length;
      if (remainingRequired > 0) {
        updateOperationStage(`AI populated profile fields; ${remainingRequired} required fields still need confirmation`);
      } else {
        updateOperationStage('All required profile fields populated from AI context sheet');
      }
      finishOperation('AI context sheet created and applied');
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'request_timeout'
          ? 'AI profile build timed out. Retry after OpenClaw stabilizes.'
          : err instanceof Error
            ? err.message
            : 'Failed to build AI profile';
      setError(message);
      finishOperation(`Draft failed: ${message}`);
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleGenerate() {
    if (!canGenerate || isDrafting || isInterviewing) return;
    startOperation('generate', 'Validating onboarding pages');
    setIsGenerating(true);
    setError(null);

    try {
      updateOperationStage('Submitting generation request');
      const { res, data } = await fetchJsonWithTimeout(
        '/api/agents/factory',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId || 'default',
            ...form,
            tool_stack: csvToArray(form.tool_stack),
            handoff_targets: csvToArray(form.handoff_targets),
            approval_required_actions: csvToArray(form.approval_required_actions),
            competency_profile: csvToArray(form.competency_profile),
            knowledge_sources: csvToArray(form.knowledge_sources),
            kpi_targets: csvToArray(form.kpi_targets),
            expertise_primary_skills: csvToArray(form.expertise_primary_skills),
            expertise_secondary_skills: csvToArray(form.expertise_secondary_skills),
            factory_context_sheet: contextSheet,
          }),
        },
        25000,
      );

      if (!res.ok) {
        updateOperationStage('Generation request failed');
        throw new Error((data as { error?: string }).error || 'Failed to generate agent');
      }

      const payload = data as {
        agent?: Agent;
        reference_sheet_markdown?: string;
      };

      if (payload.agent) {
        addAgent(payload.agent);
        setGeneratedAgent(payload.agent);
      }
      setGeneratedSheet(payload.reference_sheet_markdown || '');
      finishOperation('Generate completed');
    } catch (err) {
      const message =
        err instanceof Error && err.message === 'request_timeout'
          ? 'Generate request timed out. Please retry.'
          : err instanceof Error
            ? err.message
            : 'Failed to generate agent';
      setError(message);
      finishOperation(`Generate failed: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function goNextSection() {
    if (!canProceedSection || isLastSection) return;
    setCurrentSection((idx) => Math.min(idx + 1, SECTIONS.length - 1));
  }

  function goBackSection() {
    setCurrentSection((idx) => Math.max(idx - 1, 0));
  }

  function updateField<K extends keyof FactoryFormState>(key: K, value: FactoryFormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function enableManualFallback() {
    setManualFallbackEnabled(true);
    setAiBootstrapDone(false);
    pushTrace('Manual fallback enabled by operator.');
  }

  function renderFieldControl(key: keyof FactoryFormState) {
    if (key === 'autonomy_level') {
      return (
        <select
          value={form.autonomy_level}
          onChange={(e) => updateField('autonomy_level', e.target.value as Autonomy)}
          className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
        >
          <option value="assisted">assisted</option>
          <option value="semi-autonomous">semi-autonomous</option>
          <option value="autonomous">autonomous</option>
        </select>
      );
    }

    if (key === 'risk_tolerance') {
      return (
        <select
          value={form.risk_tolerance}
          onChange={(e) => updateField('risk_tolerance', e.target.value as RiskTolerance)}
          className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      );
    }

    const baseProps = {
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        updateField(key, e.target.value as FactoryFormState[typeof key]),
      className:
        'w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent',
      placeholder: CSV_FIELDS.has(key)
        ? 'Comma-separated values'
        : `Enter ${key.replaceAll('_', ' ')}`,
    };

    if (LONG_FIELDS.has(key)) {
      return <textarea {...baseProps} rows={4} className={`${baseProps.className} resize-none`} />;
    }

    return <input {...baseProps} />;
  }

  const sectionStatuses = useMemo(
    () =>
      SECTIONS.map((s) => ({
        id: s.id,
        title: s.title,
        done: s.fields.every((fieldKey) => isFieldSatisfied(form, fieldKey)),
      })),
    [form],
  );

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-xl w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-mc-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-mc-accent/20 border border-mc-accent/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-mc-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agent Factory</h2>
              <p className="text-xs text-mc-text-secondary">AI interview first, then 10-page professional onboarding with manual override.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-mc-bg-tertiary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          <div className="p-5 overflow-y-auto border-r border-mc-border space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-mc-text-secondary">
                <span>Stage A: AI Interview + Context Sheet</span>
                <span>{bootstrapReady ? 'ready' : 'required'}</span>
              </div>

              <div className="rounded-lg border border-mc-border bg-mc-bg p-3 space-y-3">
                <p className="text-sm text-mc-text-secondary">
                  AI asks role-specific questions first, then generates a context sheet and uses that sheet to populate profile fields.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={startAIInterview}
                    disabled={isInterviewing || isDrafting || isGenerating}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-mc-border rounded text-sm hover:bg-mc-bg-tertiary disabled:opacity-50"
                  >
                    <Wand2 className="w-4 h-4" />
                    {isInterviewing ? 'Thinking...' : interviewHistory.length > 0 || currentInterviewQuestion ? 'Restart AI Interview' : 'Start AI Interview'}
                  </button>
                  <button
                    onClick={buildFromInterview}
                    disabled={
                      isInterviewing ||
                      isDrafting ||
                      isGenerating ||
                      (interviewHistory.length < 3 && !manualFallbackEnabled)
                    }
                    className="inline-flex items-center gap-2 px-3 py-2 border border-mc-border rounded text-sm hover:bg-mc-bg-tertiary disabled:opacity-50"
                  >
                    {isDrafting ? 'Building Context...' : 'Build Context Sheet'}
                  </button>
                  <button
                    onClick={enableManualFallback}
                    disabled={isInterviewing || isDrafting || isGenerating}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-mc-border rounded text-sm hover:bg-mc-bg-tertiary disabled:opacity-50"
                  >
                    Manual Fallback
                  </button>
                </div>
                <p className="text-xs text-mc-text-secondary">
                  Bootstrap status:{' '}
                  <span className="text-mc-text">
                    {aiBootstrapDone
                      ? 'Ready (AI interview + context sheet complete)'
                      : manualFallbackEnabled
                        ? 'Ready (manual fallback enabled)'
                        : 'Pending'}
                  </span>
                </p>
              </div>
            </div>

            {!bootstrapReady && (
              <div className="rounded-lg border border-mc-border bg-mc-bg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">AI Interview</h3>
                  <p className="text-xs text-mc-text-secondary">
                    Question {Math.min(interviewHistory.length + 1, targetInterviewCount)} of ~{targetInterviewCount}
                  </p>
                </div>

                {!currentInterviewQuestion ? (
                  <p className="text-sm text-mc-text-secondary">Start interview to get the first adaptive question.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-base">{currentInterviewQuestion.question}</p>
                    <p className="text-xs text-mc-text-secondary">
                      Why this question: {currentInterviewQuestion.why || 'It helps tune role behavior and output quality.'}
                    </p>
                    <textarea
                      value={currentInterviewAnswer}
                      onChange={(e) => setCurrentInterviewAnswer(e.target.value)}
                      rows={4}
                      className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-none"
                      placeholder="Answer this question..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={submitCurrentInterviewAnswer}
                        disabled={isInterviewing || isDrafting || isGenerating || currentInterviewAnswer.trim().length < 3}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-mc-accent text-mc-bg rounded text-sm hover:bg-mc-accent/90 disabled:opacity-50"
                      >
                        {isInterviewing ? 'Thinking...' : 'Next Question'}
                      </button>
                      <p className="text-xs text-mc-text-secondary">
                        Questions adapt from your previous answer.
                      </p>
                    </div>
                  </div>
                )}

                {interviewHistory.length > 0 && (
                  <details className="rounded border border-mc-border bg-mc-bg-secondary p-2">
                    <summary className="cursor-pointer text-xs text-mc-text-secondary">
                      View answered questions ({interviewHistory.length})
                    </summary>
                    <div className="mt-2 space-y-2 max-h-[180px] overflow-y-auto">
                      {interviewHistory.map((q) => (
                        <div key={q.id} className="text-xs text-mc-text-secondary">
                          <p className="text-mc-text">{q.question}</p>
                          <p>{q.answer}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {contextSheet && (
              <div className="rounded-lg border border-mc-border bg-mc-bg p-4 space-y-2">
                <h3 className="text-sm font-semibold">AI Context Sheet</h3>
                <pre className="text-xs whitespace-pre-wrap text-mc-text-secondary max-h-[180px] overflow-y-auto">{contextSheet}</pre>
              </div>
            )}

            {bootstrapReady && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-mc-text-secondary">
                  <span>
                    Stage B: Profile Pages ({currentSection + 1}/{SECTIONS.length})
                  </span>
                  <span>{sectionCompletionPct}%</span>
                </div>
                <div className="h-2 rounded bg-mc-bg overflow-hidden">
                  <div className="h-full bg-mc-accent transition-all duration-300" style={{ width: `${sectionCompletionPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-mc-text-secondary">
                  <span>
                    Required completion:{' '}
                    <span className="text-mc-text">
                      {ONBOARDING_FIELDS.filter((f) => f.required).filter((f) => isFieldSatisfied(form, f.key)).length}/
                      {ONBOARDING_FIELDS.filter((f) => f.required).length}
                    </span>
                  </span>
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating || isDrafting || isInterviewing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-mc-accent text-mc-bg rounded text-xs font-semibold hover:bg-mc-accent/90 disabled:opacity-50"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {isGenerating ? 'Generating...' : 'Generate Agent Now'}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-mc-border bg-mc-bg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-mc-text-secondary">
                <span>Progress Monitor</span>
                <span>{operationStartedAt ? `${operationElapsedSec}s` : 'idle'}</span>
              </div>
              <p className="text-sm">
                {operationKind
                  ? `${operationKind === 'interview' ? 'Interview' : operationKind === 'draft' ? 'AI Draft' : 'Generate'} · ${operationStage || 'Running...'}`
                  : 'No active operation'}
              </p>
              <div className="rounded border border-mc-border bg-mc-bg-secondary p-2 min-h-[86px]">
                <p className="text-xs uppercase tracking-wider text-mc-text-secondary mb-1">Logic Trace</p>
                {logicTrace.length === 0 ? (
                  <p className="text-xs text-mc-text-secondary">No trace yet. Start AI Interview, build context, then complete profile pages.</p>
                ) : (
                  <div className="space-y-1">
                    {logicTrace.map((line, idx) => (
                      <p key={`${line}-${idx}`} className="text-xs font-mono text-mc-text-secondary">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {bootstrapReady ? (
              <div className="rounded-xl border border-mc-border bg-mc-bg p-4 space-y-4">
                <div>
                  <h3 className="text-base font-semibold">{section.title}</h3>
                  <p className="text-sm text-mc-text-secondary">{section.subtitle}</p>
                </div>

                {section.fields.map((fieldKey) => {
                  const field = FIELD_MAP[fieldKey];
                  const ok = isFieldSatisfied(form, fieldKey);
                  return (
                    <div key={fieldKey} className="space-y-1">
                      <p className="text-sm font-semibold">{field.title}</p>
                      <p className="text-xs text-mc-text-secondary">{field.description}</p>
                      {renderFieldControl(fieldKey)}
                      {!ok && <p className="text-xs text-mc-accent-red">This field is required.</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-mc-border bg-mc-bg p-4 text-sm text-mc-text-secondary">
                Complete AI interview and build the context sheet to unlock profile pages.
              </div>
            )}

            {error && <div className="text-sm text-mc-accent-red">{error}</div>}

            {bootstrapReady && (
              <>
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={goBackSection}
                    disabled={currentSection === 0}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-mc-border rounded text-sm hover:bg-mc-bg-tertiary disabled:opacity-40"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  {!isLastSection ? (
                    <button
                      onClick={goNextSection}
                      disabled={!canProceedSection}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded font-medium hover:bg-mc-accent/90 disabled:opacity-50"
                    >
                      Next Page
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={!canGenerate || isGenerating || isDrafting || isInterviewing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded font-medium hover:bg-mc-accent/90 disabled:opacity-50"
                    >
                      <Bot className="w-4 h-4" />
                      {isGenerating ? 'Generating...' : 'Generate Agent'}
                    </button>
                  )}
                </div>

                <div className="text-xs text-mc-text-secondary">
                  Final generation unlocks when all required fields are complete and AI interview bootstrap (or manual fallback) is set.
                </div>
              </>
            )}
          </div>

          <div className="p-5 overflow-y-auto bg-mc-bg space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-mc-text-secondary">Onboarding Summary</h3>
            {bootstrapReady ? (
              <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-3 space-y-2 text-sm">
                {sectionStatuses.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    {s.done ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <span className="text-mc-text-secondary">{idx + 1}.</span>}
                    <p className="truncate">{s.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-3 space-y-2 text-sm">
                <p className="text-mc-text-secondary">Interview progress</p>
                <p>Answered: {interviewHistory.length}</p>
                <p>Target: ~{targetInterviewCount}</p>
                <p className="text-mc-text-secondary">One adaptive question is shown at a time.</p>
              </div>
            )}

            {generatedAgent && (
              <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 space-y-1">
                <p className="font-semibold">Agent Generated</p>
                <p className="text-sm text-mc-text-secondary">
                  {generatedAgent.name} ({generatedAgent.role})
                </p>
              </div>
            )}

            {generatedSheet && (
              <div className="rounded-xl border border-mc-border bg-mc-bg-secondary p-3 space-y-2">
                <p className="text-sm font-semibold">Generated Reference Dossier</p>
                <pre className="text-xs whitespace-pre-wrap max-h-[320px] overflow-y-auto text-mc-text-secondary">{generatedSheet}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
