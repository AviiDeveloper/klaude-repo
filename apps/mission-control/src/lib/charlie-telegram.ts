/**
 * Charlie Telegram — Conversation manager for the Master Orchestrator
 *
 * Handles inbound Telegram messages, routes by intent, and manages
 * the task creation → decomposition → delegation → monitoring flow.
 */

import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import {
  sendMessage,
  sendMessageWithButtons,
  formatTaskSummary,
  formatTaskList,
  type InlineButton,
} from '@/lib/telegram';
import {
  analyzeIncomingMessage,
  decomposeTask,
  canSelfExecute,
  executeTaskDirectly,
  type MessageAnalysis,
  type TaskDecomposition,
} from '@/lib/charlie-brain';
import {
  ensureLeadAgent,
  intakeTask,
  delegateTask,
  resolveApprovalRequest,
  logLeadDecision,
} from '@/lib/lead-orchestrator';
import { audit, auditTelegram, auditTask } from '@/lib/audit-logger';
import { executeAgentTask } from '@/lib/agent-executor';
import type { Agent, Task } from '@/lib/types';

// ---------------------------------------------------------------------------
// DB setup — conversation history table
// ---------------------------------------------------------------------------

export function ensureCharlieSchema(): void {
  run(`CREATE TABLE IF NOT EXISTS charlie_conversations (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    message_id INTEGER,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    intent TEXT,
    task_id TEXT,
    created_at TEXT NOT NULL
  )`);
  run(`CREATE INDEX IF NOT EXISTS idx_charlie_conv_chat ON charlie_conversations(chat_id, created_at)`);

  run(`CREATE TABLE IF NOT EXISTS charlie_task_plans (
    task_id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    plan_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

// ---------------------------------------------------------------------------
// Conversation history helpers
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  chat_id: string;
  message_id: number | null;
  role: string;
  content: string;
  intent: string | null;
  task_id: string | null;
  created_at: string;
}

function storeMessage(
  chatId: string,
  role: 'user' | 'charlie',
  content: string,
  intent?: string,
  taskId?: string,
  messageId?: number,
): void {
  run(
    `INSERT INTO charlie_conversations (id, chat_id, message_id, role, content, intent, task_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), chatId, messageId || null, role, content, intent || null, taskId || null, new Date().toISOString()],
  );
}

