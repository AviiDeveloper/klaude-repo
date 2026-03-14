/**
 * Audit Logger — persistent, queryable paper trail for everything Charlie does
 *
 * Every significant action gets a row in `audit_log`:
 * - LLM calls (prompt, response, tokens, cost, latency)
 * - Telegram sends/receives (message, chat, delivery status)
 * - Task lifecycle (create, delegate, complete, fail)
 * - Errors (component, error message, stack)
 * - Decisions (intent classification, self-execute vs delegate, agent selection)
 *
 * This replaces scattered console.log calls with structured, persistent records.
 */

import { v4 as uuidv4 } from 'uuid';
import { run, queryAll, queryOne } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditLevel = 'debug' | 'info' | 'warn' | 'error';

export type AuditComponent =
  | 'charlie_brain'
  | 'charlie_telegram'
  | 'charlie_monitor'
  | 'lead_orchestrator'
  | 'telegram_transport'
  | 'task_dispatch'
  | 'agent_execution'
  | 'api'
  | 'system';

export interface AuditEntry {
  id: string;
  created_at: string;
  level: AuditLevel;
  component: AuditComponent;
  action: string;
  message: string;
  task_id: string | null;
  agent_id: string | null;
  chat_id: string | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  metadata_json: string | null;
  error_message: string | null;
  error_stack: string | null;
}

// ---------------------------------------------------------------------------
// Schema setup
// ---------------------------------------------------------------------------

let schemaReady = false;

