import { NextRequest, NextResponse } from 'next/server';
import {
  getTelegramConfig,
  upsertTelegramConfig,
  sendMessage,
  setWebhook,
} from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cfg = getTelegramConfig();
    return NextResponse.json({
      bot_token: cfg.bot_token ? `${cfg.bot_token.slice(0, 6)}...${cfg.bot_token.slice(-4)}` : '',
      default_chat_id: cfg.default_chat_id,
      allowed_chat_ids: cfg.allowed_chat_ids,
      webhook_secret: cfg.webhook_secret ? '********' : '',
      enabled: cfg.enabled,
      has_token: !!cfg.bot_token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read config' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: 'save' | 'test' | 'set_webhook';
      bot_token?: string;
      default_chat_id?: string;
      allowed_chat_ids?: string;
      webhook_secret?: string;
      enabled?: string;
      url?: string;
    };

    if (body.action === 'save') {
      const update: Record<string, string> = {};
      if (body.bot_token !== undefined) update.bot_token = body.bot_token;
      if (body.default_chat_id !== undefined) update.default_chat_id = body.default_chat_id;
      if (body.allowed_chat_ids !== undefined) update.allowed_chat_ids = body.allowed_chat_ids;
      if (body.webhook_secret !== undefined) update.webhook_secret = body.webhook_secret;
      if (body.enabled !== undefined) update.enabled = body.enabled;

      const saved = upsertTelegramConfig(update);
      return NextResponse.json({
        success: true,
        enabled: saved.enabled,
        has_token: !!saved.bot_token,
      });
    }

    if (body.action === 'test') {
      const cfg = getTelegramConfig();
      if (!cfg.bot_token || !cfg.default_chat_id) {
        return NextResponse.json(
          { error: 'Bot token and default chat ID are required' },
          { status: 400 },
        );
      }
      const ok = await sendMessage(
        cfg.default_chat_id,
        '\u{2705} <b>Mission Control</b> — Telegram bridge connected!',
      );
      return NextResponse.json({ success: ok, error: ok ? undefined : 'Failed to send message' });
    }

    if (body.action === 'set_webhook') {
      if (!body.url) {
        return NextResponse.json({ error: 'url is required' }, { status: 400 });
      }
      const cfg = getTelegramConfig();
      const result = await setWebhook(body.url, cfg.webhook_secret || undefined);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 },
    );
  }
}
