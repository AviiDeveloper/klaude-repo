'use client';

import type { SalesStats } from '@/lib/types';

const DAILY_VISIT_TARGET = 8;
const REVENUE_PER_SALE = 350;
const MONTHLY_RECURRING = 25;

export function DailyTarget({ stats }: { stats: SalesStats | null }) {
  const visits = stats?.visits_today ?? 0;
  const progress = Math.min(visits / DAILY_VISIT_TARGET, 1);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference * (1 - progress);
  const pitchesToday = stats?.pitches_today ?? 0;
  const salesToday = stats?.sales_today ?? 0;

  return (
    <div className="flex items-center gap-5 py-4">
      {/* Progress ring */}
      <div className="relative flex-shrink-0">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke="#f0f0f0"
            strokeWidth="6"
          />
          <circle
            cx="48" cy="48" r="40"
            fill="none"
            stroke={progress >= 1 ? '#16a34a' : '#111111'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-primary leading-none">{visits}</span>
          <span className="text-2xs text-muted">/ {DAILY_VISIT_TARGET}</span>
        </div>
      </div>

      {/* Today's breakdown */}
      <div className="flex-1 space-y-1.5">
        <h3 className="text-sm font-semibold text-primary">
          {progress >= 1 ? 'Target hit!' : `${DAILY_VISIT_TARGET - visits} visits to go`}
        </h3>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Visits today</span>
            <span className="text-xs font-medium text-primary">{visits}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Pitches today</span>
            <span className="text-xs font-medium text-primary">{pitchesToday}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Sales today</span>
            <span className="text-xs font-medium text-status-sold">{salesToday}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommissionProjection({ stats }: { stats: SalesStats | null }) {
  const totalSold = stats?.sold_count ?? 0;
  const commission = stats?.total_commission ?? 0;
  const commissionRate = 0.10; // from user profile ideally

  // Projections
  const upfrontPerSale = REVENUE_PER_SALE * commissionRate;
  const recurringPerSale = MONTHLY_RECURRING * commissionRate;
  const monthlyRecurring = totalSold * recurringPerSale;

  if (totalSold === 0 && commission === 0) return null;

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xs font-semibold text-muted uppercase tracking-widest">Earnings</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-lg font-bold text-primary">&pound;{commission.toFixed(0)}</div>
          <div className="text-2xs text-muted">Total earned</div>
        </div>
        <div>
          <div className="text-lg font-bold text-primary">&pound;{upfrontPerSale.toFixed(0)}</div>
          <div className="text-2xs text-muted">Per sale</div>
        </div>
        <div>
          <div className="text-lg font-bold text-status-sold">&pound;{monthlyRecurring.toFixed(0)}</div>
          <div className="text-2xs text-muted">Monthly recurring</div>
        </div>
      </div>
    </div>
  );
}
