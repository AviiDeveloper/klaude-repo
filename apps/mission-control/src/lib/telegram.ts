import { queryOne, queryAll, run } from '@/lib/db';
import type { SSEEvent, Task, TaskActivity } from '@/lib/types';

// ---------------------------------------------------------------------------
// Config types & constants
// ---------------------------------------------------------------------------

export interface TelegramConfig {
  bot_token: string;
  default_chat_id: string;
  allowed_chat_ids: string;
  webhook_secret: string;
  enabled: string; // 'true' | 'false'
}

type SettingRow = {
  setting_key: string;
  setting_value: string;
};

const DEFAULTS: TelegramConfig = {
  bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
  default_chat_id: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
  allowed_chat_ids: process.env.TELEGRAM_ALLOWED_CHAT_IDS || '',
  webhook_secret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  enabled: 'false',
};

const KEY_MAP = {
  bot_token: 'telegram.bot_token',
  default_chat_id: 'telegram.default_chat_id',
  allowed_chat_ids: 'telegram.allowed_chat_ids',
  webhook_secret: 'telegram.webhook_secret',
  enabled: 'telegram.enabled',
} as const;

// Core runtime URL — the OpenClaw MissionControlServer that owns TelegramTransport
const CORE_RUNTIME_URL = process.env.CORE_RUNTIME_URL || 'http://127.0.0.1:4317';

// ---------------------------------------------------------------------------
// Config helpers (same pattern as openclaw/config.ts)
// ---------------------------------------------------------------------------

function readSetting(key: string): string | null {
  const row = queryOne<SettingRow>(
    `SELECT setting_key, setting_value FROM app_settings WHERE setting_key = ?`,
    [key],
  );
  if (!row) return null;
  return row.setting_value;
}

export function getTelegramConfig(): TelegramConfig {
  return {
    bot_token: readSetting(KEY_MAP.bot_token) || DEFAULTS.bot_token,
    default_chat_id: readSetting(KEY_MAP.default_chat_id) || DEFAULTS.default_chat_id,
    allowed_chat_ids: readSetting(KEY_MAP.allowed_chat_ids) || DEFAULTS.allowed_chat_ids,
    webhook_secret: readSetting(KEY_MAP.webhook_secret) || DEFAULTS.webhook_secret,
    enabled: readSetting(KEY_MAP.enabled) || DEFAULTS.enabled,
  };
}

