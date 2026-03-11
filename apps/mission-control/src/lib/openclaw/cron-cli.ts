import { execFile } from 'node:child_process';

type CliResult = {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
};

function runOpenClaw(args: string[], timeoutMs = 20000): Promise<CliResult> {
  return new Promise((resolve) => {
    const candidates = [
      process.env.OPENCLAW_BIN,
      '/home/openclaw/.local/bin/openclaw',
      'openclaw',
    ].filter((item): item is string => Boolean(item));

    const tryNext = (index: number) => {
      const bin = candidates[index];
      execFile(bin, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
        const err = error as NodeJS.ErrnoException | null;
        if (err?.code === 'ENOENT' && index < candidates.length - 1) {
          tryNext(index + 1);
          return;
        }
        const code = err?.code;
        const exitCode = typeof code === 'number' ? code : 0;
        resolve({
          ok: !error,
          command: `${bin} ${args.join(' ')}`,
          stdout: (stdout || '').toString(),
          stderr: (stderr || (error ? String(error) : '')).toString(),
          exitCode,
        });
      });
    };

    tryNext(0);
  });
}

export async function cronStatus(): Promise<CliResult> {
  return runOpenClaw(['cron', 'status']);
}

export async function cronList(): Promise<CliResult> {
  return runOpenClaw(['cron', 'list']);
}

export async function cronRuns(id: string): Promise<CliResult> {
  return runOpenClaw(['cron', 'runs', '--id', id]);
}

export async function cronRun(id: string): Promise<CliResult> {
  return runOpenClaw(['cron', 'run', id]);
}

export async function cronDisable(id: string): Promise<CliResult> {
  return runOpenClaw(['cron', 'disable', id]);
}

export async function cronRemove(id: string): Promise<CliResult> {
  return runOpenClaw(['cron', 'rm', id]);
}

export async function cronAddTriggerJob(input: {
  name: string;
  everyMs: string;
  missionControlUrl: string;
  pipelineJobId: string;
  triggerToken: string;
  approvalToken?: string;
}): Promise<CliResult> {
  const baseUrl = input.missionControlUrl.replace(/\/+$/, '');
  const approvalPayload =
    input.approvalToken && input.approvalToken.trim().length > 0
      ? `{"approval_token":"${input.approvalToken.trim().replace(/"/g, '\\"')}"}`
      : '{}';

  const message = [
    'Use bash tool. Execute exactly:',
    `curl -fsS -X POST '${baseUrl}/api/jobs/${input.pipelineJobId}/trigger' \\`,
    "  -H 'content-type: application/json' \\",
    `  -H 'x-mc-cron-token: ${input.triggerToken}' \\`,
    `  -d '${approvalPayload}'`,
    'Return only: trigger_status=<ok|failed> and one-line reason.',
  ].join('\n');

  return runOpenClaw([
    'cron',
    'add',
    '--name',
    input.name,
    '--every',
    input.everyMs,
    '--session',
    'isolated',
    '--message',
    message,
    '--announce',
  ]);
}
