/**
 * Charlie Brain — LLM intelligence layer for the Master Orchestrator
 *
 * Uses OpenRouter (OpenAI-compatible API) to provide reasoning capabilities:
 * - Message intent classification
 * - Task decomposition
 * - Agent selection enhancement
 * - Progress assessment
 * - Recovery planning
 */

import type { Agent, Task, TaskActivity } from '@/lib/types';
import { auditLlmCall, audit } from '@/lib/audit-logger';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4.1-mini';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const LLM_TIMEOUT_MS = parseInt(process.env.CHARLIE_LLM_TIMEOUT_MS || '15000', 10);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageIntent =
  | 'new_task'
  | 'direct_action'
  | 'question'
  | 'status_check'
  | 'approval_response'
  | 'followup'
  | 'chitchat';

export type DirectActionType =
  | 'cancel_stuck'
  | 'cancel_all'
  | 'cancel_task'
  | 'retry_task'
  | 'clean_up'
  | 'list_agents';

export interface MessageAnalysis {
  intent: MessageIntent;
  confidence: number;
  extractedTask?: {
    title: string;
    description: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    tags: string[];
  };
  directAction?: {
    action: DirectActionType;
    targetTaskId?: string;
    filter?: string;
  };
  referencedTaskId?: string;
  response?: string;
}

export interface SubtaskPlan {
  title: string;
  description: string;
  requiredSkills: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependencies: number[]; // indices into the subtasks array
}

export interface TaskDecomposition {
  subtasks: SubtaskPlan[];
  executionPlan: string;
  risks: string[];
  estimatedTotalTime: string;
}

export interface AgentSelection {
  agentId: string;
  rationale: string;
  confidence: number;
  fallbackAgentId?: string;
}

export interface ProgressAssessment {
  status: 'on_track' | 'at_risk' | 'blocked';
  summary: string;
  suggestedActions: string[];
}

export interface RecoveryPlan {
  action: 'retry_same' | 'reassign' | 'escalate' | 'modify_task';
  rationale: string;
  modifiedInstructions?: string;
}

export interface TaskExecutionResult {
  success: boolean;
  output: string;
  deliverables?: string[];
}

interface ConversationMessage {
  role: 'user' | 'charlie';
  content: string;
}

