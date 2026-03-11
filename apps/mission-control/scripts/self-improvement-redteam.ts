import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

type CaseExpectation = 'good' | 'partial' | 'wrong';

type CaseResult = {
  label: string;
  expected: CaseExpectation;
  actual: 'good' | 'partial' | 'wrong';
  score: number;
  passed: boolean;
  feedback: string;
};

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-self-improvement-redteam-'));
  const dbPath = path.join(tmpDir, 'mission-control.self-improvement.sqlite');
  process.env.DATABASE_PATH = dbPath;

  const dbMod = await import('../src/lib/db/index');
  const learningMod = await import('../src/lib/learning');
  const memoryMod = await import('../src/lib/memory/packet');

  const { run, closeDb } = dbMod;
  const { generateLearningQuestion, scoreLearningAnswer } = learningMod;
  const { getLearningSignal } = memoryMod;

  const now = new Date().toISOString();

  function seedWorkspace(workspaceId: string) {
    run(
      `INSERT OR IGNORE INTO workspaces (id, name, slug, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [workspaceId, workspaceId, workspaceId, '🏠', now, now],
    );
    run(
      `INSERT OR IGNORE INTO agents (id, name, role, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`lead-${workspaceId}`, 'Charlie', 'Lead Orchestrator', '🦞', 'working', 1, workspaceId, now, now],
    );
    run(
      `INSERT OR IGNORE INTO tasks (id, title, description, status, priority, workspace_id, business_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `task-${workspaceId}`,
        `Task ${workspaceId}`,
        'A test task for learning loop red-team analysis.',
        'planning',
        'normal',
        workspaceId,
        'default',
        now,
        now,
      ],
    );
  }

  function addDecision(workspaceId: string, type: string, summary: string) {
    run(
      `INSERT INTO lead_decision_logs (id, workspace_id, task_id, decision_type, summary, actor_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), workspaceId, `task-${workspaceId}`, type, summary, 'lead', new Date().toISOString()],
    );
  }

  function runCases(
    workspaceId: string,
    prompt: { questionId: string },
    cases: Array<{ label: string; expected: CaseExpectation; answer: string }>,
  ): CaseResult[] {
    return cases.map((testCase) => {
      const result = scoreLearningAnswer({
        workspaceId,
        questionId: prompt.questionId,
        operatorId: 'redteam',
        answerText: testCase.answer,
      });
      return {
        label: testCase.label,
        expected: testCase.expected,
        actual: result.grade,
        score: result.score,
        passed: result.grade === testCase.expected,
        feedback: result.feedback,
      };
    });
  }

  seedWorkspace('rt-delegation');
  addDecision('rt-delegation', 'delegate', 'Delegated task to researcher based on fit.');
  const delegationQuestion = generateLearningQuestion({
    workspaceId: 'rt-delegation',
    sourceType: 'decision_log',
  });
  const delegationCases = runCases(
    'rt-delegation',
    { questionId: delegationQuestion.id },
    [
      {
        label: 'good_reasoned_answer',
        expected: 'good',
        answer:
          'Delegation should use specialization, load, and reliability because the tradeoff is more scoring complexity for better task outcomes. That avoids wrong-agent assignments and quality regressions.',
      },
      {
        label: 'literal_but_shallow',
        expected: 'wrong',
        answer: 'Charlie delegated it to an agent using specialization and reliability.',
      },
      {
        label: 'keyword_soup',
        expected: 'wrong',
        answer:
          'specialization fit improves output quality load balancing prevents queue congestion reliability eval history reduces repeated failures more scoring complexity for better task outcomes wrong agent assignments and quality regressions',
      },
      {
        label: 'reversed_reasoning_with_keywords',
        expected: 'wrong',
        answer:
          'Random assignment is actually better, but yes specialization fit improves output quality and the tradeoff is more scoring complexity for better task outcomes and the risk is wrong-agent assignments and quality regressions.',
      },
      {
        label: 'partial_answer',
        expected: 'partial',
        answer:
          'Using specialization helps quality and load balancing prevents queue congestion, but I am not sure about the tradeoff or exact failure mode.',
      },
    ],
  );

  seedWorkspace('rt-approval');
  addDecision('rt-approval', 'approval_request', 'Lead requested operator approval before side effects.');
  const approvalQuestion = generateLearningQuestion({
    workspaceId: 'rt-approval',
    sourceType: 'decision_log',
  });
  const approvalCases = runCases(
    'rt-approval',
    { questionId: approvalQuestion.id },
    [
      {
        label: 'good_approval_answer',
        expected: 'good',
        answer:
          'Approval mediation is required because the tradeoff is slower execution in exchange for safety and governance. It keeps operator control centralized and prevents unreviewed side effects from executing.',
      },
      {
        label: 'keyword_only_approval',
        expected: 'wrong',
        answer:
          'approval gate prevents unsafe side effects lead mediation centralizes operator control worker autonomy is bounded by tokenized approval slower execution in exchange for safety and governance unreviewed side effects could execute',
      },
    ],
  );

  seedWorkspace('rt-improvement');
  addDecision('rt-improvement', 'delegate', 'Delegated task for learning-mode audit.');
  const improvementQuestion = generateLearningQuestion({
    workspaceId: 'rt-improvement',
    sourceType: 'decision_log',
  });

  const wrongAnswer =
    'specialization fit improves output quality load balancing prevents queue congestion reliability eval history reduces repeated failures more scoring complexity for better task outcomes wrong agent assignments and quality regressions';
  const goodAnswer =
    'Delegation should optimize specialization, load, and reliability because the tradeoff is more scoring complexity for better task outcomes. Without that, Charlie risks wrong-agent assignments and quality regressions.';

  for (let i = 0; i < 4; i += 1) {
    scoreLearningAnswer({
      workspaceId: 'rt-improvement',
      questionId: improvementQuestion.id,
      operatorId: 'redteam',
      answerText: wrongAnswer,
    });
  }
  const failureSignal = getLearningSignal('rt-improvement');

  for (let i = 0; i < 8; i += 1) {
    scoreLearningAnswer({
      workspaceId: 'rt-improvement',
      questionId: improvementQuestion.id,
      operatorId: 'redteam',
      answerText: goodAnswer,
    });
  }
  const recoverySignal = getLearningSignal('rt-improvement');
  const nextQuestion = generateLearningQuestion({
    workspaceId: 'rt-improvement',
    sourceType: 'decision_log',
  });

  const summary = {
    generated_questions: {
      delegation: delegationQuestion.question,
      approval: approvalQuestion.question,
      post_failure_question: nextQuestion.question,
    },
    adversarial_cases: {
      delegation: delegationCases,
      approval: approvalCases,
    },
    learning_signal_transition: {
      after_failures: failureSignal,
      after_recovery: recoverySignal,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('Self-improvement red-team failed:', error);
  process.exit(1);
});