export function upsertTelegramConfig(input: Partial<TelegramConfig>): TelegramConfig {
  const next = {
    ...getTelegramConfig(),
    ...input,
  };

  const now = new Date().toISOString();
  const entries: Array<[string, string]> = [
    [KEY_MAP.bot_token, next.bot_token],
    [KEY_MAP.default_chat_id, next.default_chat_id],
    [KEY_MAP.allowed_chat_ids, next.allowed_chat_ids],
    [KEY_MAP.webhook_secret, next.webhook_secret],
    [KEY_MAP.enabled, next.enabled],
  ];

  for (const [key, value] of entries) {
    run(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`,
      [key, value, now],
    );
  }

  return next;
}

export function isTelegramConfigured(): boolean {
  const cfg = getTelegramConfig();
  return cfg.enabled === 'true' && !!cfg.bot_token && !!cfg.default_chat_id;
}

export function isChatAllowed(chatId: string | number): boolean {
  const cfg = getTelegramConfig();
  const id = String(chatId);
  if (id === cfg.default_chat_id) return true;
  if (!cfg.allowed_chat_ids) return false;
  const allowed = cfg.allowed_chat_ids.split(',').map((s) => s.trim());
  return allowed.includes(id);
}

// ---------------------------------------------------------------------------
// Core runtime relay — all Telegram Bot API calls go through OpenClaw
// ---------------------------------------------------------------------------

async function relaySend(payload: {
  chatId?: string | number;
  text: string;
  parseMode?: string;
  buttons?: Array<Array<{ text: string; callback_data: string }>>;
}): Promise<boolean> {
  try {
    const res = await fetch(`${CORE_RUNTIME_URL}/api/telegram/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[Telegram→Core] send relay failed: ${res.status}`);
      return false;
    }
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch (err) {
    console.error('[Telegram→Core] send relay error:', err);
    return false;
  }
}

async function relayConfig(action: string, extra?: Record<string, unknown>): Promise<{ ok: boolean; detail?: string; description?: string }> {
  try {
    const res = await fetch(`${CORE_RUNTIME_URL}/api/telegram/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    return await res.json() as { ok: boolean; detail?: string; description?: string };
  } catch (err) {
    return { ok: false, detail: String(err) };
  }
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  _parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<boolean> {
  return relaySend({ chatId: String(chatId), text, parseMode: _parseMode });
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: InlineButton[][],
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<boolean> {
  return relaySend({ chatId: String(chatId), text, parseMode, buttons });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<boolean> {
  const result = await relayConfig('answer_callback', { callbackQueryId, text });
  return result.ok;
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  _parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
): Promise<boolean> {
  const result = await relayConfig('edit_message', {
    chatId: String(chatId),
    messageId,
    text,
  });
  return result.ok;
}

export async function setWebhook(url: string, _secretToken?: string): Promise<{ ok: boolean; description?: string }> {
  return relayConfig('set_webhook', { url });
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PRIORITY_EMOJI: Record<string, string> = {
  urgent: '\u{1F534}',
  high: '\u{1F7E0}',
  normal: '\u{1F535}',
  low: '\u{26AA}',
};

const STATUS_LABEL: Record<string, string> = {
  planning: '\u{1F4DD} Planning',
  inbox: '\u{1F4E5} Inbox',
  assigned: '\u{1F4CB} Assigned',
  in_progress: '\u{26A1} In Progress',
  testing: '\u{1F9EA} Testing',
  review: '\u{1F50D} Review',
  done: '\u{2705} Done',
};

export function formatTaskNotification(event: SSEEvent): string | null {
  const { type, payload } = event;

  if (type === 'task_created') {
    const task = payload as Task;
    const pri = PRIORITY_EMOJI[task.priority] || '';
    return `${pri} <b>New Task</b>\n<b>${escapeHtml(task.title)}</b>\nPriority: ${task.priority}\nStatus: ${task.status}`;
  }

  if (type === 'task_updated') {
    const task = payload as Task;
    const status = STATUS_LABEL[task.status] || task.status;
    return `\u{1F504} <b>Task Updated</b>\n<b>${escapeHtml(task.title)}</b>\nStatus: ${status}`;
  }

  if (type === 'task_deleted') {
    const p = payload as { id: string };
    return `\u{1F5D1} <b>Task Deleted</b>\nID: <code>${p.id}</code>`;
  }

  if (type === 'activity_logged') {
    const activity = payload as TaskActivity;
    return `\u{1F4AC} <b>Activity</b>\n${escapeHtml(activity.message)}`;
  }

  if (type === 'agent_spawned') {
    const p = payload as { taskId: string; agentName?: string };
    const name = p.agentName || 'Agent';
    return `\u{1F916} <b>${escapeHtml(name)}</b> spawned for task <code>${p.taskId}</code>`;
  }

  if (type === 'agent_completed') {
    const p = payload as { taskId: string; agentName?: string; summary?: string };
    const name = p.agentName || 'Agent';
    let msg = `\u{2705} <b>${escapeHtml(name)}</b> completed task <code>${p.taskId}</code>`;
    if (p.summary) msg += `\n${escapeHtml(p.summary)}`;
    return msg;
  }

  // approval_requested is handled separately with buttons
  if (type === 'approval_requested') return null;

  return null;
}

export function formatTaskSummary(task: Task): string {
  const pri = PRIORITY_EMOJI[task.priority] || '';
  const status = STATUS_LABEL[task.status] || task.status;
  let msg = `${pri} <b>${escapeHtml(task.title)}</b>\n`;
  msg += `ID: <code>${task.id}</code>\n`;
  msg += `Status: ${status}\n`;
  msg += `Priority: ${task.priority}\n`;
  if (task.assigned_agent?.name) msg += `Assigned: ${escapeHtml(task.assigned_agent.name)}\n`;
  if (task.due_date) msg += `Due: ${task.due_date}\n`;
  if (task.description) msg += `\n${escapeHtml(task.description.slice(0, 300))}`;
  return msg;
}

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return '\u{1F4ED} No active tasks.';
  let msg = `<b>\u{1F4CB} Active Tasks (${tasks.length})</b>\n\n`;
  for (const task of tasks.slice(0, 15)) {
    const pri = PRIORITY_EMOJI[task.priority] || '';
    const status = STATUS_LABEL[task.status] || task.status;
    msg += `${pri} <b>${escapeHtml(task.title)}</b>\n`;
    msg += `   ${status} | <code>${task.id.slice(0, 8)}</code>\n\n`;
  }
  if (tasks.length > 15) msg += `... and ${tasks.length - 15} more`;
  return msg;
}

export function formatApprovalRequest(
  approval: { id: string; recommendation: string; risks_json?: string },
  task: Task,
): { text: string; buttons: InlineButton[][] } {
  const risks = approval.risks_json ? JSON.parse(approval.risks_json) as string[] : [];
  let text = `\u{1F6A8} <b>Approval Required</b>\n\n`;
  text += `<b>Task:</b> ${escapeHtml(task.title)}\n`;
  text += `<b>ID:</b> <code>${task.id}</code>\n\n`;
  text += `<b>Recommendation:</b>\n${escapeHtml(approval.recommendation)}\n`;
  if (risks.length > 0) {
    text += `\n<b>Risks:</b>\n`;
    for (const risk of risks) {
      text += `\u{26A0}\u{FE0F} ${escapeHtml(risk)}\n`;
    }
  }

  const buttons: InlineButton[][] = [
    [
      { text: '\u{2705} Approve', callback_data: `approve:${approval.id}:${task.id}` },
      { text: '\u{274C} Deny', callback_data: `deny:${approval.id}:${task.id}` },
    ],
  ];

  return { text, buttons };
}

// ---------------------------------------------------------------------------
// Charlie-specific formatters
// ---------------------------------------------------------------------------

export function formatAgentQuestion(
  agentName: string,
  question: string,
  taskTitle: string,
): string {
  return (
    `\u{2753} <b>Agent Question</b>\n\n` +
    `<b>Agent:</b> ${escapeHtml(agentName)}\n` +
    `<b>Task:</b> ${escapeHtml(taskTitle)}\n\n` +
    `${escapeHtml(question)}`
  );
}

export function formatRecoveryNotification(
  action: string,
  rationale: string,
  taskTitle: string,
): string {
  const actionLabel: Record<string, string> = {
    retry_same: '\u{1F504} Retrying with same agent',
    reassign: '\u{1F500} Reassigning to different agent',
    escalate: '\u{1F6A8} Escalating to operator',
    modify_task: '\u{270F}\u{FE0F} Modifying task requirements',
  };
  return (
    `\u{26A0}\u{FE0F} <b>Recovery Action</b>\n\n` +
    `<b>Task:</b> ${escapeHtml(taskTitle)}\n` +
    `<b>Action:</b> ${actionLabel[action] || action}\n\n` +
    `${escapeHtml(rationale)}`
  );
}

// ---------------------------------------------------------------------------
// Outbound hook — called from broadcast() in events.ts
// Delegates to core runtime's TelegramTransport via relay
// ---------------------------------------------------------------------------

export async function notifyTelegram(event: SSEEvent): Promise<void> {
  try {
    if (!isTelegramConfigured()) return;

    const cfg = getTelegramConfig();
    const chatId = cfg.default_chat_id;

    // Handle approval requests with inline buttons
    if (event.type === 'approval_requested') {
      const p = event.payload as {
        approval_id: string;
        task_id: string;
        recommendation: string;
        risks_json?: string;
      };

      // Look up the task for context
      const task = queryOne<Task>(
        'SELECT * FROM tasks WHERE id = ?',
        [p.task_id],
      );
      if (!task) return;

      const { text, buttons } = formatApprovalRequest(
        { id: p.approval_id, recommendation: p.recommendation, risks_json: p.risks_json },
        task,
      );
      await sendMessageWithButtons(chatId, text, buttons);
      return;
    }

    // Standard notifications
    const text = formatTaskNotification(event);
    if (text) {
      await sendMessage(chatId, text);
    }
  } catch (err) {
    console.error('[Telegram] notifyTelegram error:', err);
  }
}
