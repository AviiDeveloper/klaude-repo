'use client';

import type { SalesStats } from '@/lib/types';
import { Users, Footprints, MessageCircle, BadgePoundSterling } from 'lucide-react';

const STAT_ITEMS = [
  { key: 'total_assigned', label: 'Assigned', icon: Users, color: 'text-sd-blue' },
  { key: 'visits_today', label: 'Visits', icon: Footprints, color: 'text-sd-amber' },
  { key: 'pitches_today', label: 'Pitched', icon: MessageCircle, color: 'text-purple-400' },
  { key: 'sold_count', label: 'Sold', icon: BadgePoundSterling, color: 'text-sd-green' },
] as const;

export function StatsBar({ stats }: { stats: SalesStats | null }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STAT_ITEMS.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="bg-sd-bg-card border border-sd-border rounded-xl p-3 text-center"
        >
          <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
          <div className="text-lg font-bold text-sd-text">
            {stats ? (stats as unknown as Record<string, number>)[key] ?? 0 : '\u2014'}
          </div>
          <div className="text-[10px] text-sd-text-muted uppercase tracking-wide">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function CommissionBanner({ stats }: { stats: SalesStats | null }) {
  if (!stats || stats.total_commission <= 0) return null;

  return (
    <div className="bg-gradient-to-r from-sd-green/10 to-sd-green/5 border border-sd-green/20 rounded-xl px-4 py-3 flex items-center justify-between">
      <span className="text-sd-text-muted text-sm">Total Commission</span>
      <span className="text-sd-green font-bold text-lg">
        \u00A3{stats.total_commission.toFixed(2)}
      </span>
    </div>
  );
}