function getRecentHistory(chatId: string, limit = 10): Array<{ role: 'user' | 'charlie'; content: string }> {
  const rows = queryAll<ConversationRow>(
    `SELECT role, content FROM charlie_conversations
     WHERE chat_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [chatId, limit],
  );
  return rows.reverse().map((r) => ({
    role: r.role as 'user' | 'charlie',
    content: r.content,
  }));
}

// ---------------------------------------------------------------------------
// Main entry point — called from API route
// ---------------------------------------------------------------------------

export async function handleIncomingMessage(
  chatId: string,
  text: string,
  messageId?: number,
): Promise<void> {
  ensureCharlieSchema();

  // Store the incoming message
  storeMessage(chatId, 'user', text, undefined, undefined, messageId);

  // Get conversation context
  const history = getRecentHistory(chatId);

  // Analyze intent via LLM
  const analysis = await analyzeIncomingMessage(text, history);

  audit('info', 'charlie_telegram', 'intent_classified', `Intent: ${analysis.intent} (${analysis.confidence}) for: "${text.slice(0, 60)}"`, {
    chatId,
    metadata: { intent: analysis.intent, confidence: analysis.confidence, textPreview: text.slice(0, 200) },
  });

  // Route by intent
  try {
    switch (analysis.intent) {
      case 'new_task':
        await handleNewTaskIntent(chatId, analysis);
        break;
      case 'direct_action':
        await handleDirectAction(chatId, analysis);
        break;
      case 'status_check':
        await handleStatusCheck(chatId, text, analysis);
        break;
      case 'approval_response':
        await handleApprovalResponse(chatId, text, analysis);
        break;
      case 'followup':
        await handleFollowup(chatId, text, analysis);
        break;
      case 'question':
      case 'chitchat':
      default:
        await handleGenericResponse(chatId, analysis);
        break;
    }
  } catch (err) {
    audit('error', 'charlie_telegram', 'handler_error', `Handler crashed for intent ${analysis.intent}`, {
      chatId, error: err,
      metadata: { intent: analysis.intent, textPreview: text.slice(0, 200) },
    });
    await reply(chatId, `Sorry, I hit an error processing your message. Please try again.`).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Intent handlers
// ---------------------------------------------------------------------------

async function handleNewTaskIntent(
  chatId: string,
  analysis: MessageAnalysis,
): Promise<void> {
  const extracted = analysis.extractedTask;
  if (!extracted) {
    const msg = "I couldn't parse a task from your message. Could you describe what you need done?";
    await reply(chatId, msg);
    return;
  }

  console.log(`[Charlie] handleNewTaskIntent: "${extracted.title}"`);

  // -----------------------------------------------------------------------
  // Self-execute path: check FIRST, before any DB operations
  // -----------------------------------------------------------------------
  if (canSelfExecute({ title: extracted.title, description: extracted.description })) {
    auditTask('self_execute_start', { taskId: 'pending', title: extracted.title, chatId });

    // Create a minimal task record
    const taskId = uuidv4();
    const now = new Date().toISOString();
    try {
      const lead = ensureLeadAgent('default');
      run(
        `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, created_by_agent_id, workspace_id, business_id, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, extracted.title, extracted.description || null, 'in_progress', extracted.priority || 'normal',
         null, lead.id, 'default', 'default', null, now, now],
      );
    } catch (dbErr) {
      console.error('[Charlie] Task insert error (continuing):', dbErr);
    }

    await reply(chatId, `\u{1F9E0} Working on: <b>${escapeHtml(extracted.title)}</b>...`);

    const result = await executeTaskDirectly({
      title: extracted.title,
      description: extracted.description,
    });

    auditTask(result.success ? 'self_execute_complete' : 'self_execute_failed', {
      taskId, title: extracted.title, chatId,
      metadata: { outputLength: result.output?.length || 0, success: result.success },
    });

    if (result.success) {
      let resultMsg = `\u{2705} <b>Task Complete:</b> ${escapeHtml(extracted.title)}\n\n`;
      resultMsg += escapeHtml(result.output);

      if (resultMsg.length > 4000) {
        const chunks = splitMessage(resultMsg, 4000);
        for (const chunk of chunks) {
          await reply(chatId, chunk);
        }
      } else {
        await reply(chatId, resultMsg);
      }

      // Mark done
      try {
        const doneTime = new Date().toISOString();
        run(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`, [doneTime, taskId]);
      } catch (e) { console.error('[Charlie] Update task done error:', e); }
    } else {
      await reply(chatId, `\u{26A0}\u{FE0F} Couldn't complete this directly. ${escapeHtml(result.output)}`);
    }

    storeMessage(chatId, 'charlie', `Self-executed: ${extracted.title}`, 'new_task', taskId);
    return;
  }

  // -----------------------------------------------------------------------
  // Delegation path: full task creation + decompose
  // -----------------------------------------------------------------------
  auditTask('delegation_start', { taskId: 'pending', title: extracted.title, chatId });

  // Create the task in MC
  const taskId = uuidv4();
  const now = new Date().toISOString();
  const workspaceId = 'default';

  const lead = ensureLeadAgent(workspaceId);

  run(
    `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, created_by_agent_id, workspace_id, business_id, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskId,
      extracted.title,
      extracted.description || null,
      'planning',
      extracted.priority || 'normal',
      null,
      lead.id,
      workspaceId,
      'default',
      null,
      now,
      now,
    ],
  );

  // Log events
  try {
    run(
      `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'task_created', lead.id, taskId, `Task created via Telegram: ${extracted.title}`, now],
    );
  } catch (e) { console.error('[Charlie] Event insert error:', e); }

  // Broadcast SSE
  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (task) {
    broadcast({ type: 'task_created', payload: task });
  }

  // -----------------------------------------------------------------------
  // Delegation path: decompose and delegate to agents
  // -----------------------------------------------------------------------

  // Intake into lead queue (only for delegation path)
  try {
    intakeTask({
      taskId,
      workspaceId,
      triageSummary: `Created via Telegram. Tags: ${extracted.tags?.join(', ') || 'none'}`,
    });
  } catch (err) {
    console.error('[Charlie] intakeTask failed (continuing with delegation):', err);
  }

  // Get available agents for decomposition
  const agents = queryAll<Agent>(
    `SELECT * FROM agents WHERE workspace_id = ? AND is_master = 0 ORDER BY name ASC`,
    [workspaceId],
  );

  // Decompose the task
  const plan = await decomposeTask(
    { title: extracted.title, description: extracted.description },
    agents,
  );

  // Store the plan
  run(
    `INSERT INTO charlie_task_plans (task_id, chat_id, plan_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET
       plan_json = excluded.plan_json,
       status = excluded.status,
       updated_at = excluded.updated_at`,
    [taskId, chatId, JSON.stringify(plan), 'pending', now, now],
  );

  // Format and send the plan to Telegram
  const planText = formatExecutionPlan(plan, extracted.title, taskId);
  const buttons: InlineButton[][] = [
    [
      { text: '\u{2705} Confirm & Execute', callback_data: `charlie:confirm:${taskId}` },
      { text: '\u{270F}\u{FE0F} Modify', callback_data: `charlie:modify:${taskId}` },
    ],
    [
      { text: '\u{274C} Cancel', callback_data: `charlie:cancel:${taskId}` },
    ],
  ];

  await sendMessageWithButtons(chatId, planText, buttons);

  // Log decision
  logLeadDecision({
    workspaceId,
    taskId,
    decisionType: 'telegram_intake',
    summary: `Task created via Telegram: "${extracted.title}". Plan sent for confirmation.`,
    details: { plan, analysis },
    actorType: 'lead',
    actorId: lead.id,
  });

  storeMessage(chatId, 'charlie', `Created task and proposed plan for: ${extracted.title}`, 'new_task', taskId);
}

