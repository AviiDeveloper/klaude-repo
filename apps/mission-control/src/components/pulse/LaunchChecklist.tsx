'use client';

import { Rocket, CheckCircle2, Circle, Ban } from 'lucide-react';
import { usePulseStore } from '@/lib/pulse-store';
import type { ChecklistStatus } from '@/lib/pulse/types';

const STATUS_CYCLE: Record<ChecklistStatus, ChecklistStatus> = {
  pending: 'done',
  done: 'blocked',
  blocked: 'pending',
};

const STATUS_ICON: Record<ChecklistStatus, typeof Circle> = {
  pending: Circle,
  done: CheckCircle2,
  blocked: Ban,
};

const STATUS_CLASS: Record<ChecklistStatus, string> = {
  pending: 'text-mc-accent-yellow hover:text-mc-accent-green',
  done: 'text-mc-accent-green hover:text-mc-accent-red',
  blocked: 'text-mc-accent-red hover:text-mc-accent-yellow',
};

const APP_ORDER = ['sales-dashboard', 'ios', 'admin-panel', 'mobile-api', 'runtime', 'mission-control'];

export function LaunchChecklist() {
  const { checklist, updateChecklistItem } = usePulseStore();

  const allItems = Object.values(checklist).flat();
  const doneCount = allItems.filter((i) => i.status === 'done').length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const sortedApps = APP_ORDER.filter((app) => checklist[app]?.length);
  // Include any apps not in ORDER
  for (const app of Object.keys(checklist)) {
    if (!sortedApps.includes(app)) sortedApps.push(app);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary">
        <Rocket className="w-3.5 h-3.5" />
        Launch Readiness
      </div>

      {/* Overall progress */}
      <div className="rounded border border-mc-border bg-mc-bg-secondary p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-mc-text">Overall Progress</span>
          <span className="text-sm text-mc-text-secondary">
            {doneCount}/{totalCount} ({pct}%)
          </span>
        </div>
        <div className="h-2 bg-mc-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-mc-accent-green rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Per-app checklists */}
      {sortedApps.map((app) => {
        const items = checklist[app] || [];
        const appDone = items.filter((i) => i.status === 'done').length;
        const appPct = items.length > 0 ? Math.round((appDone / items.length) * 100) : 0;

        return (
          <div key={app} className="rounded border border-mc-border bg-mc-bg-secondary">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-mc-border">
              <span className="text-xs font-medium text-mc-text">{app}</span>
              <span className="text-[10px] text-mc-text-secondary ml-auto">
                {appDone}/{items.length}
              </span>
              <div className="w-16 h-1.5 bg-mc-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-mc-accent-green rounded-full transition-all"
                  style={{ width: `${appPct}%` }}
                />
              </div>
            </div>
            <div className="divide-y divide-mc-border/50">
              {items.map((item) => {
                const Icon = STATUS_ICON[item.status];
                return (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                    <button
                      onClick={() => void updateChecklistItem(item.id, STATUS_CYCLE[item.status])}
                      className={`flex-shrink-0 transition-colors ${STATUS_CLASS[item.status]}`}
                      title={`Status: ${item.status} — click to change`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                    <span className={`text-xs flex-1 ${item.status === 'done' ? 'text-mc-text-secondary line-through' : 'text-mc-text'}`}>
                      {item.description}
                    </span>
                    {item.notes && (
                      <span className="text-[10px] text-mc-text-secondary max-w-[120px] truncate" title={item.notes}>
                        {item.notes}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
