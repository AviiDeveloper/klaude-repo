import { NextRequest, NextResponse } from 'next/server';
import { OpenClawClient, getOpenClawClient, resetOpenClawClient } from '@/lib/openclaw/client';
import { getOpenClawGatewayConfig, upsertOpenClawGatewayConfig } from '@/lib/openclaw/config';

export const dynamic = 'force-dynamic';

type ConfigPayload = {
  gateway_url?: string;
  gateway_token?: string;
  gateway_origin?: string;
  gateway_role?: string;
  gateway_scopes?: string;
  action?: 'test' | 'save';
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseScopes(raw: string): string[] {
  return raw
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function GET() {
  try {
    const config = getOpenClawGatewayConfig();
    return NextResponse.json({
      ...config,
      has_token: Boolean(config.gateway_token),
      gateway_token_masked: config.gateway_token
        ? `${config.gateway_token.slice(0, 6)}...${config.gateway_token.slice(-4)}`
        : '',
    });
  } catch (error) {
    console.error('Failed to load OpenClaw config:', error);
    return NextResponse.json({ error: 'Failed to load OpenClaw config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConfigPayload;
    const action = body.action || 'save';
    const current = getOpenClawGatewayConfig();

    const merged = {
      ...current,
      gateway_url: body.gateway_url?.trim() || current.gateway_url,
      gateway_token: body.gateway_token?.trim() || current.gateway_token,
      gateway_origin: body.gateway_origin?.trim() || current.gateway_origin,
      gateway_role: body.gateway_role?.trim() || current.gateway_role,
      gateway_scopes: body.gateway_scopes?.trim() || current.gateway_scopes,
    };

    if (!merged.gateway_url || !merged.gateway_token || !merged.gateway_origin) {
      return NextResponse.json(
        { error: 'gateway_url, gateway_token, and gateway_origin are required' },
        { status: 400 },
      );
    }

    if (action === 'test') {
      const tempClient = new OpenClawClient(
        merged.gateway_url,
        merged.gateway_token,
        merged.gateway_origin,
        merged.gateway_role,
        parseScopes(merged.gateway_scopes),
      );
      try {
        await withTimeout(tempClient.connect(), 7000, 'connect');
        const sessions = await withTimeout(tempClient.listSessions(), 7000, 'listSessions');
        tempClient.disconnect();
        return NextResponse.json({
          ok: true,
          connected: true,
          sessions_count: sessions.length,
          message: 'OpenClaw gateway connection verified.',
        });
      } catch (error) {
        tempClient.disconnect();
        return NextResponse.json(
          {
            ok: false,
            connected: false,
            error: error instanceof Error ? error.message : 'Connection test failed',
          },
          { status: 400 },
        );
      }
    }

    const saved = upsertOpenClawGatewayConfig(merged);
    resetOpenClawClient();
    const liveClient = getOpenClawClient();

    let connected = false;
    let sessionsCount = 0;
    let warning: string | null = null;

    try {
      await withTimeout(liveClient.connect(), 7000, 'connect');
      const sessions = await withTimeout(liveClient.listSessions(), 7000, 'listSessions');
      connected = true;
      sessionsCount = sessions.length;
    } catch (error) {
      connected = false;
      warning = error instanceof Error ? error.message : 'Saved config but reconnect failed';
    }

    return NextResponse.json({
      ok: true,
      connected,
      sessions_count: sessionsCount,
      warning,
      config: {
        ...saved,
        has_token: Boolean(saved.gateway_token),
        gateway_token_masked: saved.gateway_token
          ? `${saved.gateway_token.slice(0, 6)}...${saved.gateway_token.slice(-4)}`
          : '',
      },
    });
  } catch (error) {
    console.error('Failed to update OpenClaw config:', error);
    return NextResponse.json({ error: 'Failed to update OpenClaw config' }, { status: 500 });
  }
}