// ---------------------------------------------------------------------------
// Direct action handlers — Charlie does these ITSELF, no delegation
// ---------------------------------------------------------------------------

async function handleDirectAction(
  chatId: string,
  analysis: MessageAnalysis,
): Promise<void> {
  const action = analysis.directAction?.action || 'cancel_stuck';

  switch (action) {
    case 'cancel_stuck':
      await actionCancelStuck(chatId);
      break;
    case 'cancel_all':
      await actionCancelAll(chatId);
      break;
    case 'cancel_task':
      await actionCancelTask(chatId, analysis.directAction?.targetTaskId);
      break;
    case 'retry_task':
      await actionRetryTask(chatId, analysis.directAction?.targetTaskId);
      break;
    case 'clean_up':
      await actionCleanUp(chatId);
      break;
    case 'list_agents':
      await actionListAgents(chatId);
      break;
    default:
      await reply(chatId, `Unknown action: ${action}`);
  }
}

async function actionCancelStuck(chatId: string): Promise<void> {
  const now = new Date().toISOString();

  // Find tasks stuck in progress/assigned with no recent activity
  const stuck = queryAll<{ id: string; title: string; status: string }>(
    `SELECT t.id, t.title, t.status FROM tasks t
     WHERE t.status IN ('in_progress', 'assigned', 'planning', 'inbox')
       AND t.status != 'done'
     ORDER BY t.updated_at ASC`,
    [],
  );

  if (stuck.length === 0) {
    await reply(chatId, '\u{2705} No stuck tasks found.');
    storeMessage(chatId, 'charlie', 'No stuck tasks', 'direct_action');
    return;
  }

  let cancelled = 0;
  for (const t of stuck) {
    run(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`, [now, t.id]);
    run(`UPDATE lead_task_intake SET status = 'closed', updated_at = ? WHERE task_id = ?`, [now, t.id]);
    run(`UPDATE lead_task_delegations SET status = 'failed', updated_at = ?, last_error = 'Cancelled by operator' WHERE task_id = ? AND status IN ('delegated', 'running')`, [now, t.id]);
    cancelled++;
  }

  const msg = `\u{1F9F9} <b>Cancelled ${cancelled} stuck task(s):</b>\n\n` +
    stuck.map((t) => `\u{2022} ${escapeHtml(t.title)} (was ${t.status})`).join('\n');

  await reply(chatId, msg);
  storeMessage(chatId, 'charlie', `Cancelled ${cancelled} stuck tasks`, 'direct_action');
}

async function actionCancelAll(chatId: string): Promise<void> {
  const now = new Date().toISOString();

  const active = queryAll<{ id: string; title: string; status: string }>(
    `SELECT id, title, status FROM tasks WHERE status != 'done'`,
    [],
  );

  if (active.length === 0) {
    await reply(chatId, '\u{2705} No active tasks to cancel.');
    storeMessage(chatId, 'charlie', 'No active tasks', 'direct_action');
    return;
  }

  for (const t of active) {
    run(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`, [now, t.id]);
    run(`UPDATE lead_task_intake SET status = 'closed', updated_at = ? WHERE task_id = ?`, [now, t.id]);
    run(`UPDATE lead_task_delegations SET status = 'failed', updated_at = ?, last_error = 'Cancelled by operator' WHERE task_id = ? AND status IN ('delegated', 'running')`, [now, t.id]);
  }

  await reply(chatId, `\u{1F9F9} <b>Cancelled all ${active.length} task(s).</b> Clean slate!`);
  storeMessage(chatId, 'charlie', `Cancelled all ${active.length} tasks`, 'direct_action');
}

