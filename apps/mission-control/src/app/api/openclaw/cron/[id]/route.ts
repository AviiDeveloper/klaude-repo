import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import {
  cronDisable,
  cronRemove,
  cronRun,
  cronRuns,
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
  throw lastError instanceof Error ? lastError : new Error('Gateway cron action failed');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cronId = (id || '').trim();
    if (!cronId) {
      return NextResponse.json({ error: 'cron id is required' }, { status: 400 });
    }
    const body = (await request.json()) as { action?: string };
    const action = (body.action || '').trim();
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let result;
    let gatewayPayload: { method: string; payload: unknown } | null = null;
    if (action === 'run') {
      try {
        gatewayPayload = await callGatewayCron(['cron.run'], { id: cronId });
      } catch {
        // fallback to CLI
      }
      if (gatewayPayload) {
        return NextResponse.json({
          ok: true,
          source: 'gateway',
          method: gatewayPayload.method,
          output: JSON.stringify(gatewayPayload.payload, null, 2),
          result: gatewayPayload.payload,
        });
      }
      result = await cronRun(cronId);
    } else if (action === 'disable') {
      try {
        gatewayPayload = await callGatewayCron(['cron.disable'], { id: cronId });
      } catch {
        // fallback to CLI
      }
      if (gatewayPayload) {
        return NextResponse.json({
          ok: true,
          source: 'gateway',
          method: gatewayPayload.method,
          output: JSON.stringify(gatewayPayload.payload, null, 2),
          result: gatewayPayload.payload,
        });
      }
      result = await cronDisable(cronId);
    } else if (action === 'remove') {
      try {
        gatewayPayload = await callGatewayCron(['cron.rm', 'cron.remove'], { id: cronId });
      } catch {
        // fallback to CLI
      }
      if (gatewayPayload) {
        return NextResponse.json({
          ok: true,
          source: 'gateway',
          method: gatewayPayload.method,
          output: JSON.stringify(gatewayPayload.payload, null, 2),
          result: gatewayPayload.payload,
        });
      }
      result = await cronRemove(cronId);
    } else if (action === 'runs') {
      try {
        gatewayPayload = await callGatewayCron(['cron.runs', 'cron.history'], { id: cronId });
      } catch {
        // fallback to CLI
      }
      if (gatewayPayload) {
        return NextResponse.json({
          ok: true,
          source: 'gateway',
          method: gatewayPayload.method,
          output: JSON.stringify(gatewayPayload.payload, null, 2),
          result: gatewayPayload.payload,
        });
      }
      result = await cronRuns(cronId);
    } else {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: readText(result) || `Failed to execute action: ${action}`,
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
      { error: error instanceof Error ? error.message : 'Cron action failed' },
      { status: 500 },
    );
  }
}
