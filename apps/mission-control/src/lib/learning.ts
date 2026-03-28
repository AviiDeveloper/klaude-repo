import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import type { LearningQuestion } from '@/lib/types';

interface ExpectedAnswerSpec {
  key_points: string[];
  tradeoff: string;
  risk_if_changed: string;
  concept: string;
}

interface ScorerSignals {
  key_ratio: number;
  tradeoff_hit: boolean;
  risk_hit: boolean;
  low_structure: boolean;
  keyword_stuffing: boolean;
  shallow_restatement: boolean;
  contradiction_detected: boolean;
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

function strictPhraseHit(answer: string, phrase: string): boolean {
  const parts = tokenize(phrase).filter((token) => token.length >= 4);
  if (parts.length === 0) return false;
  const text = answer.toLowerCase();
  const hitCount = parts.reduce((count, part) => count + (text.includes(part) ? 1 : 0), 0);
  return hitCount >= Math.min(2, parts.length);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

function sentenceCount(input: string): number {
  const parts = input
    .split(/[.!?;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length;
}

function hasReasoningConnectors(answer: string): boolean {
  return /\b(because|therefore|thus|which avoids|which prevents|so that|so |tradeoff|risk|if|unless)\b/i.test(
    answer,
  );
}

function hasLowStructure(answer: string): boolean {
  const sentenceTotal = sentenceCount(answer);
  const words = tokenize(answer);
  const uniqueRatio = words.length === 0 ? 0 : unique(words).length / words.length;
  return sentenceTotal < 2 || uniqueRatio < 0.52;
}

function keywordDensity(answer: string, expectedTokens: string[]): number {
  const answerTokens = tokenize(answer);
  if (answerTokens.length === 0 || expectedTokens.length === 0) return 0;
  const expectedSet = new Set(expectedTokens);
  const hits = answerTokens.reduce((sum, token) => sum + (expectedSet.has(token) ? 1 : 0), 0);
  return hits / answerTokens.length;
}

function detectKeywordStuffing(answer: string, expectedTokens: string[]): boolean {
  const density = keywordDensity(answer, expectedTokens);
  const words = tokenize(answer);
  const uniqueRatio = words.length === 0 ? 0 : unique(words).length / words.length;
  return density >= 0.32 && uniqueRatio < 0.72;
}

function detectShallowRestatement(answer: string, expected: ExpectedAnswerSpec): boolean {
  const answerTokens = unique(tokenize(answer));
  const expectedTokens = unique(
    tokenize(`${expected.key_points.join(' ')} ${expected.tradeoff} ${expected.risk_if_changed}`),
  );
  if (answerTokens.length === 0 || expectedTokens.length === 0) return false;
  const overlap = answerTokens.filter((token) => expectedTokens.includes(token)).length;
  const overlapRatio = overlap / answerTokens.length;
  const reasoningSignals = hasReasoningConnectors(answer);
  return overlapRatio >= 0.58 && !reasoningSignals;
}

function detectContradiction(answer: string, expected: ExpectedAnswerSpec): boolean {
  const normalized = normalizeText(answer);
  const contradictionPatterns = [
    /\b(not required|unnecessary|no need)\b.{0,40}\b(approval|gate|mediation)\b/,
    /\b(random assignment|assign randomly|any agent)\b.{0,40}\b(better|best|fine)\b/,
    /\b(no risk|zero risk|nothing breaks|won't break|does not break)\b/,
    /\b(should bypass|can bypass|ignore)\b.{0,40}\b(approval|control|operator)\b/,
  ];
  if (contradictionPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  const expectedTokens = tokenize(
    `${expected.key_points.join(' ')} ${expected.tradeoff} ${expected.risk_if_changed}`,
  ).filter((token) => token.length >= 6);
  const criticalHit = expectedTokens.some(
    (token) => normalized.includes(`not ${token}`) || normalized.includes(`no ${token}`),
  );
  return criticalHit;
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
  coverage_score: number;
  reasoning_score: number;
  confidence: number;
  scorer_flags: ScorerSignals;
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
  const answerWordCount = tokenize(answer).length;
  const tradeoffHit = strictPhraseHit(answer, expected.tradeoff) ? 1 : 0;
  const riskHit = strictPhraseHit(answer, expected.risk_if_changed) ? 1 : 0;
  const expectedTokens = unique(
    tokenize(`${expected.key_points.join(' ')} ${expected.tradeoff} ${expected.risk_if_changed}`).filter(
      (token) => token.length >= 4,
    ),
  );
  const lowStructure = hasLowStructure(answer);
  const keywordStuffing = detectKeywordStuffing(answer, expectedTokens);
  const shallowRestatement = detectShallowRestatement(answer, expected);
  const contradictionDetected = detectContradiction(answer, expected);

  let coverageScore = Math.round(keyRatio * 55 + tradeoffHit * 20 + riskHit * 25);
  if (keywordStuffing) coverageScore = Math.round(coverageScore * 0.8);
  if (contradictionDetected) coverageScore = Math.round(coverageScore * 0.55);
  coverageScore = clamp(0, 100, coverageScore);

  let reasoningScore = 18;
  if (hasReasoningConnectors(answer)) reasoningScore += 20;
  if (/\b(not sure|unclear|unsure)\b/i.test(answer)) reasoningScore += 8;
  if (tradeoffHit) reasoningScore += 15;
  if (riskHit) reasoningScore += 15;
  if (keyRatio >= 0.6) reasoningScore += 15;
  if (sentenceCount(answer) >= 2) reasoningScore += 10;
  if (/\b(however|but|while|instead)\b/i.test(answer)) reasoningScore += 7;
  if (lowStructure) reasoningScore -= 18;
  if (keywordStuffing) reasoningScore -= 20;
  if (shallowRestatement) reasoningScore -= 20;
  if (contradictionDetected) reasoningScore -= 45;
  reasoningScore = clamp(0, 100, Math.round(reasoningScore));

  let confidence =
    0.38 +
    coverageScore / 100 * 0.24 +
    reasoningScore / 100 * 0.24 +
    (lowStructure ? -0.1 : 0.08) +
    (keywordStuffing ? -0.11 : 0) +
    (shallowRestatement ? -0.08 : 0) +
    (contradictionDetected ? -0.24 : 0);
  confidence = clamp(0.05, 0.98, Number(confidence.toFixed(2)));

  const score = clamp(0, 100, Math.round(coverageScore * 0.5 + reasoningScore * 0.5));

  const hardFail =
    contradictionDetected ||
    keywordStuffing ||
    (lowStructure && shallowRestatement) ||
    (shallowRestatement && reasoningScore < 65);

  let grade: 'good' | 'partial' | 'wrong' = 'wrong';
  if (
    !hardFail &&
    coverageScore >= 72 &&
    reasoningScore >= 70 &&
    confidence >= 0.7
  ) {
    grade = 'good';
  } else if (
    !hardFail &&
    confidence >= 0.34 &&
    (score >= 35 ||
      (answerWordCount >= 14 &&
        keyRatio >= 0.55 &&
        (tradeoffHit === 1 || /\b(not sure|unclear|unsure)\b/i.test(answer))))
  ) {
    grade = 'partial';
  }
  const missing: string[] = [];
  if (coverageScore < 60) missing.push('decision coverage');
  if (reasoningScore < 60) missing.push('reasoning quality');
  if (!tradeoffHit) missing.push('tradeoff explanation');
  if (!riskHit) missing.push('failure/risk implication');
  if (lowStructure) missing.push('structured argument flow');
  if (keywordStuffing) missing.push('original reasoning (avoid keyword stuffing)');
  if (shallowRestatement) missing.push('deeper analysis beyond restating prompts');
  if (contradictionDetected) missing.push('internal consistency (contradictions detected)');

  const feedback =
    grade === 'good'
      ? 'Strong answer: coverage and reasoning quality both met trust thresholds.'
      : grade === 'partial'
      ? `Partially correct: strengthen ${missing.join(', ')}.`
      : `Reasoning gap detected: missing ${missing.join(', ')}. Revisit the architecture rationale.`;

  const nextResource = suggestResource(expected.concept || question.concept_tag || 'architecture reasoning');
  const id = uuidv4();
  run(
    `INSERT INTO learning_answers
      (id, question_id, workspace_id, operator_id, answer_text, score, grade, feedback, next_resource, coverage_score, reasoning_score, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      coverageScore,
      reasoningScore,
      confidence,
      nowIso(),
    ],
  );

  const scorerFlags: ScorerSignals = {
    key_ratio: Number(keyRatio.toFixed(2)),
    tradeoff_hit: tradeoffHit === 1,
    risk_hit: riskHit === 1,
    low_structure: lowStructure,
    keyword_stuffing: keywordStuffing,
    shallow_restatement: shallowRestatement,
    contradiction_detected: contradictionDetected,
  };

  return {
    id,
    question_id: question.id,
    score,
    grade,
    feedback,
    next_resource: nextResource,
    coverage_score: coverageScore,
    reasoning_score: reasoningScore,
    confidence,
    scorer_flags: scorerFlags,
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
  confidence?: number | null;
  coverage_score?: number | null;
  reasoning_score?: number | null;
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
    confidence?: number | null;
    coverage_score?: number | null;
    reasoning_score?: number | null;
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
       a.confidence,
       a.coverage_score,
       a.reasoning_score,
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

/**
 * Generate a learning question from an agent failure.
 * Called when an eval run results in 'fail' status.
 */
export function generateLearningQuestionFromFailure(input: {
  workspaceId: string;
  agentName: string;
  taskTitle: string;
  evalStatus: 'fail' | 'partial';
  faultAttribution: string;
  reasonCodes: string[];
  qualityScore: number;
}): LearningQuestion {
  const id = uuidv4();
  const now = nowIso();
  const reasonStr = input.reasonCodes.length > 0 ? input.reasonCodes.join(', ') : 'unspecified';

  let question: string;
  let expected: ExpectedAnswerSpec;

  if (input.faultAttribution === 'agent_error') {
    question = `Agent "${input.agentName}" failed task "${input.taskTitle}" with score ${input.qualityScore}/100. Reason codes: ${reasonStr}. What pattern in the agent's approach should be adjusted to prevent this failure mode?`;
    expected = {
      key_points: [
        `${input.agentName} produced output below quality threshold`,
        'failure mode relates to: ' + reasonStr,
        'agent behavior should be adjusted, not input pipeline',
      ],
      tradeoff: 'Tighter quality checks may slow agent output but prevent recurring failures',
      risk_if_changed: 'Without adjustment, similar tasks will continue to fail at the same rate',
      concept: 'agent-self-improvement',
    };
  } else if (input.faultAttribution === 'input_gap') {
    question = `Agent "${input.agentName}" failed task "${input.taskTitle}" due to insufficient input context (score ${input.qualityScore}/100). Reason codes: ${reasonStr}. What upstream data or context should be provided to prevent this?`;
    expected = {
      key_points: [
        'failure was caused by missing or weak input, not agent capability',
        'upstream delegation should include richer context',
        'specific missing inputs: ' + reasonStr,
      ],
      tradeoff: 'Richer input context increases delegation overhead but prevents input-gap failures',
      risk_if_changed: 'Agent will continue to fail on similar tasks without better input',
      concept: 'delegation-input-quality',
    };
  } else {
    question = `Agent "${input.agentName}" ${input.evalStatus === 'fail' ? 'failed' : 'partially completed'} task "${input.taskTitle}" (score ${input.qualityScore}/100, fault: ${input.faultAttribution}). Reason codes: ${reasonStr}. What is the root cause and what should change?`;
    expected = {
      key_points: [
        'mixed fault attribution suggests both agent and input issues',
        'reason codes indicate: ' + reasonStr,
        'both agent behavior and input quality need review',
      ],
      tradeoff: 'Comprehensive fix requires changes to both delegation and agent reference sheet',
      risk_if_changed: 'Partial fixes may shift failures from one mode to another',
      concept: 'mixed-fault-remediation',
    };
  }

  run(
    `INSERT INTO learning_questions (id, workspace_id, source_type, source_ref, question, expected_answer_json, concept_tag, created_at)
     VALUES (?, ?, 'decision_log', ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      `eval-failure:${input.agentName}`,
      question,
      JSON.stringify(expected),
      expected.concept,
      now,
    ],
  );

  return queryOne<LearningQuestion>('SELECT * FROM learning_questions WHERE id = ?', [id]) as LearningQuestion;
}