async function actionCancelTask(chatId: string, taskId?: string): Promise<void> {
  if (!taskId) {
    await reply(chatId, 'Which task? Send the task ID or name.');
    return;
  }

  const now = new Date().toISOString();
  const task = queryOne<Task>(
    `SELECT * FROM tasks WHERE id = ? OR id LIKE ?`,
    [taskId, `${taskId}%`],
  );

  if (!task) {
    await reply(chatId, `Task not found: <code>${escapeHtml(taskId)}</code>`);
    return;
  }

  run(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`, [now, task.id]);
  run(`UPDATE lead_task_intake SET status = 'closed', updated_at = ? WHERE task_id = ?`, [now, task.id]);

  await reply(chatId, `\u{274C} Cancelled: <b>${escapeHtml(task.title)}</b>`);
  storeMessage(chatId, 'charlie', `Cancelled task: ${task.title}`, 'direct_action', task.id);
}

async function actionRetryTask(chatId: string, taskId?: string): Promise<void> {
  if (!taskId) {
    // Retry the most recently stuck task
    const stuck = queryOne<{ id: string; title: string }>(
      `SELECT id, title FROM tasks WHERE status IN ('in_progress', 'assigned') ORDER BY updated_at DESC LIMIT 1`,
      [],
    );
    if (!stuck) {
      await reply(chatId, 'No tasks to retry.');
      return;
    }
    taskId = stuck.id;
  }

  const task = queryOne<Task>(`SELECT * FROM tasks WHERE id = ? OR id LIKE ?`, [taskId, `${taskId}%`]);
  if (!task) {
    await reply(chatId, `Task not found: <code>${escapeHtml(taskId)}</code>`);
    return;
  }

  const now = new Date().toISOString();
  run(`UPDATE tasks SET status = 'planning', updated_at = ? WHERE id = ?`, [now, task.id]);
  run(`UPDATE lead_task_intake SET status = 'intake', updated_at = ? WHERE task_id = ?`, [now, task.id]);

  try {
    delegateTask({ taskId: task.id, workspaceId: task.workspace_id || 'default' });
    await reply(chatId, `\u{1F504} Retrying: <b>${escapeHtml(task.title)}</b>`);
  } catch (err) {
    await reply(chatId, `\u{26A0}\u{FE0F} Retry failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }
  storeMessage(chatId, 'charlie', `Retried task: ${task.title}`, 'direct_action', task.id);
}

