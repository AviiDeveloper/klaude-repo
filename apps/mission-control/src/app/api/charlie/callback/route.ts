import { NextRequest, NextResponse } from 'next/server';
import { handleCallback } from '@/lib/charlie-telegram';

export const dynamic = 'force-dynamic';

/**
 * POST /api/charlie/callback
 * Receives charlie: prefixed callback queries forwarded by the core runtime.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      chat_id: string;
      callback_data: string;
      callback_query_id: string;
    };

    if (!body.chat_id || !body.callback_data) {
      return NextResponse.json(
        { error: 'chat_id and callback_data are required' },
        { status: 400 },
      );
    }

    // Process asynchronously
    handleCallback(body.chat_id, body.callback_data, body.callback_query_id).catch(
      (err) => console.error('[Charlie] Callback handling error:', err),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Charlie] Callback route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
