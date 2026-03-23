'use client';

import type { TalkingPoint, TalkingPointType } from '@/lib/types';
import {
  Globe, AlertTriangle, Star, ListChecks, BadgeCheck, Ban,
  Clock, Lightbulb, Quote, MonitorSmartphone, MousePointerClick,
  Images, TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'globe-off': Globe,
  'alert-triangle': AlertTriangle,
  star: Star,
  'list-checks': ListChecks,
  'badge-check': BadgeCheck,
  ban: Ban,
  clock: Clock,
  lightbulb: Lightbulb,
  quote: Quote,
  'monitor-smartphone': MonitorSmartphone,
  'mouse-pointer-click': MousePointerClick,
  images: Images,
  'trending-up': TrendingUp,
};

const TYPE_STYLES: Record<TalkingPointType, { border: string; bg: string; icon: string }> = {
  opportunity: { border: 'border-sd-amber/30', bg: 'bg-sd-amber/5', icon: 'text-sd-amber' },
  strength: { border: 'border-sd-green/30', bg: 'bg-sd-green/5', icon: 'text-sd-green' },
  warning: { border: 'border-sd-red/30', bg: 'bg-sd-red/5', icon: 'text-sd-red' },
  info: { border: 'border-sd-blue/30', bg: 'bg-sd-blue/5', icon: 'text-sd-blue' },
};

export function TalkingPoints({ points }: { points: TalkingPoint[] }) {
  if (points.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-sd-text-muted uppercase tracking-wider">
        Talking Points
      </h3>
      <div className="space-y-1.5">
        {points.map((point, i) => {
          const style = TYPE_STYLES[point.type];
          const IconComponent = ICON_MAP[point.icon] ?? Lightbulb;

          return (
            <div
              key={i}
              className={clsx(
                'flex items-start gap-3 px-3 py-2.5 rounded-lg border',
                style.border,
                style.bg,
              )}
            >
              <IconComponent className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', style.icon)} />
              <p className="text-sm text-sd-text leading-snug">{point.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