async function actionCleanUp(chatId: string): Promise<void> {
  const now = new Date().toISOString();

  // Close tasks stuck in planning/inbox with no activity
  const stale = queryAll<{ id: string; title: string; status: string }>(
    `SELECT t.id, t.title, t.status FROM tasks t
     WHERE t.status IN ('planning', 'inbox')
     ORDER BY t.created_at ASC`,
    [],
  );

  if (stale.length === 0) {
    await reply(chatId, '\u{2705} Nothing to clean up.');
    storeMessage(chatId, 'charlie', 'Nothing to clean up', 'direct_action');
    return;
  }

  for (const t of stale) {
    run(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`, [now, t.id]);
    run(`UPDATE lead_task_intake SET status = 'closed', updated_at = ? WHERE task_id = ?`, [now, t.id]);
  }

  await reply(chatId, `\u{1F9F9} Cleaned up ${stale.length} stale task(s) from planning/inbox.`);
  storeMessage(chatId, 'charlie', `Cleaned up ${stale.length} stale tasks`, 'direct_action');
}

async function actionListAgents(chatId: string): Promise<void> {
  const agents = queryAll<Agent>(
    `SELECT * FROM agents WHERE workspace_id = 'default' ORDER BY is_master DESC, name ASC`,
    [],
  );

  if (agents.length === 0) {
    await reply(chatId, 'No agents configured.');
    return;
  }

  let msg = `\u{1F916} <b>Available Agents (${agents.length}):</b>\n\n`;
  for (const a of agents) {
    const role = a.is_master ? '\u{1F451} Lead' : a.role;
    msg += `${a.avatar_emoji} <b>${escapeHtml(a.name)}</b> — ${escapeHtml(role)}\n`;
    msg += `   Status: ${a.status}`;
    if (a.description) msg += ` | ${escapeHtml(a.description.slice(0, 60))}`;
    msg += '\n\n';
  }

  await reply(chatId, msg);
  storeMessage(chatId, 'charlie', `Listed ${agents.length} agents`, 'direct_action');
}

async function handleStatusCheck(
  chatId: string,
  text: string,
  analysis: MessageAnalysis,
): Promise<void> {
  // Check if referencing a specific task
  if (analysis.referencedTaskId) {
    const task = queryOne<Task>(
      `SELECT * FROM tasks WHERE id = ? OR id LIKE ?`,
      [analysis.referencedTaskId, `${analysis.referencedTaskId}%`],
    );
    if (task) {
      await sendTaskDiagnosis(chatId, task);
      return;
    }
  }

  // Check for stuck/in-progress tasks and diagnose them
  const stuckTasks = queryAll<Task & { delegation_status?: string; delegation_created_at?: string }>(
    `SELECT t.*,
       d.status as delegation_status,
       d.created_at as delegation_created_at
     FROM tasks t
     LEFT JOIN lead_task_delegations d ON d.task_id = t.id
       AND d.id = (SELECT id FROM lead_task_delegations WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1)
     WHERE t.status IN ('in_progress', 'assigned')
     ORDER BY t.updated_at ASC
     LIMIT 5`,
    [],
  );

  if (stuckTasks.length > 0) {
    let msg = `\u{1F50D} <b>Task Diagnosis</b>\n\n`;
    msg += `Found ${stuckTasks.length} active task(s):\n`;

    for (const t of stuckTasks) {
      const lastActivity = queryOne<{ message: string; created_at: string }>(
        `SELECT message, created_at FROM task_activities WHERE task_id = ? ORDER BY created_at DESC LIMIT 1`,
        [t.id],
      );

      const ageMinutes = lastActivity
        ? Math.round((Date.now() - new Date(lastActivity.created_at).getTime()) / 60000)
        : null;

      msg += `\n\u{2022} <b>${escapeHtml(t.title)}</b>\n`;
      msg += `  Status: ${t.status}`;
      if (t.delegation_status) msg += ` | Delegation: ${t.delegation_status}`;
      msg += `\n`;

      if (lastActivity) {
        msg += `  Last activity: ${ageMinutes}m ago — ${escapeHtml(lastActivity.message.slice(0, 80))}\n`;
        if (ageMinutes && ageMinutes > 5) {
          msg += `  \u{26A0}\u{FE0F} <b>Stale</b> — no activity for ${ageMinutes} minutes\n`;
        }
      } else {
        msg += `  \u{26A0}\u{FE0F} <b>No activity recorded</b>\n`;
      }
    }

    // Check if there are also planning/inbox tasks piling up
    const pendingCount = queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM tasks WHERE status IN ('planning', 'inbox') AND status != 'done'`,
      [],
    );
    if (pendingCount && pendingCount.cnt > 0) {
      msg += `\n\u{1F4E5} ${pendingCount.cnt} task(s) still in planning/inbox queue`;
    }

    msg += `\n\nWant me to retry any stuck tasks or cancel them?`;

    await sendMessage(chatId, msg);
    storeMessage(chatId, 'charlie', `Diagnosed ${stuckTasks.length} tasks`, 'status_check');
  } else {
    // No stuck tasks — show general overview
    const tasks = queryAll<Task>(
      `SELECT * FROM tasks WHERE status NOT IN ('done') ORDER BY
        CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        updated_at DESC
       LIMIT 10`,
      [],
    );

    if (tasks.length === 0) {
      await reply(chatId, '\u{2705} All clear — no active tasks. Send me something to work on!');
    } else {
      await sendMessage(chatId, formatTaskList(tasks));
    }
    storeMessage(chatId, 'charlie', `Showed ${tasks.length} active tasks`, 'status_check');
  }
}

