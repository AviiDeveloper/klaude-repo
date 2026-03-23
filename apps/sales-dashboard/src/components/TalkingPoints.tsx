'use client';

import type { TalkingPoint } from '@/lib/types';
import {
  Globe, AlertTriangle, Star, ListChecks, BadgeCheck, Ban,
  Clock, Lightbulb, Quote, MonitorSmartphone, MousePointerClick,
  Images, TrendingUp,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'globe-off': Globe, 'alert-triangle': AlertTriangle, star: Star,
  'list-checks': ListChecks, 'badge-check': BadgeCheck, ban: Ban,
  clock: Clock, lightbulb: Lightbulb, quote: Quote,
  'monitor-smartphone': MonitorSmartphone, 'mouse-pointer-click': MousePointerClick,
  images: Images, 'trending-up': TrendingUp,
};

function groupPoints(points: TalkingPoint[]) {
  const key = points.filter((p) => p.priority >= 5);
  const avoid = points.filter((p) => p.type === 'warning');
  const pitch = points.filter((p) => (p.type === 'strength' || p.type === 'opportunity') && p.priority < 5);
  const info = points.filter((p) => p.type === 'info');
  return { key, avoid, pitch, info };
}

export function TalkingPoints({ points }: { points: TalkingPoint[] }) {
  if (points.length === 0) return null;
  const { key, avoid, pitch, info } = groupPoints(points);

  return (
    <div className="divide-y divide-border-light">
      {/* Key points */}
      {key.length > 0 && (
        <div className="pb-4">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">Key points</h4>
          <ul className="space-y-1.5">
            {key.map((p, i) => {
              const Icon = ICON_MAP[p.icon] ?? Lightbulb;
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon className="w-3.5 h-3.5 mt-0.5 text-muted flex-shrink-0" />
                  <span className="text-sm font-medium text-primary">{p.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Avoid */}
      {avoid.length > 0 && (
        <div className="py-4 -mx-4 px-4 bg-red-50/60">
          <h4 className="text-2xs font-semibold text-status-rejected uppercase tracking-widest mb-1">Do not mention</h4>
          <p className="text-sm text-secondary">
            {avoid.map((p) => p.text.replace(/^Don't mention:\s*/i, '')).join(', ')}
          </p>
        </div>
      )}

      {/* Pitch points */}
      {pitch.length > 0 && (
        <div className="py-4">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">Pitch notes</h4>
          <ul className="space-y-1.5">
            {pitch.map((p, i) => {
              const Icon = ICON_MAP[p.icon] ?? Lightbulb;
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon className="w-3.5 h-3.5 mt-0.5 text-faint flex-shrink-0" />
                  <span className="text-sm text-secondary">{p.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Info */}
      {info.length > 0 && (
        <div className="pt-4">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-2">Quick info</h4>
          <ul className="space-y-1">
            {info.map((p, i) => (
              <li key={i} className="text-xs text-muted">{p.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
