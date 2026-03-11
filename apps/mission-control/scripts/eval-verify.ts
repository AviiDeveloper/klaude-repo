import fs from 'fs';
import os from 'os';
import path from 'path';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

type EvalExpectation = {
  status: 'pass' | 'partial' | 'fail';
  fault: 'agent_error' | 'input_gap' | 'mixed' | 'unknown';
};

type EvalResultRow = {
  name: string;
  score: number;
  status: string;
  fault: string;
  durationMs: number;
  expected: EvalExpectation;
  ok: boolean;
};

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-eval-verify-'));
  const dbPath = path.join(tmpDir, 'mission-control.eval-verify.sqlite');
  process.env.DATABASE_PATH = dbPath;

  const dbMod = await import('../src/lib/db/index');
  const evalMod = await import('../src/lib/evals');

  const { run, queryOne, closeDb } = dbMod;
  const { createEvalSpec, runTaskEvaluation, getAgentPerformanceProfile } = evalMod;

  const now = new Date().toISOString();
  const workspaceId = 'default';
  const leadId = uuidv4();
  const workerId = uuidv4();

  run(
    `INSERT OR IGNORE INTO workspaces (id, name, slug, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workspaceId, 'Default Workspace', 'default', '🏠', now, now],
  );

  run(
    `INSERT OR IGNORE INTO agents (id, name, role, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [leadId, 'Charlie', 'Lead Orchestrator', '🦞', 'working', 1, workspaceId, now, now],
  );

  run(
    `INSERT INTO agents (id, name, role, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [workerId, 'Eval Worker', 'Execution Agent', '🤖', 'working', 0, workspaceId, now, now],
  );

  const evalSpec = createEvalSpec({
    workspaceId,
    agentId: workerId,
    taskType: 'research',
    criteria: {
      must_have: ['deliverables', 'evidence', 'trace'],
      quality_bar: 'actionable, verifiable, and concise',
    },
    rubric: {
      good: ['clear evidence-backed output', 'complete execution trace', 'high confidence'],
      partial: ['usable output but missing evidence depth'],
      wrong: ['thin output without evidence or execution detail'],
    },
  });

  function createTask(input: { title: string; description: string; priority?: string }): string {
    const taskId = uuidv4();
    run(
      `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, created_by_agent_id, workspace_id, business_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        input.title,
        input.description,
        'in_progress',
        input.priority || 'normal',
        workerId,
        leadId,
        workspaceId,
        'default',
        now,
        now,
      ],
    );
    return taskId;
  }

  function addDelegation(taskId: string): string {
    const delegationId = uuidv4();
    run(
      `INSERT INTO lead_task_delegations
       (id, workspace_id, task_id, delegated_by_agent_id, delegated_to_agent_id, rationale, expected_output_contract, timeout_ms, retry_limit, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        delegationId,
        workspaceId,
        taskId,
        leadId,
        workerId,
        'Eval verification assignment',
        'Return evidence-backed output',
        600000,
        1,
        'completed',
        now,
        now,
      ],
    );
    return delegationId;
  }

  function addActivity(taskId: string, count: number) {
    for (let i = 0; i < count; i += 1) {
      run(
        `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), taskId, workerId, 'updated', `activity ${i + 1}`, now],
      );
    }
  }

  function addDeliverables(taskId: string, count: number) {
    for (let i = 0; i < count; i += 1) {
      run(
        `INSERT INTO task_deliverables (id, task_id, deliverable_type, title, path, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), taskId, 'artifact', `deliverable ${i + 1}`, `/tmp/out-${i + 1}.txt`, 'artifact output', now],
      );
    }
  }

  function addFinding(taskId: string, evidenceItems: number) {
    const evidence = Array.from({ length: evidenceItems }).map((_, idx) => ({
      source: `source-${idx + 1}`,
      note: `evidence-${idx + 1}`,
    }));
    run(
      `INSERT INTO lead_findings (id, workspace_id, task_id, agent_id, summary, evidence_json, risk_level, recommendation, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        workspaceId,
        taskId,
        workerId,
        'finding summary',
        JSON.stringify(evidence),
        'medium',
        'continue',
        'new',
        now,
        now,
      ],
    );
  }

  const scenarios: Array<{
    name: string;
    description: string;
    setup: () => { taskId: string; delegationId: string };
    expected: EvalExpectation;
  }> = [
    {
      name: 'strong-output-pass',
      description: 'High quality output with artifacts, evidence, and detailed trace.',
      setup: () => {
        const taskId = createTask({
          title: 'Strong eval case',
          description: 'Detailed task context with clear success criteria for robust execution quality validation.',
        });
        const delegationId = addDelegation(taskId);
        addDeliverables(taskId, 2);
        addFinding(taskId, 2);
        addActivity(taskId, 5);
        return { taskId, delegationId };
      },
      expected: { status: 'pass', fault: 'unknown' },
    },
    {
      name: 'partial-output-partial',
      description: 'Usable but weak output with some evidence gaps.',
      setup: () => {
        const taskId = createTask({
          title: 'Partial eval case',
          description: 'Context available but output likely incomplete relative to expected quality bar.',
        });
        const delegationId = addDelegation(taskId);
        addDeliverables(taskId, 1);
        addFinding(taskId, 0);
        addActivity(taskId, 3);
        return { taskId, delegationId };
      },
      expected: { status: 'partial', fault: 'agent_error' },
    },
    {
      name: 'thin-output-agent-fail',
      description: 'Good input context but no output artifacts.',
      setup: () => {
        const taskId = createTask({
          title: 'Thin output case',
          description: 'Task includes clear constraints and expected deliverables but worker returns nothing useful.',
        });
        const delegationId = addDelegation(taskId);
        addActivity(taskId, 1);
        return { taskId, delegationId };
      },
      expected: { status: 'fail', fault: 'agent_error' },
    },
    {
      name: 'weak-input-gap-fail',
      description: 'Weak input context and no output.',
      setup: () => {
        const taskId = createTask({
          title: 'Input gap case',
          description: 'too short',
        });
        const delegationId = addDelegation(taskId);
        return { taskId, delegationId };
      },
      expected: { status: 'fail', fault: 'input_gap' },
    },
  ];

  const rows: EvalResultRow[] = [];
  const durations: number[] = [];

  console.log('=== Eval Verification Pipeline ===');
  console.log(`DB: ${dbPath}`);
  console.log(`Spec: ${evalSpec.id} (task_type=${evalSpec.task_type}, version=${evalSpec.version})`);
  console.log('');

  for (const scenario of scenarios) {
    const { taskId, delegationId } = scenario.setup();
    const t0 = performance.now();
    const result = runTaskEvaluation({
      workspaceId,
      taskId,
      agentId: workerId,
      delegationId,
      evalSpecId: evalSpec.id,
    });
    const durationMs = performance.now() - t0;
    durations.push(durationMs);

    const ok =
      result.status === scenario.expected.status &&
      result.fault_attribution === scenario.expected.fault;

    rows.push({
      name: scenario.name,
      score: result.quality_score,
      status: result.status,
      fault: result.fault_attribution,
      durationMs,
      expected: scenario.expected,
      ok,
    });
  }

  console.log('Scenario Results');
  for (const row of rows) {
    console.log(
      `- ${row.ok ? 'PASS' : 'FAIL'} | ${row.name} | score=${row.score} | status=${row.status} | fault=${row.fault} | ${row.durationMs.toFixed(2)}ms | expected=${row.expected.status}/${row.expected.fault}`,
    );
  }

  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxMs = Math.max(...durations);
  const profile = getAgentPerformanceProfile(workerId);
  const samplesOk = (profile?.samples ?? 0) === scenarios.length;
  const perfOk = avgMs < 80;
  const allScenariosOk = rows.every((row) => row.ok);

  console.log('');
  console.log('Performance Summary');
  console.log(`- Avg eval latency: ${avgMs.toFixed(2)}ms`);
  console.log(`- Max eval latency: ${maxMs.toFixed(2)}ms`);
  console.log(`- Profile samples: ${profile?.samples ?? 0}`);
  console.log(`- Rolling score: ${(profile?.rolling_score ?? 0).toFixed(2)}`);
  console.log(`- Pass rate: ${((profile?.pass_rate ?? 0) * 100).toFixed(1)}%`);
  console.log(`- Failure rate: ${((profile?.failure_rate ?? 0) * 100).toFixed(1)}%`);
  console.log(`- Input gap rate: ${((profile?.input_gap_rate ?? 0) * 100).toFixed(1)}%`);
  console.log('');
  console.log('Gate Checks');
  console.log(`- Scenario expectations: ${allScenariosOk ? 'PASS' : 'FAIL'}`);
  console.log(`- Profile aggregation: ${samplesOk ? 'PASS' : 'FAIL'}`);
  console.log(`- Latency target (avg < 80ms): ${perfOk ? 'PASS' : 'FAIL'}`);

  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (!allScenariosOk || !samplesOk || !perfOk) {
    process.exitCode = 1;
  } else {
    console.log('\nEval verification pipeline passed.');
  }
}

main().catch((error) => {
  console.error('Eval verification pipeline crashed:', error);
  process.exit(1);
});
