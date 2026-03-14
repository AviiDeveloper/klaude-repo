/**
 * Charlie Monitor — Background monitoring and recovery loop
 *
 * Periodically checks active tasks for stale delegations, blocked work,
 * and at-risk tasks. Sends Telegram notifications and triggers recovery
 * when needed.
 */

import { queryAll, queryOne } from '@/lib/db';
import { assessProgress } from '@/lib/charlie-brain';
import { handleDelegationFailure } from '@/lib/lead-orchestrator';
import {
  sendMessage,
  isTelegramConfigured,
  getTelegramConfig,
  formatRecoveryNotification,
} from '@/lib/telegram';
import type { Task, TaskActivity } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonitoringTask {
  task_id: string;
  workspace_id: string;
  intake_status: string;
  delegation_id: string | null;
  delegation_status: string | null;
  delegation_timeout_ms: number | null;
  delegation_created_at: string | null;
  task_title: string;
  task_status: string;
  task_priority: string;
}

// ---------------------------------------------------------------------------
// Main check — called periodically or on task events
// ---------------------------------------------------------------------------

export async function runMonitoringCycle(): Promise<{
  checked: number;
  atRisk: number;
  blocked: number;
  recovered: number;
}> {
  const stats = { checked: 0, atRisk: 0, blocked: 0, recovered: 0 };

  // Find all tasks in monitoring/delegated state
  const monitoringTasks = queryAll<MonitoringTask>(
    `SELECT
       li.task_id,
       li.workspace_id,
       li.status as intake_status,
       d.id as delegation_id,
       d.status as delegation_status,
       d.timeout_ms as delegation_timeout_ms,
       d.created_at as delegation_created_at,
       t.title as task_title,
       t.status as task_status,
       t.priority as task_priority
     FROM lead_task_intake li
     JOIN tasks t ON t.id = li.task_id
     LEFT JOIN lead_task_delegations d ON d.task_id = li.task_id
       AND d.id = (
         SELECT id FROM lead_task_delegations
         WHERE task_id = li.task_id
         ORDER BY created_at DESC LIMIT 1
       )
     WHERE li.status IN ('delegated', 'monitoring')
     ORDER BY t.priority DESC, t.updated_at ASC`,
    [],
  );

  for (const mt of monitoringTasks) {
    stats.checked++;

    // Get recent activities for this task
    const activities = queryAll<TaskActivity>(
      `SELECT * FROM task_activities WHERE task_id = ? ORDER BY created_at DESC LIMIT 20`,
      [mt.task_id],
    );

    // Check for stale delegations
    if (mt.delegation_created_at && mt.delegation_timeout_ms) {
      const elapsed = Date.now() - new Date(mt.delegation_created_at).getTime();
      if (elapsed > mt.delegation_timeout_ms && mt.delegation_status === 'running') {
        stats.blocked++;
        console.log(`[Charlie Monitor] Stale delegation detected for task ${mt.task_id}`);

        // Trigger recovery
        if (mt.delegation_id) {
          try {
            const result = await handleDelegationFailure({
              workspaceId: mt.workspace_id,
              taskId: mt.task_id,
              delegationId: mt.delegation_id,
              failureReason: `Delegation timed out after ${Math.round(elapsed / 60000)} minutes`,
            });
            stats.recovered++;

            // Notify via Telegram
            await notifyIfConfigured(
              formatRecoveryNotification(result.action, result.rationale, mt.task_title),
            );
          } catch (err) {
            console.error(`[Charlie Monitor] Recovery failed for task ${mt.task_id}:`, err);
          }
        }
        continue;
      }
    }

    // LLM-based progress assessment
    const assessment = await assessProgress(
      { id: mt.task_id, title: mt.task_title, status: mt.task_status, priority: mt.task_priority } as Task,
      activities,
      mt.delegation_status || undefined,
    );

    if (assessment.status === 'blocked') {
      stats.blocked++;
      await notifyIfConfigured(
        `\u{1F6D1} <b>Task Blocked:</b> ${escapeHtml(mt.task_title)}\n${escapeHtml(assessment.summary)}`,
      );
    } else if (assessment.status === 'at_risk') {
      stats.atRisk++;
      await notifyIfConfigured(
        `\u{26A0}\u{FE0F} <b>At Risk:</b> ${escapeHtml(mt.task_title)}\n${escapeHtml(assessment.summary)}`,
      );
    }
  }

  console.log(
    `[Charlie Monitor] Cycle complete: ${stats.checked} checked, ${stats.atRisk} at risk, ${stats.blocked} blocked, ${stats.recovered} recovered`,
  );

  return stats;
}

// ---------------------------------------------------------------------------
// Check for stale delegations specifically
// ---------------------------------------------------------------------------

export function checkStaleDelegations(): Array<{
  taskId: string;
  taskTitle: string;
  delegationId: string;
  elapsedMinutes: number;
}> {
  const stale = queryAll<{
    task_id: string;
    task_title: string;
    delegation_id: string;
    timeout_ms: number;
    created_at: string;
  }>(
    `SELECT
       d.task_id,
       t.title as task_title,
       d.id as delegation_id,
       d.timeout_ms,
       d.created_at
     FROM lead_task_delegations d
     JOIN tasks t ON t.id = d.task_id
     WHERE d.status = 'running'
     ORDER BY d.created_at ASC`,
    [],
  );

  const now = Date.now();
  return stale
    .filter((d) => {
      const elapsed = now - new Date(d.created_at).getTime();
      return elapsed > d.timeout_ms;
    })
    .map((d) => ({
      taskId: d.task_id,
      taskTitle: d.task_title,
      delegationId: d.delegation_id,
      elapsedMinutes: Math.round((now - new Date(d.created_at).getTime()) / 60000),
    }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function notifyIfConfigured(text: string): Promise<void> {
  if (!isTelegramConfigured()) return;
  const cfg = getTelegramConfig();
  await sendMessage(cfg.default_chat_id, text);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
