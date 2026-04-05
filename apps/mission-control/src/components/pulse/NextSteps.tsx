'use client';

import { Lightbulb, ArrowRight } from 'lucide-react';
import { usePulseStore } from '@/lib/pulse-store';

const PRIORITY_COLORS: Record<number, string> = {
  1: 'border-l-mc-accent-red',
  2: 'border-l-mc-accent-yellow',
  3: 'border-l-mc-accent',
  4: 'border-l-mc-text-secondary',
};

const APP_COLORS: Record<string, string> = {
  'sales-dashboard': 'bg-mc-accent/15 text-mc-accent',
  'ios': 'bg-mc-accent-purple/15 text-mc-accent-purple',
  'mission-control': 'bg-mc-accent-cyan/15 text-mc-accent-cyan',
  'admin-panel': 'bg-mc-accent-yellow/15 text-mc-accent-yellow',
  'mobile-api': 'bg-mc-accent-pink/15 text-mc-accent-pink',
  'runtime': 'bg-mc-accent-green/15 text-mc-accent-green',
  'task-board': 'bg-mc-accent-red/15 text-mc-accent-red',
  'git': 'bg-mc-bg-tertiary text-mc-text-secondary',
  'changelog': 'bg-mc-bg-tertiary text-mc-text-secondary',
};

export function NextSteps() {
  const { nextSteps } = usePulseStore();

  if (nextSteps.length === 0) {
    return (
      <div className="rounded border border-mc-accent-green/30 bg-mc-accent-green/5 p-4">
        <div className="flex items-center gap-2 text-mc-accent-green">
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm font-medium">All clear — nothing urgent needs attention.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary mb-1">
        <Lightbulb className="w-3.5 h-3.5" />
        Suggested Next Steps
      </div>
      {nextSteps.map((step, i) => (
        <div
          key={i}
          className={`rounded border border-mc-border bg-mc-bg-secondary p-3 border-l-4 ${PRIORITY_COLORS[step.priority] || PRIORITY_COLORS[4]}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${APP_COLORS[step.app] || APP_COLORS.git}`}>
                {step.app}
              </span>
              <span className="text-sm text-mc-text font-medium">{step.reason}</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-mc-text-secondary flex-shrink-0 mt-0.5" />
          </div>
          {step.detail && (
            <div className="text-xs text-mc-text-secondary mt-1 ml-0.5">{step.detail}</div>
          )}
        </div>
      ))}
    </div>
  );
}