async function sendTaskDiagnosis(chatId: string, task: Task): Promise<void> {
  const activities = queryAll<{ message: string; created_at: string; activity_type: string }>(
    `SELECT message, created_at, activity_type FROM task_activities WHERE task_id = ? ORDER BY created_at DESC LIMIT 10`,
    [task.id],
  );

  const delegation = queryOne<{ status: string; delegated_to_agent_id: string; created_at: string; last_error?: string }>(
    `SELECT status, delegated_to_agent_id, created_at, last_error FROM lead_task_delegations WHERE task_id = ? ORDER BY created_at DESC LIMIT 1`,
    [task.id],
  );

  const agent = delegation?.delegated_to_agent_id
    ? queryOne<Agent>(`SELECT * FROM agents WHERE id = ?`, [delegation.delegated_to_agent_id])
    : null;

  let msg = `\u{1F50D} <b>Task Diagnosis</b>\n\n`;
  msg += `<b>${escapeHtml(task.title)}</b>\n`;
  msg += `ID: <code>${task.id.slice(0, 8)}</code> | Status: ${task.status} | Priority: ${task.priority}\n`;

  if (delegation) {
    msg += `\nDelegation: ${delegation.status}`;
    if (agent) msg += ` to ${escapeHtml(agent.name)} (${agent.status})`;
    const delegationAge = Math.round((Date.now() - new Date(delegation.created_at).getTime()) / 60000);
    msg += ` | ${delegationAge}m ago`;
    if (delegation.last_error) msg += `\n\u{274C} Error: ${escapeHtml(delegation.last_error.slice(0, 100))}`;
    msg += '\n';
  }

  if (activities.length > 0) {
    msg += `\n<b>Recent Activity:</b>\n`;
    for (const a of activities.slice(0, 5)) {
      const age = Math.round((Date.now() - new Date(a.created_at).getTime()) / 60000);
      msg += `${age}m ago: ${escapeHtml(a.message.slice(0, 80))}\n`;
    }
  } else {
    msg += `\n\u{26A0}\u{FE0F} No activity recorded for this task\n`;
  }

  await sendMessage(chatId, msg);
  storeMessage(chatId, 'charlie', `Diagnosed task: ${task.title}`, 'status_check', task.id);
}

