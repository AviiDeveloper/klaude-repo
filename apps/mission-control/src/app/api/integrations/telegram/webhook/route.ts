import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';
import { resolveApprovalRequest } from '@/lib/lead-orchestrator';
import {
  getTelegramConfig,
  isChatAllowed,
  sendMessage,
  answerCallbackQuery,
  editMessageText,
  formatTaskSummary,
  formatTaskList,
} from '@/lib/telegram';
import type { Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Telegram always expects 200 — non-200 causes retries
const OK = NextResponse.json({ ok: true });

function getChatId(update: TelegramUpdate): string | null {
  if (update.callback_query?.message?.chat?.id) {
    return String(update.callback_query.message.chat.id);
  }
  if (update.message?.chat?.id) {
    return String(update.message.chat.id);
  }
  return null;
}

// Minimal Telegram Update types (only what we use)
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name?: string };
    message?: {
      message_id: number;
      chat: { id: number };
    };
    data?: string;
  };
}

function logActivity(taskId: string, message: string, chatId: string): void {
  run(
    `INSERT INTO task_activities (id, task_id, activity_type, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), taskId, 'status_changed', message, JSON.stringify({ operator_id: `telegram:${chatId}` }), new Date().toISOString()],
  );
}

const HELP_TEXT = `<b>Available Commands</b>

/tasks — List active tasks
/status &lt;task_id&gt; — Task details
/approve &lt;approval_id&gt; — Approve a request
/deny &lt;approval_id&gt; — Deny a request
/help — Show this message`;

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret if configured
    const cfg = getTelegramConfig();
    if (cfg.webhook_secret) {
      const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
      if (headerSecret !== cfg.webhook_secret) {
        console.warn('[Telegram Webhook] Invalid secret token');
        return OK; // Still 200 to avoid Telegram retries
      }
    }

    const update = (await request.json()) as TelegramUpdate;
    const chatId = getChatId(update);

    if (!chatId || !isChatAllowed(chatId)) {
      console.warn(`[Telegram Webhook] Unauthorized chat: ${chatId}`);
      return OK;
    }

    // Handle callback queries (inline button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, chatId);
      return OK;
    }

    // Handle text commands
    if (update.message?.text) {
      await handleCommand(update.message.text, chatId);
    }

    return OK;
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    return OK; // Always 200
  }
}

async function handleCommand(text: string, chatId: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    await sendMessage(chatId, 'Send /help for available commands.');
    return;
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/@\w+$/, ''); // strip @botname
  const arg = parts[1] || '';

  switch (cmd) {
    case '/tasks':
      await cmdTasks(chatId);
      break;
    case '/status':
      await cmdStatus(chatId, arg);
      break;
    case '/approve':
      await cmdApproval(chatId, arg, 'approved');
      break;
    case '/deny':
      await cmdApproval(chatId, arg, 'denied');
      break;
    case '/help':
    case '/start':
      await sendMessage(chatId, HELP_TEXT);
      break;
    default:
      await sendMessage(chatId, `Unknown command: <code>${cmd}</code>\n\n${HELP_TEXT}`);
  }
}

interface TaskWithJoin extends Task {
  assigned_agent_name?: string;
}

async function cmdTasks(chatId: string): Promise<void> {
  const tasks = queryAll<TaskWithJoin>(
    `SELECT t.*, a.name as assigned_agent_name
     FROM tasks t
     LEFT JOIN agents a ON t.assigned_agent_id = a.id
     WHERE t.status NOT IN ('done')
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
       t.updated_at DESC
     LIMIT 20`,
    [],
  );

  const mapped = tasks.map((t) => ({
    ...t,
    assigned_agent: t.assigned_agent_name
      ? { name: t.assigned_agent_name } as Task['assigned_agent']
      : undefined,
  }));

  await sendMessage(chatId, formatTaskList(mapped as Task[]));
}

async function cmdStatus(chatId: string, taskId: string): Promise<void> {
  if (!taskId) {
    await sendMessage(chatId, 'Usage: /status &lt;task_id&gt;');
    return;
  }

  // Support partial ID match
  const task = queryOne<TaskWithJoin>(
    `SELECT t.*, a.name as assigned_agent_name
     FROM tasks t
     LEFT JOIN agents a ON t.assigned_agent_id = a.id
     WHERE t.id = ? OR t.id LIKE ?
     LIMIT 1`,
    [taskId, `${taskId}%`],
  );

  if (!task) {
    await sendMessage(chatId, `Task not found: <code>${taskId}</code>`);
    return;
  }

  if (task.assigned_agent_name) {
    task.assigned_agent = { name: task.assigned_agent_name } as Task['assigned_agent'];
  }

  await sendMessage(chatId, formatTaskSummary(task));
}

async function cmdApproval(chatId: string, approvalId: string, decision: 'approved' | 'denied'): Promise<void> {
  if (!approvalId) {
    await sendMessage(chatId, `Usage: /${decision === 'approved' ? 'approve' : 'deny'} &lt;approval_id&gt;`);
    return;
  }

  // Look up the approval request
  const approval = queryOne<{ id: string; task_id: string; workspace_id: string; status: string }>(
    `SELECT id, task_id, workspace_id, status FROM lead_approval_requests WHERE id = ? OR id LIKE ?`,
    [approvalId, `${approvalId}%`],
  );

  if (!approval) {
    await sendMessage(chatId, `Approval request not found: <code>${approvalId}</code>`);
    return;
  }

  if (approval.status !== 'pending') {
    await sendMessage(chatId, `Approval already resolved: <b>${approval.status}</b>`);
    return;
  }

  try {
    resolveApprovalRequest({
      workspaceId: approval.workspace_id,
      taskId: approval.task_id,
      approvalRequestId: approval.id,
      operatorId: `telegram:${chatId}`,
      decision,
    });
    logActivity(approval.task_id, `Approval ${decision} via Telegram`, chatId);
    const emoji = decision === 'approved' ? '\u{2705}' : '\u{274C}';
    await sendMessage(chatId, `${emoji} Approval <code>${approval.id.slice(0, 8)}</code> ${decision}.`);
  } catch (err) {
    await sendMessage(chatId, `Failed to resolve approval: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

async function handleCallbackQuery(
  query: NonNullable<TelegramUpdate['callback_query']>,
  chatId: string,
): Promise<void> {
  const data = query.data || '';
  // Format: approve:<approval_id>:<task_id> or deny:<approval_id>:<task_id>
  const parts = data.split(':');
  if (parts.length < 3 || !['approve', 'deny'].includes(parts[0])) {
    await answerCallbackQuery(query.id, 'Invalid action');
    return;
  }

  const [action, approvalId, taskId] = parts;
  const decision = action === 'approve' ? 'approved' : 'denied';

  const approval = queryOne<{ id: string; workspace_id: string; status: string }>(
    `SELECT id, workspace_id, status FROM lead_approval_requests WHERE id = ?`,
    [approvalId],
  );

  if (!approval) {
    await answerCallbackQuery(query.id, 'Approval not found');
    return;
  }

  if (approval.status !== 'pending') {
    await answerCallbackQuery(query.id, `Already ${approval.status}`);
    if (query.message) {
      await editMessageText(
        chatId,
        query.message.message_id,
        `\u{2705} Already resolved: <b>${approval.status}</b>`,
      );
    }
    return;
  }

  try {
    resolveApprovalRequest({
      workspaceId: approval.workspace_id,
      taskId,
      approvalRequestId: approvalId,
      operatorId: `telegram:${chatId}`,
      decision,
    });
    logActivity(taskId, `Approval ${decision} via Telegram`, chatId);

    const emoji = decision === 'approved' ? '\u{2705}' : '\u{274C}';
    await answerCallbackQuery(query.id, `${decision === 'approved' ? 'Approved' : 'Denied'}!`);

    if (query.message) {
      await editMessageText(
        chatId,
        query.message.message_id,
        `${emoji} <b>${decision === 'approved' ? 'Approved' : 'Denied'}</b> by operator via Telegram.\n\nApproval: <code>${approvalId.slice(0, 8)}</code>\nTask: <code>${taskId.slice(0, 8)}</code>`,
      );
    }
  } catch (err) {
    await answerCallbackQuery(query.id, 'Error processing');
    console.error('[Telegram Webhook] Callback error:', err);
  }
}