export function ensureAuditSchema(): void {
  if (schemaReady) return;

  run(`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    component TEXT NOT NULL,
    action TEXT NOT NULL,
    message TEXT NOT NULL,
    task_id TEXT,
    agent_id TEXT,
    chat_id TEXT,
    duration_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd REAL,
    metadata_json TEXT,
    error_message TEXT,
    error_stack TEXT
  )`);

  run(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`);
  run(`CREATE INDEX IF NOT EXISTS idx_audit_log_component ON audit_log(component, created_at DESC)`);
  run(`CREATE INDEX IF NOT EXISTS idx_audit_log_task ON audit_log(task_id, created_at DESC)`);
  run(`CREATE INDEX IF NOT EXISTS idx_audit_log_level ON audit_log(level, created_at DESC)`);

  schemaReady = true;
}

// ---------------------------------------------------------------------------
// Core logging function
// ---------------------------------------------------------------------------

export function audit(
  level: AuditLevel,
  component: AuditComponent,
  action: string,
  message: string,
  details?: {
    taskId?: string;
    agentId?: string;
    chatId?: string;
    durationMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    metadata?: Record<string, unknown>;
    error?: Error | unknown;
  },
): void {
  ensureAuditSchema();

  const id = uuidv4();
  const now = new Date().toISOString();

  let errorMessage: string | null = null;
  let errorStack: string | null = null;
  if (details?.error) {
    if (details.error instanceof Error) {
      errorMessage = details.error.message;
      errorStack = details.error.stack || null;
    } else {
      errorMessage = String(details.error);
    }
  }

  const metadataJson = details?.metadata ? JSON.stringify(details.metadata) : null;

  try {
    run(
      `INSERT INTO audit_log (id, created_at, level, component, action, message, task_id, agent_id, chat_id, duration_ms, input_tokens, output_tokens, cost_usd, metadata_json, error_message, error_stack)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, now, level, component, action, message,
        details?.taskId || null,
        details?.agentId || null,
        details?.chatId || null,
        details?.durationMs || null,
        details?.inputTokens || null,
        details?.outputTokens || null,
        details?.costUsd || null,
        metadataJson,
        errorMessage,
        errorStack,
      ],
    );
  } catch (dbErr) {
    // Last resort: if audit logging itself fails, console is our fallback
    console.error('[AUDIT FALLBACK]', level, component, action, message, dbErr);
  }

  // Also mirror to console for real-time visibility
  const prefix = `[${component}] ${action}:`;
  switch (level) {
    case 'error':
      console.error(prefix, message, errorMessage || '');
      break;
    case 'warn':
      console.warn(prefix, message);
      break;
    case 'debug':
      // Only log debug to console if DEBUG env is set
      if (process.env.DEBUG) console.log(prefix, message);
      break;
    default:
      console.log(prefix, message);
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/** Log an LLM call with full telemetry */
export function auditLlmCall(
  action: string,
  opts: {
    taskId?: string;
    chatId?: string;
    model: string;
    systemPrompt: string;
    userContent: string;
    response: unknown;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    durationMs: number;
    success: boolean;
    error?: Error | unknown;
  },
): void {
  const level: AuditLevel = opts.success ? 'info' : 'error';
  const message = opts.success
    ? `LLM ${action} completed in ${opts.durationMs}ms (${opts.inputTokens || '?'}+${opts.outputTokens || '?'} tokens)`
    : `LLM ${action} failed after ${opts.durationMs}ms`;

  audit(level, 'charlie_brain', `llm.${action}`, message, {
    taskId: opts.taskId,
    chatId: opts.chatId,
    durationMs: opts.durationMs,
    inputTokens: opts.inputTokens,
    outputTokens: opts.outputTokens,
    costUsd: opts.costUsd,
    error: opts.error,
    metadata: {
      model: opts.model,
      systemPromptLength: opts.systemPrompt.length,
      userContentLength: opts.userContent.length,
      responsePreview: opts.response
        ? JSON.stringify(opts.response).slice(0, 500)
        : null,
    },
  });

  // Also write to ai_request_telemetry for unified LLM tracking
  try {
    run(
      `INSERT INTO ai_request_telemetry (id, created_at, request_id, method, provider, model, finish_reason, status, error_message, session_key, session_id, input_tokens, output_tokens, total_tokens, cost_usd, request_json, response_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        new Date().toISOString(),
        null, // request_id
        `charlie.${action}`,
        'openrouter',
        opts.model,
        opts.success ? 'stop' : 'error',
        opts.success ? 'ok' : 'error',
        opts.error ? (opts.error instanceof Error ? opts.error.message : String(opts.error)) : null,
        'charlie-brain',
        null,
        opts.inputTokens || null,
        opts.outputTokens || null,
        (opts.inputTokens || 0) + (opts.outputTokens || 0) || null,
        opts.costUsd || null,
        JSON.stringify({
          system: opts.systemPrompt.slice(0, 2000),
          user: opts.userContent.slice(0, 2000),
        }),
        opts.response ? JSON.stringify(opts.response).slice(0, 5000) : null,
      ],
    );
  } catch {
    // Non-critical — audit_log already has it
  }
}

/** Log a Telegram message send/receive */
export function auditTelegram(
  action: 'send' | 'receive' | 'send_failed' | 'callback',
  opts: {
    chatId: string;
    messagePreview: string;
    taskId?: string;
    success: boolean;
    durationMs?: number;
    error?: Error | unknown;
    metadata?: Record<string, unknown>;
  },
): void {
  const level: AuditLevel = opts.success ? 'info' : 'error';
  const message = `Telegram ${action}: "${opts.messagePreview.slice(0, 80)}${opts.messagePreview.length > 80 ? '...' : ''}"`;

  audit(level, 'telegram_transport', `telegram.${action}`, message, {
    chatId: opts.chatId,
    taskId: opts.taskId,
    durationMs: opts.durationMs,
    error: opts.error,
    metadata: opts.metadata,
  });
}

/** Log a task lifecycle event */
export function auditTask(
  action: string,
  opts: {
    taskId: string;
    title?: string;
    agentId?: string;
    chatId?: string;
    metadata?: Record<string, unknown>;
  },
): void {
  const message = opts.title
    ? `Task ${action}: "${opts.title}"`
    : `Task ${action}: ${opts.taskId.slice(0, 8)}`;

  audit('info', 'charlie_telegram', `task.${action}`, message, {
    taskId: opts.taskId,
    agentId: opts.agentId,
    chatId: opts.chatId,
    metadata: opts.metadata,
  });
}

// ---------------------------------------------------------------------------
// Query helpers (for API/dashboard)
// ---------------------------------------------------------------------------

export function getRecentAuditLogs(
  limit = 50,
  filters?: { component?: string; level?: string; taskId?: string },
): AuditEntry[] {
  let sql = `SELECT * FROM audit_log WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.component) {
    sql += ` AND component = ?`;
    params.push(filters.component);
  }
  if (filters?.level) {
    sql += ` AND level = ?`;
    params.push(filters.level);
  }
  if (filters?.taskId) {
    sql += ` AND task_id = ?`;
    params.push(filters.taskId);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  return queryAll<AuditEntry>(sql, params);
}

export function getAuditStats(sinceDays = 1): {
  totalEntries: number;
  errorCount: number;
  llmCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  telegramMessages: number;
} {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();

  const total = queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM audit_log WHERE created_at > ?`, [since],
  );
  const errors = queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM audit_log WHERE level = 'error' AND created_at > ?`, [since],
  );
  const llm = queryOne<{ cnt: number; tokens: number; cost: number }>(
    `SELECT COUNT(*) as cnt, COALESCE(SUM(input_tokens + output_tokens), 0) as tokens, COALESCE(SUM(cost_usd), 0) as cost FROM audit_log WHERE action LIKE 'llm.%' AND created_at > ?`, [since],
  );
  const telegram = queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM audit_log WHERE component = 'telegram_transport' AND created_at > ?`, [since],
  );

  return {
    totalEntries: total?.cnt || 0,
    errorCount: errors?.cnt || 0,
    llmCalls: llm?.cnt || 0,
    totalTokens: llm?.tokens || 0,
    totalCostUsd: llm?.cost || 0,
    telegramMessages: telegram?.cnt || 0,
  };
}
