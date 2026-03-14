/**
 * Agent Executor — REAL agent execution via LLM
 *
 * This is the missing piece. When a task is delegated to an agent,
 * this module actually executes the work using the agent's persona
 * and specialization context via OpenRouter LLM.
 *
 * Flow:
 * 1. Receives task + agent assignment
 * 2. Builds specialized prompt using agent's role, description, soul_md
 * 3. Calls OpenRouter LLM to do the actual work
 * 4. Logs activities throughout execution
 * 5. Creates deliverables from output
 * 6. Updates task status to done
 * 7. Sends result to Telegram
 */

import { v4 as uuidv4 } from 'uuid';
import { run, queryOne, queryAll } from '@/lib/db';
import { audit, auditLlmCall, auditTask } from '@/lib/audit-logger';
import { sendMessage } from '@/lib/telegram';
import { broadcast } from '@/lib/events';
import type { Agent, Task } from '@/lib/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4.1-mini';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const EXECUTION_TIMEOUT_MS = parseInt(process.env.AGENT_EXECUTION_TIMEOUT_MS || '60000', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecutionResult {
  success: boolean;
  output: string;
  deliverables: string[];
  durationMs: number;
  tokensUsed: { input: number; output: number };
}

// ---------------------------------------------------------------------------
// Core execution
// ---------------------------------------------------------------------------

/**
 * Execute a task using an agent's persona via LLM.
 * This is the real execution engine — it actually does the work.
 */
export async function executeAgentTask(
  taskId: string,
  agentId: string,
  chatId?: string,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Load task and agent
  const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [agentId]);

  if (!task) {
    audit('error', 'agent_execution', 'execute_failed', `Task not found: ${taskId}`);
    return { success: false, output: 'Task not found', deliverables: [], durationMs: 0, tokensUsed: { input: 0, output: 0 } };
  }
  if (!agent) {
    audit('error', 'agent_execution', 'execute_failed', `Agent not found: ${agentId}`, { taskId });
    return { success: false, output: 'Agent not found', deliverables: [], durationMs: 0, tokensUsed: { input: 0, output: 0 } };
  }

  auditTask('agent_execute_start', {
    taskId, title: task.title, agentId: agent.id, chatId,
    metadata: { agentName: agent.name, agentRole: agent.role },
  });

  // Update task status
  const now = new Date().toISOString();
  run(`UPDATE tasks SET status = 'in_progress', updated_at = ? WHERE id = ?`, [now, taskId]);
  run(`UPDATE agents SET status = 'working', updated_at = ? WHERE id = ?`, [now, agentId]);

  // Log activity: starting
  logActivity(taskId, agentId, 'updated', `${agent.name} is starting work on: ${task.title}`);

  // Notify via Telegram
  if (chatId) {
    await sendMessage(chatId, `🤖 <b>${escapeHtml(agent.name)}</b> is working on: <b>${escapeHtml(task.title)}</b>...`).catch(() => {});
  }

  // Build the agent-specific prompt
  const systemPrompt = buildAgentPrompt(agent, task);
  const userPrompt = buildTaskPrompt(task);

  // Execute via LLM
  const llmResult = await callLlm(systemPrompt, userPrompt, taskId, agentId);
  const durationMs = Date.now() - startTime;

  if (!llmResult.success) {
    // Execution failed
    audit('error', 'agent_execution', 'execute_failed', `Agent ${agent.name} failed on "${task.title}": ${llmResult.error}`, {
      taskId, agentId: agent.id, durationMs, error: llmResult.error,
    });

    run(`UPDATE tasks SET status = 'review', updated_at = ? WHERE id = ?`, [new Date().toISOString(), taskId]);
    run(`UPDATE agents SET status = 'standby', updated_at = ? WHERE id = ?`, [new Date().toISOString(), agentId]);
    run(`UPDATE lead_task_delegations SET status = 'failed', last_error = ?, updated_at = ? WHERE task_id = ? AND status IN ('delegated', 'running')`,
      [llmResult.error || 'LLM execution failed', new Date().toISOString(), taskId]);

    logActivity(taskId, agentId, 'updated', `${agent.name} encountered an error: ${llmResult.error}`);

    if (chatId) {
      await sendMessage(chatId, `⚠️ <b>${escapeHtml(agent.name)}</b> failed on: <b>${escapeHtml(task.title)}</b>\n\n${escapeHtml(String(llmResult.error).slice(0, 200))}`).catch(() => {});
    }

    return {
      success: false,
      output: llmResult.error || 'Execution failed',
      deliverables: [],
      durationMs,
      tokensUsed: { input: 0, output: 0 },
    };
  }

  // Execution succeeded
  const output = llmResult.output || 'No output';
  const deliverables = llmResult.deliverables || [];

  // Log activity: completed
  logActivity(taskId, agentId, 'completed', `${agent.name} completed: ${task.title} — ${output.slice(0, 100)}...`);

  // Create deliverables in DB
  for (const deliverable of deliverables) {
    try {
      run(
        `INSERT INTO task_deliverables (id, task_id, deliverable_type, title, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), taskId, 'text', deliverable.slice(0, 100), deliverable, new Date().toISOString()],
      );
    } catch { /* non-critical */ }
  }

  // Update task status to done
  const doneTime = new Date().toISOString();
  run(`UPDATE tasks SET status = 'done', updated_at = ? WHERE id = ?`, [doneTime, taskId]);
  run(`UPDATE agents SET status = 'standby', updated_at = ? WHERE id = ?`, [doneTime, agentId]);
  run(`UPDATE lead_task_delegations SET status = 'completed', updated_at = ? WHERE task_id = ? AND status IN ('delegated', 'running')`,
    [doneTime, taskId]);
  run(`UPDATE lead_task_intake SET status = 'closed', updated_at = ? WHERE task_id = ?`, [doneTime, taskId]);

  auditTask('agent_execute_complete', {
    taskId, title: task.title, agentId: agent.id, chatId,
    metadata: {
      agentName: agent.name,
      durationMs,
      outputLength: output.length,
      deliverableCount: deliverables.length,
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
    },
  });

  // Broadcast SSE event
  broadcast({
    type: 'agent_completed',
    payload: { taskId, sessionId: '', agentName: agent.name, summary: output.slice(0, 200) },
  });

  // Send result to Telegram
  if (chatId) {
    let msg = `✅ <b>${escapeHtml(agent.name)}</b> completed: <b>${escapeHtml(task.title)}</b>\n\n`;
    msg += escapeHtml(output);

    if (msg.length > 4000) {
      // Split long messages
      const chunks = splitMessage(msg, 4000);
      for (const chunk of chunks) {
        await sendMessage(chatId, chunk).catch(() => {});
      }
    } else {
      await sendMessage(chatId, msg).catch(() => {});
    }
  }

  return {
    success: true,
    output,
    deliverables,
    durationMs,
    tokensUsed: {
      input: llmResult.inputTokens || 0,
      output: llmResult.outputTokens || 0,
    },
  };
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

interface LlmResult {
  success: boolean;
  output?: string;
  deliverables?: string[];
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

async function callLlm(
  systemPrompt: string,
  userPrompt: string,
  taskId: string,
  agentId: string,
): Promise<LlmResult> {
  if (!OPENROUTER_API_KEY) {
    return { success: false, error: 'No API key configured' };
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'X-Title': 'klaude-agent-executor',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const durationMs = Date.now() - startTime;
      auditLlmCall('agent_execute', {
        taskId, model: OPENROUTER_MODEL, systemPrompt, userContent: userPrompt,
        response: null, durationMs, success: false,
        error: new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`),
      });
      return { success: false, error: `LLM API error: ${res.status}` };
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      const durationMs = Date.now() - startTime;
      auditLlmCall('agent_execute', {
        taskId, model: OPENROUTER_MODEL, systemPrompt, userContent: userPrompt,
        response: data, durationMs, success: false,
        error: new Error('Empty response'),
      });
      return { success: false, error: 'Empty LLM response' };
    }

    const parsed = JSON.parse(content) as {
      success?: boolean;
      output?: string;
      deliverables?: string[];
    };

    const durationMs = Date.now() - startTime;
    auditLlmCall('agent_execute', {
      taskId, model: OPENROUTER_MODEL, systemPrompt, userContent: userPrompt,
      response: parsed, durationMs, success: true,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    });

    return {
      success: parsed.success !== false,
      output: parsed.output || 'No output generated',
      deliverables: parsed.deliverables || [],
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    auditLlmCall('agent_execute', {
      taskId, model: OPENROUTER_MODEL, systemPrompt, userContent: userPrompt,
      response: null, durationMs, success: false, error: err,
    });
    const errorMsg = (err as Error).name === 'AbortError' ? 'Execution timed out' : String(err);
    return { success: false, error: errorMsg };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildAgentPrompt(agent: Agent, task: Task): string {
  const persona = agent.soul_md
    ? `\n\nYour persona & operating instructions:\n${agent.soul_md}`
    : '';

  return `You are ${agent.name}, a specialized AI agent.
Role: ${agent.role}
${agent.description ? `Specialty: ${agent.description}` : ''}
${persona}

You are executing a task assigned to you by the Lead orchestrator. Your job is to complete the task thoroughly and produce concrete, actionable output.

RULES:
- Provide REAL, substantive output — not placeholders or "I would do X"
- If the task asks for research, provide actual detailed findings
- If the task asks for writing, write the complete deliverable
- If the task asks for analysis, give thorough analysis with specifics
- If the task asks for code, write working code with explanations
- If the task asks for a plan, create a detailed actionable plan
- Structure your output clearly with headings, bullet points, or numbered lists
- Be thorough but concise — deliver real value

Return strict JSON:
{
  "success": true,
  "output": "your complete work product as a formatted string",
  "deliverables": ["list of key items you produced"]
}

If you cannot complete the task, return:
{
  "success": false,
  "output": "explanation of what went wrong and what's needed",
  "deliverables": []
}`;
}

function buildTaskPrompt(task: Task): string {
  let prompt = `TASK ASSIGNMENT\n\nTitle: ${task.title}\n`;
  if (task.description) {
    prompt += `Description: ${task.description}\n`;
  }
  prompt += `Priority: ${task.priority}\n`;
  if (task.due_date) {
    prompt += `Due: ${task.due_date}\n`;
  }
  prompt += `\nComplete this task now. Produce your complete output.`;
  return prompt;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logActivity(
  taskId: string,
  agentId: string,
  activityType: string,
  message: string,
): void {
  try {
    run(
      `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, agentId, activityType, message, new Date().toISOString()],
    );
    broadcast({ type: 'activity_logged', payload: { id: uuidv4(), task_id: taskId, agent_id: agentId, activity_type: activityType as 'spawned' | 'updated' | 'completed' | 'file_created' | 'status_changed' | 'test_passed' | 'test_failed', message, created_at: new Date().toISOString() } });
  } catch { /* non-critical */ }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let breakIdx = remaining.lastIndexOf('\n', maxLen);
    if (breakIdx < maxLen * 0.5) breakIdx = remaining.lastIndexOf(' ', maxLen);
    if (breakIdx < maxLen * 0.3) breakIdx = maxLen;
    chunks.push(remaining.slice(0, breakIdx));
    remaining = remaining.slice(breakIdx).replace(/^\n/, '');
  }
  return chunks;
}
