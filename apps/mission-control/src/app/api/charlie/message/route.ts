import { NextRequest, NextResponse } from 'next/server';
import { handleIncomingMessage } from '@/lib/charlie-telegram';

export const dynamic = 'force-dynamic';

/**
 * POST /api/charlie/message
 * Receives free-form Telegram messages forwarded by the core runtime.
 * Returns immediately — processing happens async via Telegram replies.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      chat_id: string;
      text: string;
      message_id?: number;
    };

    if (!body.chat_id || !body.text) {
      return NextResponse.json(
        { error: 'chat_id and text are required' },
        { status: 400 },
      );
    }

    // Process asynchronously — don't block the webhook response
    handleIncomingMessage(body.chat_id, body.text, body.message_id).catch(
      (err) => console.error('[Charlie] Message handling error:', err),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Charlie] Message route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
