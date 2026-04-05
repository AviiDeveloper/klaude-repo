'use client';

import { create } from 'zustand';
import type {
  UnfinishedWorkData,
  RecentActivityData,
  ChecklistItem,
  ChecklistStatus,
  NextStepSuggestion,
} from './pulse/types';

interface PulseState {
  unfinished: UnfinishedWorkData | null;
  activity: RecentActivityData | null;
  checklist: Record<string, ChecklistItem[]>;
  nextSteps: NextStepSuggestion[];
  isLoading: boolean;
  error: string | null;

  loadAll: () => Promise<void>;
  updateChecklistItem: (id: string, status: ChecklistStatus, notes?: string) => Promise<void>;
}

function computeNextSteps(
  unfinished: UnfinishedWorkData | null,
  activity: RecentActivityData | null,
  checklist: Record<string, ChecklistItem[]>
): NextStepSuggestion[] {
  const suggestions: NextStepSuggestion[] = [];

  // Active task board items are always high priority
  if (unfinished?.taskBoard.activeUnchecked.length) {
    for (const item of unfinished.taskBoard.activeUnchecked) {
      suggestions.push({
        priority: 1,
        app: 'task-board',
        reason: `Active task: ${item.id || 'unnamed'}`,
        detail: item.title,
        dormantDays: 0,
      });
    }
  }

  // Dormant apps with TODOs
  if (activity && unfinished) {
    for (const app of activity.apps) {
      if (app.dormantDays < 2) continue;

      const todoCount = unfinished.code.todosByApp[app.app] || 0;
      const checklistItems = checklist[app.app] || [];
      const pendingChecklist = checklistItems.filter((i) => i.status === 'pending').length;
      const blockedChecklist = checklistItems.filter((i) => i.status === 'blocked').length;

      const parts: string[] = [];
      if (todoCount > 0) parts.push(`${todoCount} TODO${todoCount > 1 ? 's' : ''}`);
      if (pendingChecklist > 0) parts.push(`${pendingChecklist} pending launch items`);
      if (blockedChecklist > 0) parts.push(`${blockedChecklist} blocked items`);

      if (parts.length > 0 || app.dormantDays > 5) {
        suggestions.push({
          priority: app.dormantDays > 5 ? 2 : 3,
          app: app.app,
          reason: `Untouched for ${app.dormantDays} day${app.dormantDays !== 1 ? 's' : ''}`,
          detail: parts.length > 0 ? parts.join(', ') : 'No recent activity',
          dormantDays: app.dormantDays,
        });
      }
    }
  }

  // Stale branches
  if (unfinished?.git.branches.length) {
    const stale = unfinished.git.branches.filter((b) => b.staleDays > 3);
    if (stale.length > 0) {
      suggestions.push({
        priority: 4,
        app: 'git',
        reason: `${stale.length} stale branch${stale.length > 1 ? 'es' : ''} (>3 days old)`,
        detail: stale.map((b) => b.name).join(', '),
        dormantDays: 0,
      });
    }
  }

  // Changelog known issues
  if (unfinished?.code.changelogIssues.length) {
    suggestions.push({
      priority: 4,
      app: 'changelog',
      reason: `${unfinished.code.changelogIssues.length} known issue${unfinished.code.changelogIssues.length > 1 ? 's' : ''} in changelogs`,
      detail: unfinished.code.changelogIssues[0].issue,
      dormantDays: 0,
    });
  }

  // Sort by priority then dormant days
  suggestions.sort((a, b) => a.priority - b.priority || b.dormantDays - a.dormantDays);

  return suggestions.slice(0, 7);
}

export const usePulseStore = create<PulseState>((set, get) => ({
  unfinished: null,
  activity: null,
  checklist: {},
  nextSteps: [],
  isLoading: false,
  error: null,

  loadAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [unfinishedRes, activityRes, checklistRes] = await Promise.all([
        fetch('/api/pulse/unfinished'),
        fetch('/api/pulse/activity'),
        fetch('/api/pulse/checklist'),
      ]);

      const unfinished = unfinishedRes.ok ? ((await unfinishedRes.json()) as UnfinishedWorkData) : null;
      const activity = activityRes.ok ? ((await activityRes.json()) as RecentActivityData) : null;
      const checklistData = checklistRes.ok ? ((await checklistRes.json()) as { checklist: Record<string, ChecklistItem[]> }) : null;
      const checklist = checklistData?.checklist || {};

      const nextSteps = computeNextSteps(unfinished, activity, checklist);

      set({ unfinished, activity, checklist, nextSteps, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load pulse data' });
    }
  },

  updateChecklistItem: async (id: string, status: ChecklistStatus, notes?: string) => {
    // Optimistic update
    const { checklist } = get();
    const updated = { ...checklist };
    for (const app of Object.keys(updated)) {
      updated[app] = updated[app].map((item) =>
        item.id === id ? { ...item, status, notes: notes !== undefined ? notes : item.notes, updated_at: new Date().toISOString() } : item
      );
    }
    set({ checklist: updated });

    // Persist
    try {
      const body: Record<string, unknown> = { id, status };
      if (notes !== undefined) body.notes = notes;

      await fetch('/api/pulse/checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Recompute next steps
      const { unfinished, activity } = get();
      const nextSteps = computeNextSteps(unfinished, activity, updated);
      set({ nextSteps });
    } catch {
      // Revert on failure — reload all
      await get().loadAll();
    }
  },
}));
