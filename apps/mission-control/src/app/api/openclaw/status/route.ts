import { NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { getOpenClawGatewayConfig } from '@/lib/openclaw/config';

export const dynamic = 'force-dynamic';

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

// GET /api/openclaw/status - Check OpenClaw connection status
export async function GET() {
  try {
    const gatewayConfig = getOpenClawGatewayConfig();
    const client = getOpenClawClient();

    if (!client.isConnected()) {
      try {
        await withTimeout(client.connect(), 6000, 'connect');
      } catch (err) {
        client.disconnect();
        return NextResponse.json({
          connected: false,
          error: 'Failed to connect to OpenClaw Gateway',
          gateway_url: gatewayConfig.gateway_url,
        });
      }
    }

    // Try to list sessions to verify connection
    try {
      const sessions = await withTimeout(client.listSessions(), 6000, 'listSessions');
      return NextResponse.json({
        connected: true,
        sessions_count: sessions.length,
        sessions: sessions,
        gateway_url: gatewayConfig.gateway_url,
      });
    } catch (err) {
      return NextResponse.json({
        connected: true,
        error: 'Connected but failed to list sessions',
        gateway_url: gatewayConfig.gateway_url,
      });
    }
  } catch (error) {
    console.error('OpenClaw status check failed:', error);
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
