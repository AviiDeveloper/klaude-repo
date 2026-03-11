import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import {
  cronAddTriggerJob,
  cronList,
  cronStatus,
} from '@/lib/openclaw/cron-cli';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readText(result: { stdout: string; stderr: string }): string {
  const out = result.stdout.trim();
  const err = result.stderr.trim();
  if (out && err) return `${out}\n${err}`;
  return out || err;
}

async function callGatewayCron(methods: string[], params?: Record<string, unknown>) {
  const client = getOpenClawClient();
  if (!client.isConnected()) {
    await client.connect();
  }
  let lastError: unknown;
  for (const method of methods) {
    try {
      const payload = await client.call(method, params);
      return { method, payload };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gateway cron call failed');
}

export async function GET() {
  try {
    try {
      const [list, status] = await Promise.all([
        callGatewayCron(['cron.list', 'cron.jobs.list']),
        callGatewayCron(['cron.status']).catch(() => null),
      ]);
      return NextResponse.json({
        ok: true,
        source: 'gateway',
        list_method: list.method,
        status_method: status?.method ?? null,
        list_payload: list.payload,
        status_payload: status?.payload ?? null,
        list_text: JSON.stringify(list.payload, null, 2),
        status_text: status?.payload ? JSON.stringify(status.payload, null, 2) : 'No status payload',
      });
    } catch {
      // fall back to CLI for environments where cron RPC methods differ
    }

    const [status, list] = await Promise.all([cronStatus(), cronList()]);
    return NextResponse.json({
      ok: status.ok && list.ok,
      source: 'cli',
      status,
      list,
      status_text: readText(status),
      list_text: readText(list),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read cron state' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      every_ms?: string | number;
      mission_control_url?: string;
      pipeline_job_id?: string;
      trigger_token?: string;
      approval_token?: string;
    };

    if (body.action !== 'add_trigger') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const name = (body.name || '').trim();
    const everyMs = String(body.every_ms || '').trim();
    const missionControlUrl = (body.mission_control_url || '').trim();
    const pipelineJobId = (body.pipeline_job_id || '').trim();
    const triggerToken = (body.trigger_token || '').trim();
    const approvalToken = (body.approval_token || '').trim();

    if (!name || !everyMs || !missionControlUrl || !pipelineJobId || !triggerToken) {
      return NextResponse.json(
        {
          error:
            'name, every_ms, mission_control_url, pipeline_job_id, and trigger_token are required',
        },
        { status: 400 },
      );
    }

    const baseUrl = missionControlUrl.replace(/\/+$/, '');
    const approvalPayload =
      approvalToken && approvalToken.length > 0
        ? `{"approval_token":"${approvalToken.replace(/"/g, '\\"')}"}`
        : '{}';
    const message = [
      'Use bash tool. Execute exactly:',
      `curl -fsS -X POST '${baseUrl}/api/jobs/${pipelineJobId}/trigger' \\`,
      "  -H 'content-type: application/json' \\",
      `  -H 'x-mc-cron-token: ${triggerToken}' \\`,
      `  -d '${approvalPayload}'`,
      'Return only: trigger_status=<ok|failed> and one-line reason.',
    ].join('\n');

    try {
      const created = await callGatewayCron(['cron.add', 'cron.jobs.add'], {
        name,
        every: everyMs,
        session: 'isolated',
        message,
        announce: true,
      });
      return NextResponse.json({
        ok: true,
        source: 'gateway',
        method: created.method,
        result: created.payload,
        output: JSON.stringify(created.payload, null, 2),
      });
    } catch {
      // fall back to CLI add path
    }

    const result = await cronAddTriggerJob({
      name,
      everyMs,
      missionControlUrl,
      pipelineJobId,
      triggerToken,
      approvalToken: approvalToken || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: readText(result) || 'Failed to create OpenClaw cron job',
          result,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      result,
      output: readText(result),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create cron job' },
      { status: 500 },
    );
  }
}
