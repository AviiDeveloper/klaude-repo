import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import type { LearningQuestion } from '@/lib/types';

interface ExpectedAnswerSpec {
  key_points: string[];
  tradeoff: string;
  risk_if_changed: string;
  concept: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function containsKeywords(answer: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const text = answer.toLowerCase();
  let matches = 0;
  for (const keyword of keywords) {
    const parts = tokenize(keyword).filter((part) => part.length >= 4);
    if (parts.length === 0) continue;
    if (parts.some((part) => text.includes(part))) matches += 1;
  }
  return matches;
}

function suggestResource(concept: string): string {
  const c = concept.toLowerCase();
  if (c.includes('approval')) return 'Read: SPEC.md section on approval gates and side-effect policy.';
  if (c.includes('orchestr')) return 'Read: ADR-0012 and lead-orchestrator flow in Mission Control.';
  if (c.includes('event')) return 'Read: ADR-0002 event bus decisions and OPERATIONS/OBSERVABILITY.md.';
  if (c.includes('dag')) return 'Read: ADR-0012 multi-agent DAG scheduler rationale.';
  return 'Review latest ADR/changelog entry related to this change and summarize tradeoffs.';
}

function buildQuestionFromDecision(decision: {
  decision_type: string;
  summary: string;
  details_json?: string | null;
  task_title?: string | null;
}): { question: string; expected: ExpectedAnswerSpec; concept: string } {
  const details = parseJson<Record<string, unknown>>(decision.details_json, {});
  const decisionType = decision.decision_type || 'decision';
  const taskTitle = decision.task_title || 'the task';

  if (decisionType.includes('approval')) {
    return {
      question: `Why is approval mediation mandatory in ${taskTitle}, and what risk appears if workers can bypass Lead approval?`,
      expected: {
        key_points: [
          'approval gate prevents unsafe side effects',
          'lead mediation centralizes operator control',
          'worker autonomy is bounded by tokenized approval',
        ],
        tradeoff: 'slower execution in exchange for safety and governance',
        risk_if_changed: 'unreviewed side effects could execute',
        concept: 'approval-gated orchestration',
      },
      concept: 'approval-gated orchestration',
    };
  }

  if (decisionType.includes('delegate') || decisionType.includes('intake')) {
    return {
      question: `Charlie delegated ${taskTitle}. Explain why delegation should use specialization + load + reliability (not random assignment), and what failure mode this avoids.`,
      expected: {
        key_points: [
          'specialization fit improves output quality',
          'load balancing prevents queue congestion',
          'reliability/eval history reduces repeated failures',
        ],
        tradeoff: 'more scoring complexity for better task outcomes',
        risk_if_changed: 'wrong-agent assignments and quality regressions',
        concept: 'supervisor delegation scoring',
      },
      concept: 'supervisor delegation scoring',
    };
  }

  const selectedAgent = typeof details.selected_agent_name === 'string' ? details.selected_agent_name : 'the selected agent';
  return {
    question: `A recent Lead decision selected ${selectedAgent}. Why might this design favor deterministic decision logs over implicit reasoning, and what would break if that trace was missing?`,
    expected: {
      key_points: [
        'decision logs provide auditability',
        'trace enables debugging and accountability',
        'operator can verify orchestration rationale',
      ],
      tradeoff: 'more logging/storage for explainability',
      risk_if_changed: 'opaque orchestration and harder incident recovery',
      concept: 'decision traceability',
    },
    concept: 'decision traceability',
  };
}

export function generateLearningQuestion(input: {
  workspaceId: string;
  sourceType?: 'git_diff' | 'decision_log' | 'manual';
  sourceRef?: string;
  promptContext?: string;
}): LearningQuestion {
  const sourceType = input.sourceType || 'decision_log';
  let questionText = '';
  let expected: ExpectedAnswerSpec;
  let concept = '';
  let sourceRef = input.sourceRef || null;

  if (sourceType === 'manual' && input.promptContext) {
    questionText = `Given this planned change: "${input.promptContext}", what architecture tradeoff matters most, and what could fail if the chosen pattern is changed?`;
    expected = {
      key_points: ['tradeoff identified', 'failure mode explained', 'reasoning tied to system constraints'],
      tradeoff: 'context dependent',
      risk_if_changed: 'hidden coupling and behavior regressions',
      concept: 'architecture tradeoff reasoning',
    };
    concept = expected.concept;
  } else {
    const latestDecision = queryOne<{
      id: string;
      decision_type: string;
      summary: string;
      details_json?: string | null;
      task_title?: string | null;
    }>(
      `SELECT d.id, d.decision_type, d.summary, d.details_json, t.title as task_title
       FROM lead_decision_logs d
       LEFT JOIN tasks t ON t.id = d.task_id
       WHERE d.workspace_id = ?
       ORDER BY d.created_at DESC
       LIMIT 1`,
      [input.workspaceId],
    );

    if (!latestDecision) {
      questionText = 'Why does this project enforce approval-gated side effects before execution, and what system risk does this prevent?';
      expected = {
        key_points: ['approval gate', 'side-effect safety', 'operator control'],
        tradeoff: 'additional approval latency',
        risk_if_changed: 'unsafe autonomous actions',
        concept: 'approval-gated orchestration',
      };
      concept = expected.concept;
    } else {
      const built = buildQuestionFromDecision(latestDecision);
      questionText = built.question;
      expected = built.expected;
      concept = built.concept;
      sourceRef = latestDecision.id;
    }
  }

  const id = uuidv4();
  const now = nowIso();
  run(
    `INSERT INTO learning_questions
      (id, workspace_id, source_type, source_ref, question, expected_answer_json, concept_tag, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.workspaceId, sourceType, sourceRef, questionText, JSON.stringify(expected), concept, now],
  );

  return queryOne<LearningQuestion>('SELECT * FROM learning_questions WHERE id = ?', [id]) as LearningQuestion;
}

export function getLatestLearningQuestion(workspaceId: string): LearningQuestion | undefined {
  return queryOne<LearningQuestion>(
    `SELECT * FROM learning_questions
     WHERE workspace_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [workspaceId],
  );
}

export function scoreLearningAnswer(input: {
  questionId: string;
  workspaceId: string;
  operatorId?: string;
  answerText: string;
}): {
  id: string;
  question_id: string;
  score: number;
  grade: 'good' | 'partial' | 'wrong';
  feedback: string;
  next_resource: string;
} {
  const question = queryOne<LearningQuestion>(
    `SELECT * FROM learning_questions WHERE id = ? AND workspace_id = ?`,
    [input.questionId, input.workspaceId],
  );
  if (!question) {
    throw new Error('Learning question not found');
  }

  const expected = parseJson<ExpectedAnswerSpec>(question.expected_answer_json, {
    key_points: [],
    tradeoff: '',
    risk_if_changed: '',
    concept: question.concept_tag || 'architecture reasoning',
  });

  const answer = input.answerText.trim();
  if (answer.length < 8) {
    throw new Error('Answer is too short');
  }

  const keyMatches = containsKeywords(answer, expected.key_points);
  const keyRatio = expected.key_points.length === 0 ? 0 : keyMatches / expected.key_points.length;
  const tradeoffHit = containsKeywords(answer, [expected.tradeoff]) > 0 ? 1 : 0;
  const riskHit = containsKeywords(answer, [expected.risk_if_changed]) > 0 ? 1 : 0;
  const score = Math.max(0, Math.min(100, Math.round(keyRatio * 60 + tradeoffHit * 20 + riskHit * 20)));

  const grade: 'good' | 'partial' | 'wrong' = score >= 75 ? 'good' : score >= 45 ? 'partial' : 'wrong';
  const missing: string[] = [];
  if (keyRatio < 0.6) missing.push('core decision reasoning');
  if (!tradeoffHit) missing.push('tradeoff explanation');
  if (!riskHit) missing.push('failure/risk implication');

  const feedback =
    grade === 'good'
      ? 'Strong answer: you explained why the decision exists and what breaks if it changes.'
      : grade === 'partial'
      ? `Partially correct: strengthen ${missing.join(', ')}.`
      : `Reasoning gap detected: missing ${missing.join(', ')}. Revisit the architecture rationale.`;

  const nextResource = suggestResource(expected.concept || question.concept_tag || 'architecture reasoning');
  const id = uuidv4();
  run(
    `INSERT INTO learning_answers
      (id, question_id, workspace_id, operator_id, answer_text, score, grade, feedback, next_resource, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      question.id,
      input.workspaceId,
      input.operatorId || null,
      answer,
      score,
      grade,
      feedback,
      nextResource,
      nowIso(),
    ],
  );

  return {
    id,
    question_id: question.id,
    score,
    grade,
    feedback,
    next_resource: nextResource,
  };
}

export function listLearningHistory(workspaceId: string): Array<{
  question_id: string;
  question: string;
  concept_tag?: string | null;
  question_created_at: string;
  answer_id?: string | null;
  score?: number | null;
  grade?: 'good' | 'partial' | 'wrong' | null;
  feedback?: string | null;
  answer_created_at?: string | null;
}> {
  return queryAll<{
    question_id: string;
    question: string;
    concept_tag?: string | null;
    question_created_at: string;
    answer_id?: string | null;
    score?: number | null;
    grade?: 'good' | 'partial' | 'wrong' | null;
    feedback?: string | null;
    answer_created_at?: string | null;
  }>(
    `SELECT
       q.id as question_id,
       q.question,
       q.concept_tag,
       q.created_at as question_created_at,
       a.id as answer_id,
       a.score,
       a.grade,
       a.feedback,
       a.created_at as answer_created_at
     FROM learning_questions q
     LEFT JOIN learning_answers a ON a.id = (
       SELECT la.id
       FROM learning_answers la
       WHERE la.question_id = q.id
       ORDER BY la.created_at DESC
       LIMIT 1
     )
     WHERE q.workspace_id = ?
     ORDER BY q.created_at DESC
     LIMIT 50`,
    [workspaceId],
  );
}