interface WorkerScoreInput {
  agent: Agent;
  score: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Core LLM client
// ---------------------------------------------------------------------------

async function llmRequest(
  systemInstruction: string,
  userContent: string,
  callLabel = 'unknown',
  context?: { taskId?: string; chatId?: string },
): Promise<unknown> {
  if (!OPENROUTER_API_KEY) {
    audit('warn', 'charlie_brain', `llm.${callLabel}`, 'No API key configured — using fallback');
    return null;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'X-Title': 'klaude-charlie-orchestrator',
    };

    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const durationMs = Date.now() - startTime;
      auditLlmCall(callLabel, {
        taskId: context?.taskId,
        chatId: context?.chatId,
        model: OPENROUTER_MODEL,
        systemPrompt: systemInstruction,
        userContent,
        response: null,
        durationMs,
        success: false,
        error: new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`),
      });
      return null;
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      const durationMs = Date.now() - startTime;
      auditLlmCall(callLabel, {
        taskId: context?.taskId,
        chatId: context?.chatId,
        model: OPENROUTER_MODEL,
        systemPrompt: systemInstruction,
        userContent,
        response: data,
        durationMs,
        success: false,
        error: new Error('Empty response content'),
      });
      return null;
    }

    const parsed = JSON.parse(content);
    const durationMs = Date.now() - startTime;

    auditLlmCall(callLabel, {
      taskId: context?.taskId,
      chatId: context?.chatId,
      model: OPENROUTER_MODEL,
      systemPrompt: systemInstruction,
      userContent,
      response: parsed,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      durationMs,
      success: true,
    });

    return parsed;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    auditLlmCall(callLabel, {
      taskId: context?.taskId,
      chatId: context?.chatId,
      model: OPENROUTER_MODEL,
      systemPrompt: systemInstruction,
      userContent,
      response: null,
      durationMs,
      success: false,
      error: err,
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// analyzeIncomingMessage
// ---------------------------------------------------------------------------

export async function analyzeIncomingMessage(
  text: string,
  conversationHistory: ConversationMessage[] = [],
): Promise<MessageAnalysis> {
  const historyContext =
    conversationHistory.length > 0
      ? `\nRecent conversation:\n${conversationHistory
          .slice(-10)
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n')}`
      : '';

  const system = `You are Charlie, an intelligent task orchestrator. Analyze the user's message and classify its intent.

Return strict JSON with these keys:
- intent: one of "new_task", "direct_action", "question", "status_check", "approval_response", "followup", "chitchat"
- confidence: 0.0-1.0
- extractedTask: (only if intent=new_task) { title: string, description: string, priority: "low"|"normal"|"high"|"urgent", tags: string[] }
- directAction: (only if intent=direct_action) { action: string, targetTaskId?: string, filter?: string }
- referencedTaskId: (if the message references a specific task ID or short ID)
- response: (if intent is chitchat, question, or status_check) a helpful response from Charlie

Guidelines:
- "direct_action": user wants Charlie to perform a MANAGEMENT action on tasks — cancel, retry, clean up, list agents, etc. These are admin commands Charlie does directly WITHOUT creating tasks. Actions: "cancel_stuck" (cancel stuck/stale tasks), "cancel_all" (cancel everything), "cancel_task" (cancel specific task — provide targetTaskId), "retry_task" (retry a specific task), "clean_up" (remove old planning/inbox tasks), "list_agents" (show available agents)
- "new_task": user wants WORK done — ANY request that asks for deliverable output, including: build, create, fix, deploy, research, find, search, make, write, list, summarize, explain, tell me about, give me, analyze, compare. This includes knowledge tasks like "tell me 5 facts about X", "find me articles about Y", "list benefits of Z", "summarize X".
- "status_check": user asks about progress, status, why something isn't working, complaints about stuck/stale tasks, "troubleshoot", "what's happening", "why isn't this done", "no results"
- "approval_response": user is approving or denying something (yes/no/approve/deny in context of a pending approval)
- "followup": user is continuing a previous conversation — adding details, clarifying, or modifying an existing request
- "question": user is asking a question SPECIFICALLY about Charlie's capabilities, role, or how to use Charlie
- "chitchat": ONLY greetings, thanks, or casual small talk (hi, hello, thanks, bye)

CRITICAL RULES:
- "cancel", "retry", "clean up", "remove", "delete tasks", "list agents" → ALWAYS "direct_action"
- "find me", "search for", "build a", "create a website", "research", "tell me", "list", "give me", "summarize", "write", "explain" → ALWAYS "new_task"
- "what's the status", "troubleshoot", "why isn't this done" → "status_check"
- NEVER classify a request that asks for information, research, or content as "chitchat" or "question" — those are "new_task"
- "chitchat" is ONLY for greetings and pleasantries, nothing else

For new_task, extract a clear title and detailed description. Infer priority from urgency cues.`;

  const result = await llmRequest(system, `${text}${historyContext}`, 'analyze_intent');

  if (!result || typeof result !== 'object') {
    // Fallback: simple heuristic
    return fallbackAnalysis(text);
  }

  const r = result as Record<string, unknown>;
  return {
    intent: (r.intent as MessageIntent) || 'chitchat',
    confidence: (r.confidence as number) || 0.5,
    extractedTask: r.extractedTask as MessageAnalysis['extractedTask'],
    directAction: r.directAction as MessageAnalysis['directAction'],
    referencedTaskId: r.referencedTaskId as string | undefined,
    response: r.response as string | undefined,
  };
}

function fallbackAnalysis(text: string): MessageAnalysis {
  const lower = text.toLowerCase().trim();

  if (/^(hi|hello|hey|yo|sup|thanks|thank you|gm|good morning)/i.test(lower)) {
    return { intent: 'chitchat', confidence: 0.8, response: 'Hey! Send me a task and I\'ll get it done.' };
  }

  // Direct action detection — admin/management commands
  if (/\b(cancel\s+(all|stuck|stale|everything))\b/i.test(lower)) {
    const action = /cancel\s+all|cancel\s+everything/i.test(lower) ? 'cancel_all' : 'cancel_stuck';
    return { intent: 'direct_action', confidence: 0.9, directAction: { action: action as DirectActionType } };
  }
  if (/\b(clean\s*up|remove\s+(old|stale|stuck)|clear\s+tasks)\b/i.test(lower)) {
    return { intent: 'direct_action', confidence: 0.8, directAction: { action: 'clean_up' } };
  }
  if (/\b(retry|rerun|re-run)\b/i.test(lower)) {
    return { intent: 'direct_action', confidence: 0.7, directAction: { action: 'retry_task' } };
  }
  if (/\b(list\s+agents|show\s+agents|available\s+agents)\b/i.test(lower)) {
    return { intent: 'direct_action', confidence: 0.8, directAction: { action: 'list_agents' } };
  }

  if (/\b(status|progress|how.s it going|update|troubleshoot|stuck|stale|why)\b/i.test(lower)) {
    return { intent: 'status_check', confidence: 0.6, response: 'Let me check on that for you.' };
  }
  if (/\b(yes|no|approve|deny|approved|denied|go ahead|do it)\b/i.test(lower) && lower.length < 30) {
    return { intent: 'approval_response', confidence: 0.5 };
  }

  // Default: treat as new task
  return {
    intent: 'new_task',
    confidence: 0.4,
    extractedTask: {
      title: text.slice(0, 100),
      description: text,
      priority: 'normal',
      tags: [],
    },
  };
}

// ---------------------------------------------------------------------------
// decomposeTask
// ---------------------------------------------------------------------------

export async function decomposeTask(
  task: { title: string; description?: string },
  availableAgents: Agent[],
  workspaceContext?: string,
): Promise<TaskDecomposition> {
  const agentList = availableAgents
    .map((a) => `- ${a.name} (${a.role}): ${a.description || 'no description'}`)
    .join('\n');

  const system = `You are Charlie, a master orchestrator. Break down a task into subtasks that can be delegated to specialized agents.

Available agents:
${agentList}

${workspaceContext ? `Workspace context: ${workspaceContext}` : ''}

Return strict JSON:
{
  "subtasks": [
    {
      "title": "string",
      "description": "detailed instructions for the agent",
      "requiredSkills": ["skill1", "skill2"],
      "estimatedComplexity": "low" | "medium" | "high",
      "dependencies": []  // indices of subtasks that must complete first
    }
  ],
  "executionPlan": "human-readable execution sequence",
  "risks": ["risk1", "risk2"],
  "estimatedTotalTime": "e.g. 30 minutes"
}

Rules:
- Create the minimum number of subtasks needed
- Each subtask should map to a single agent's work
- Order dependencies correctly (earlier subtasks have lower indices)
- Keep descriptions actionable and specific`;

  const userContent = `Task: ${task.title}\n${task.description ? `Description: ${task.description}` : ''}`;
  const result = await llmRequest(system, userContent, 'decompose_task');

  if (!result || typeof result !== 'object') {
    // Fallback: single subtask
    return {
      subtasks: [
        {
          title: task.title,
          description: task.description || task.title,
          requiredSkills: [],
          estimatedComplexity: 'medium',
          dependencies: [],
        },
      ],
      executionPlan: `Single-step: complete "${task.title}"`,
      risks: [],
      estimatedTotalTime: 'unknown',
    };
  }

  const r = result as Record<string, unknown>;
  return {
    subtasks: (r.subtasks as SubtaskPlan[]) || [],
    executionPlan: (r.executionPlan as string) || '',
    risks: (r.risks as string[]) || [],
    estimatedTotalTime: (r.estimatedTotalTime as string) || 'unknown',
  };
}

// ---------------------------------------------------------------------------
// selectAgentForSubtask
// ---------------------------------------------------------------------------

export async function selectAgentForSubtask(
  subtask: SubtaskPlan,
  scoredAgents: WorkerScoreInput[],
): Promise<AgentSelection> {
  if (scoredAgents.length === 0) {
    return { agentId: '', rationale: 'No agents available', confidence: 0 };
  }

  // If only one agent, skip LLM
  if (scoredAgents.length === 1) {
    return {
      agentId: scoredAgents[0].agent.id,
      rationale: `Only available agent: ${scoredAgents[0].agent.name}`,
      confidence: 0.9,
    };
  }

  const agentDescriptions = scoredAgents
    .slice(0, 10) // top 10
    .map(
      (s) =>
        `- ${s.agent.name} (${s.agent.role}): score=${s.score}, reasons=[${s.reasons.join(', ')}], description="${s.agent.description || 'none'}"`,
    )
    .join('\n');

  const system = `You are Charlie, selecting the best agent for a subtask. Consider both the algorithmic score and qualitative fit.

Return strict JSON:
{
  "agentId": "selected agent's ID",
  "rationale": "why this agent is the best fit",
  "confidence": 0.0-1.0,
  "fallbackAgentId": "second-best agent ID (optional)"
}`;

  const userContent = `Subtask: ${subtask.title}
Description: ${subtask.description}
Required skills: ${subtask.requiredSkills.join(', ') || 'general'}

Candidate agents (pre-scored):
${agentDescriptions}

Agent IDs for reference:
${scoredAgents.slice(0, 10).map((s) => `${s.agent.name}: ${s.agent.id}`).join('\n')}`;

  const result = await llmRequest(system, userContent, 'select_agent');

  if (!result || typeof result !== 'object') {
    // Fallback: use highest scored agent
    const best = scoredAgents[0];
    return {
      agentId: best.agent.id,
      rationale: `Highest scored: ${best.agent.name} (${best.score})`,
      confidence: 0.7,
      fallbackAgentId: scoredAgents[1]?.agent.id,
    };
  }

  const r = result as Record<string, unknown>;
  return {
    agentId: (r.agentId as string) || scoredAgents[0].agent.id,
    rationale: (r.rationale as string) || 'LLM selection',
    confidence: (r.confidence as number) || 0.7,
    fallbackAgentId: r.fallbackAgentId as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// assessProgress
// ---------------------------------------------------------------------------

export async function assessProgress(
  task: Task,
  activities: TaskActivity[],
  delegationStatus?: string,
): Promise<ProgressAssessment> {
  const recentActivities = activities
    .slice(-15)
    .map((a) => `[${a.created_at}] ${a.activity_type}: ${a.message}`)
    .join('\n');

  const system = `You are Charlie, assessing task progress. Determine if a task is on track, at risk, or blocked.

Return strict JSON:
{
  "status": "on_track" | "at_risk" | "blocked",
  "summary": "brief assessment",
  "suggestedActions": ["action1", "action2"]
}

Signals:
- No activity for a long time → at_risk
- Errors or failures in activities → blocked
- Steady progress with completions → on_track
- Delegation status "failed" → blocked`;

  const userContent = `Task: ${task.title} (status: ${task.status}, priority: ${task.priority})
Delegation status: ${delegationStatus || 'unknown'}

Recent activities:
${recentActivities || 'No activities recorded'}`;

  const result = await llmRequest(system, userContent, 'assess_progress', { taskId: task.id });

  if (!result || typeof result !== 'object') {
    return {
      status: delegationStatus === 'failed' ? 'blocked' : 'on_track',
      summary: 'Unable to assess — LLM unavailable',
      suggestedActions: [],
    };
  }

  const r = result as Record<string, unknown>;
  return {
    status: (r.status as ProgressAssessment['status']) || 'on_track',
    summary: (r.summary as string) || '',
    suggestedActions: (r.suggestedActions as string[]) || [],
  };
}

// ---------------------------------------------------------------------------
// generateRecoveryPlan
// ---------------------------------------------------------------------------

export async function generateRecoveryPlan(
  task: Task,
  failureReason: string,
  evalSummary?: string,
): Promise<RecoveryPlan> {
  const system = `You are Charlie, deciding how to recover from a failed task delegation.

Return strict JSON:
{
  "action": "retry_same" | "reassign" | "escalate" | "modify_task",
  "rationale": "why this recovery action",
  "modifiedInstructions": "new instructions if action is modify_task (optional)"
}

Guidelines:
- retry_same: transient error, same agent can try again
- reassign: agent is not suitable, try a different one
- escalate: needs human operator input
- modify_task: task requirements need adjustment`;

  const userContent = `Task: ${task.title}
Failure reason: ${failureReason}
${evalSummary ? `Evaluation: ${evalSummary}` : ''}`;

  const result = await llmRequest(system, userContent, 'recovery_plan', { taskId: task.id });

  if (!result || typeof result !== 'object') {
    return {
      action: 'escalate',
      rationale: 'Unable to determine recovery — escalating to operator',
    };
  }

  const r = result as Record<string, unknown>;
  return {
    action: (r.action as RecoveryPlan['action']) || 'escalate',
    rationale: (r.rationale as string) || 'LLM recovery plan',
    modifiedInstructions: r.modifiedInstructions as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// canSelfExecute — determines if Charlie can handle a task directly via LLM
// ---------------------------------------------------------------------------

export function canSelfExecute(task: { title: string; description?: string }): boolean {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();

  // Tasks Charlie's LLM CAN do directly (knowledge/writing tasks)
  const selfExecutable = [
    /\b(find|search|look up|research|discover)\b.*\b(article|news|info|information|data|fact)\b/,
    /\b(write|draft|compose|create)\b.*\b(email|message|text|summary|report|list)\b/,
    /\b(summarize|explain|describe|analyze|compare)\b/,
    /\b(list|give me|tell me|what are|how to|how do)\b/,
    /\b(translate|convert|format)\b/,
    /\b(brainstorm|suggest|recommend|advise)\b/,
    /\b(news|article|headline)\b/,
  ];

  // Tasks that NEED agent execution (code, files, deployments)
  const needsAgent = [
    /\b(build|deploy|install|configure|setup|run|execute|compile)\b/,
    /\b(code|script|program|function|api|endpoint|database|server)\b/,
    /\b(file|folder|directory|git|commit|push|pull)\b/,
    /\b(test|debug|fix bug|patch)\b/,
  ];

  const matchesSelf = selfExecutable.some((r) => r.test(text));
  const matchesAgent = needsAgent.some((r) => r.test(text));

  // If it matches self-executable and NOT agent-required, do it directly
  return matchesSelf && !matchesAgent;
}

// ---------------------------------------------------------------------------
// executeTaskDirectly — Charlie completes a task using LLM
// ---------------------------------------------------------------------------

export async function executeTaskDirectly(
  task: { title: string; description?: string },
): Promise<TaskExecutionResult> {
  const system = `You are Charlie, an AI assistant completing a task directly. Provide a thorough, useful response.

IMPORTANT RULES:
- Give concrete, actionable results — not placeholder text
- If asked to find articles/news, provide real topic descriptions and summaries based on your knowledge
- If asked to write something, write it completely
- If asked to research, provide detailed findings
- Format your response clearly with sections, bullet points, or numbered lists as appropriate
- Be thorough but concise — deliver real value

Return strict JSON:
{
  "success": true,
  "output": "your complete response/deliverable as a formatted string",
  "deliverables": ["list of key items produced"]
}`;

  const userContent = `Complete this task:\n\nTitle: ${task.title}\n${task.description ? `Description: ${task.description}` : ''}`;

  const result = await llmRequest(system, userContent, 'execute_task');

  if (!result || typeof result !== 'object') {
    return {
      success: false,
      output: 'Failed to execute task — LLM unavailable.',
    };
  }

  const r = result as Record<string, unknown>;
  return {
    success: (r.success as boolean) ?? true,
    output: (r.output as string) || 'No output generated.',
    deliverables: (r.deliverables as string[]) || [],
  };
}