async function handleApprovalResponse(
  chatId: string,
  text: string,
  analysis: MessageAnalysis,
): Promise<void> {
  // Look for pending approvals
  const pendingApproval = queryOne<{
    id: string;
    task_id: string;
    workspace_id: string;
    recommendation: string;
  }>(
    `SELECT id, task_id, workspace_id, recommendation
     FROM lead_approval_requests
     WHERE status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [],
  );

  if (!pendingApproval) {
    await reply(chatId, "No pending approvals at the moment.");
    storeMessage(chatId, 'charlie', 'No pending approvals', 'approval_response');
    return;
  }

  const isApproval = /\b(yes|approve|approved|go ahead|do it|ok|sure|confirm)\b/i.test(text);
  const decision = isApproval ? 'approved' : 'denied';

  try {
    resolveApprovalRequest({
      workspaceId: pendingApproval.workspace_id,
      taskId: pendingApproval.task_id,
      approvalRequestId: pendingApproval.id,
      operatorId: `telegram:${chatId}`,
      decision,
      rationale: `Operator via Telegram: "${text}"`,
    });

    const emoji = isApproval ? '\u{2705}' : '\u{274C}';
    await reply(chatId, `${emoji} Approval ${decision}. Processing...`);
    storeMessage(chatId, 'charlie', `Approval ${decision} for task ${pendingApproval.task_id}`, 'approval_response', pendingApproval.task_id);
  } catch (err) {
    await reply(chatId, `Failed to process approval: ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

async function handleFollowup(
  chatId: string,
  text: string,
  analysis: MessageAnalysis,
): Promise<void> {
  // Find the most recent task this chat was discussing
  const recentTaskConv = queryOne<ConversationRow>(
    `SELECT task_id FROM charlie_conversations
     WHERE chat_id = ? AND task_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [chatId],
  );

  if (recentTaskConv?.task_id) {
    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [recentTaskConv.task_id]);
    if (task) {
      // Provide context about the task they're following up on
      const response = analysis.response || `Regarding "${task.title}" — it's currently ${task.status}. What would you like to do?`;
      await reply(chatId, response);
      storeMessage(chatId, 'charlie', response, 'followup', task.id);
      return;
    }
  }

  // No task context — treat as generic
  await handleGenericResponse(chatId, analysis);
}

async function handleGenericResponse(
  chatId: string,
  analysis: MessageAnalysis,
): Promise<void> {
  const response =
    analysis.response ||
    "I'm Charlie, your task orchestrator. Send me a task description and I'll break it down and delegate it to the right agents. You can also ask about task status or approve pending requests.";

  await reply(chatId, response);
  storeMessage(chatId, 'charlie', response, analysis.intent);
}

// ---------------------------------------------------------------------------
// Callback handlers — for inline button responses
// ---------------------------------------------------------------------------

export async function handleCallback(
  chatId: string,
  callbackData: string,
  callbackQueryId: string,
): Promise<void> {
  ensureCharlieSchema();

  const parts = callbackData.split(':');
  if (parts.length < 3 || parts[0] !== 'charlie') return;

  const action = parts[1];
  const taskId = parts[2];

  switch (action) {
    case 'confirm':
      await handlePlanConfirmation(chatId, taskId, callbackQueryId);
      break;
    case 'modify':
      await reply(chatId, "Send me your modifications and I'll update the plan.");
      storeMessage(chatId, 'charlie', 'Awaiting plan modifications', 'followup', taskId);
      break;
    case 'cancel':
      await handlePlanCancellation(chatId, taskId);
      break;
    default:
      await reply(chatId, `Unknown action: ${action}`);
  }
}

async function handlePlanConfirmation(
  chatId: string,
  taskId: string,
  _callbackQueryId: string,
): Promise<void> {
  const workspaceId = 'default';

  // Load the plan
  const planRow = queryOne<{ plan_json: string; status: string }>(
    `SELECT plan_json, status FROM charlie_task_plans WHERE task_id = ?`,
    [taskId],
  );

  if (!planRow || planRow.status !== 'pending') {
    await reply(chatId, "This plan has already been processed or doesn't exist.");
    return;
  }

  const plan: TaskDecomposition = JSON.parse(planRow.plan_json);
  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);

  if (!task) {
    await reply(chatId, 'Task not found.');
    return;
  }

  // Mark plan as confirmed
  run(
    `UPDATE charlie_task_plans SET status = 'confirmed', updated_at = ? WHERE task_id = ?`,
    [new Date().toISOString(), taskId],
  );

  await reply(chatId, `\u{1F680} Executing plan for "${task.title}"...`);

  // Execute subtasks sequentially (respecting dependencies)
  const subtaskCount = plan.subtasks.length;

  if (subtaskCount === 0) {
    await reply(chatId, 'No subtasks to execute. Task complete.');
    return;
  }

  // For single subtask, delegate and EXECUTE the main task directly
  if (subtaskCount === 1) {
    try {
      const result = delegateTask({
        taskId,
        workspaceId,
      });

      await reply(
        chatId,
        `\u{1F4E4} Delegated to <b>${escapeHtml(result.selected.name)}</b>\n` +
          `Rationale: ${result.scoreReasons.slice(0, 3).join(', ')}`,
      );

      // ACTUALLY EXECUTE — the agent does the work via LLM
      executeAgentTask(taskId, result.selected.id, chatId).catch((err) => {
        audit('error', 'charlie_telegram', 'agent_execute_error', `Background execution failed for ${taskId}`, { taskId, error: err });
      });

      storeMessage(chatId, 'charlie', `Delegated to ${result.selected.name} — executing now`, 'followup', taskId);
    } catch (err) {
      await reply(chatId, `\u{26A0}\u{FE0F} Delegation failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
    return;
  }

  // Multiple subtasks — create child tasks, delegate, and EXECUTE each
  const completedIndices = new Set<number>();
  let delegatedCount = 0;

  for (let i = 0; i < subtaskCount; i++) {
    const subtask = plan.subtasks[i];

    // Check dependencies
    const depsReady = subtask.dependencies.every((dep) => completedIndices.has(dep));
    if (!depsReady) {
      audit('info', 'charlie_telegram', 'subtask_deps_skip', `Subtask ${i} deps not met, proceeding anyway`, { taskId });
    }

    // Create subtask as a child task
    const subtaskId = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO tasks (id, title, description, status, priority, workspace_id, business_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subtaskId, subtask.title, subtask.description, 'planning', task.priority, workspaceId, 'default', now, now],
    );

    // Intake and delegate
    intakeTask({ taskId: subtaskId, workspaceId, triageSummary: `Subtask of ${task.title}` });

    try {
      const result = delegateTask({ taskId: subtaskId, workspaceId });

      delegatedCount++;
      completedIndices.add(i);

      // Progress update
      await reply(
        chatId,
        formatProgressUpdate(task.title, delegatedCount, subtaskCount, result.selected.name),
      );

      // ACTUALLY EXECUTE each subtask
      await executeAgentTask(subtaskId, result.selected.id, chatId);
    } catch (err) {
      await reply(
        chatId,
        `\u{26A0}\u{FE0F} Failed subtask "${subtask.title}": ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  // Log decision
  logLeadDecision({
    workspaceId,
    taskId,
    decisionType: 'plan_executed',
    summary: `Plan executed: ${delegatedCount}/${subtaskCount} subtasks delegated via Telegram.`,
    actorType: 'lead',
  });

  run(
    `UPDATE charlie_task_plans SET status = 'executing', updated_at = ? WHERE task_id = ?`,
    [new Date().toISOString(), taskId],
  );

  storeMessage(chatId, 'charlie', `Plan executing: ${delegatedCount}/${subtaskCount} subtasks delegated`, 'followup', taskId);
}

async function handlePlanCancellation(chatId: string, taskId: string): Promise<void> {
  run(
    `UPDATE charlie_task_plans SET status = 'cancelled', updated_at = ? WHERE task_id = ?`,
    [new Date().toISOString(), taskId],
  );

  // Update task status
  run(
    `UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), taskId],
  );

  await reply(chatId, '\u{274C} Plan cancelled. Task closed.');
  storeMessage(chatId, 'charlie', 'Plan cancelled', 'followup', taskId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function reply(chatId: string, text: string): Promise<void> {
  await sendMessage(chatId, text);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Split a long message into chunks that fit within Telegram's limit, breaking at newlines where possible. */
function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a newline near the limit
    let breakIdx = remaining.lastIndexOf('\n', maxLen);
    if (breakIdx < maxLen * 0.5) {
      // No good newline — break at a space
      breakIdx = remaining.lastIndexOf(' ', maxLen);
    }
    if (breakIdx < maxLen * 0.3) {
      // No good break point — hard break
      breakIdx = maxLen;
    }

    chunks.push(remaining.slice(0, breakIdx));
    remaining = remaining.slice(breakIdx).replace(/^\n/, '');
  }

  return chunks;
}

async function dispatchTask(taskId: string): Promise<void> {
  // Internal dispatch — call the dispatch route programmatically
  try {
    const baseUrl = process.env.MISSION_CONTROL_URL || 'http://localhost:3001';
    await fetch(`${baseUrl}/api/tasks/${taskId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[Charlie] Failed to dispatch task ${taskId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Formatters (Charlie-specific)
// ---------------------------------------------------------------------------

function formatExecutionPlan(plan: TaskDecomposition, taskTitle: string, taskId: string): string {
  let msg = `\u{1F4CB} <b>Execution Plan</b>\n\n`;
  msg += `<b>Task:</b> ${escapeHtml(taskTitle)}\n`;
  msg += `<b>ID:</b> <code>${taskId.slice(0, 8)}</code>\n\n`;

  if (plan.subtasks.length === 0) {
    msg += `Single-step task — will delegate to best available agent.\n`;
  } else {
    msg += `<b>Subtasks (${plan.subtasks.length}):</b>\n`;
    for (let i = 0; i < plan.subtasks.length; i++) {
      const st = plan.subtasks[i];
      const complexity = st.estimatedComplexity === 'high' ? '\u{1F534}' : st.estimatedComplexity === 'medium' ? '\u{1F7E1}' : '\u{1F7E2}';
      const deps = st.dependencies.length > 0 ? ` (after #${st.dependencies.map((d) => d + 1).join(', #')})` : '';
      msg += `\n${i + 1}. ${complexity} <b>${escapeHtml(st.title)}</b>${deps}\n`;
      msg += `   ${escapeHtml(st.description.slice(0, 120))}${st.description.length > 120 ? '...' : ''}\n`;
      if (st.requiredSkills.length > 0) {
        msg += `   Skills: ${st.requiredSkills.join(', ')}\n`;
      }
    }
  }

  if (plan.executionPlan) {
    msg += `\n<b>Strategy:</b> ${escapeHtml(plan.executionPlan.slice(0, 200))}\n`;
  }

  if (plan.risks.length > 0) {
    msg += `\n<b>Risks:</b>\n`;
    for (const risk of plan.risks.slice(0, 3)) {
      msg += `\u{26A0}\u{FE0F} ${escapeHtml(risk)}\n`;
    }
  }

  if (plan.estimatedTotalTime && plan.estimatedTotalTime !== 'unknown') {
    msg += `\n\u{23F1} Estimated: ${escapeHtml(plan.estimatedTotalTime)}`;
  }

  return msg;
}

function formatProgressUpdate(
  taskTitle: string,
  completed: number,
  total: number,
  currentAgent: string,
): string {
  const progress = Math.round((completed / total) * 100);
  const bar = '\u{2588}'.repeat(Math.round(progress / 10)) + '\u{2591}'.repeat(10 - Math.round(progress / 10));

  return (
    `\u{1F4CA} <b>Progress:</b> ${escapeHtml(taskTitle)}\n` +
    `[${bar}] ${progress}% (${completed}/${total})\n` +
    `\u{1F916} Delegated to: <b>${escapeHtml(currentAgent)}</b>`
  );
}
