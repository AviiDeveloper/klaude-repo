'use client';

import { useState } from 'react';
import { GitCommitHorizontal, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePulseStore } from '@/lib/pulse-store';

function DormancyDot({ days }: { days: number }) {
  if (days === 999) return <span className="w-2 h-2 rounded-full bg-mc-text-secondary/30" title="No recent commits" />;
  if (days <= 1) return <span className="w-2 h-2 rounded-full bg-mc-accent-green animate-pulse" title="Active today" />;
  if (days <= 4) return <span className="w-2 h-2 rounded-full bg-mc-accent-yellow" title={`${days} days ago`} />;
  return <span className="w-2 h-2 rounded-full bg-mc-accent-red" title={`${days} days ago`} />;
}

export function RecentActivity() {
  const { activity } = usePulseStore();
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  if (!activity) return null;

  const toggle = (app: string) => {
    const next = new Set(expandedApps);
    if (next.has(app)) next.delete(app); else next.add(app);
    setExpandedApps(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary mb-1">
        <Clock className="w-3.5 h-3.5" />
        Recent Activity ({activity.periodDays} days — {activity.totalCommits} commits)
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
        {activity.apps.map((app) => {
          const isExpanded = expandedApps.has(app.app);
          const days = Object.keys(app.commitsByDay).sort().reverse();

          return (
            <div key={app.app} className="rounded border border-mc-border bg-mc-bg-secondary">
              <button
                onClick={() => toggle(app.app)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-mc-bg-tertiary transition-colors"
              >
                <DormancyDot days={app.dormantDays} />
                <span className="font-medium text-mc-text">{app.app}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-mc-text-secondary">
                    {app.totalCommits > 0
                      ? `${app.totalCommits} commit${app.totalCommits > 1 ? 's' : ''}`
                      : 'dormant'}
                  </span>
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-mc-text-secondary" /> : <ChevronRight className="w-3 h-3 text-mc-text-secondary" />}
                </span>
              </button>

              {!isExpanded && app.lastTouchedDate && (
                <div className="px-3 pb-2 text-[10px] text-mc-text-secondary">
                  Last: {formatDistanceToNow(new Date(app.lastTouchedDate), { addSuffix: true })}
                </div>
              )}

              {isExpanded && (
                <div className="px-3 pb-3 border-t border-mc-border max-h-48 overflow-y-auto">
                  {days.length === 0 ? (
                    <div className="text-xs text-mc-text-secondary italic pt-2">No commits in the last {activity.periodDays} days</div>
                  ) : (
                    days.map((day) => (
                      <div key={day} className="pt-2">
                        <div className="text-[10px] text-mc-text-secondary font-medium mb-1">{day}</div>
                        {app.commitsByDay[day].map((commit) => (
                          <div key={commit.hash} className="flex items-start gap-1.5 text-[10px] mb-0.5">
                            <GitCommitHorizontal className="w-3 h-3 text-mc-text-secondary mt-0.5 flex-shrink-0" />
                            <span className="text-mc-text-secondary truncate">{commit.message}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
