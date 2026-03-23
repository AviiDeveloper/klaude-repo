'use client';

import type { SalesStats } from '@/lib/types';

export function StatsBar({ stats }: { stats: SalesStats | null }) {
  const items = [
    { label: 'Assigned', value: stats?.total_assigned ?? 0 },
    { label: 'Visited', value: stats?.visits_today ?? 0 },
    { label: 'Pitched', value: stats?.pitches_today ?? 0 },
    { label: 'Sold', value: stats?.sold_count ?? 0 },
  ];

  return (
    <div className="grid grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-white py-3 text-center">
          <div className="text-lg font-semibold text-primary">{stats ? value : '\u2014'}</div>
          <div className="text-2xs text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function CommissionBanner({ stats }: { stats: SalesStats | null }) {
  if (!stats || stats.total_commission <= 0) return null;

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg">
      <span className="text-xs text-muted">Commission earned</span>
      <span className="text-sm font-semibold text-status-sold">
        \u00A3{stats.total_commission.toFixed(2)}
      </span>
    </div>
  );
}
