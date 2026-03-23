'use client';

import { useEffect, useState } from 'react';
import type { SalesUser, SalesStats } from '@/lib/types';
import {
  LogOut, Loader2, Eye,
  MessageCircle, CheckCircle, XCircle, Clock,
} from 'lucide-react';

interface ActivityItem {
  action: string;
  notes: string | null;
  business_name: string | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  status_visited: { label: 'Visited', icon: Eye, color: 'text-amber-500' },
  status_pitched: { label: 'Pitched', icon: MessageCircle, color: 'text-violet-500' },
  status_sold: { label: 'Sold', icon: CheckCircle, color: 'text-emerald-500' },
  status_rejected: { label: 'Rejected', icon: XCircle, color: 'text-slate-400' },
  status_new: { label: 'Reopened', icon: Clock, color: 'text-blue-500' },
};

export default function ProfilePage() {
  const [user, setUser] = useState<SalesUser | null>(null);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/activity').then((r) => r.json()),
    ]).then(([userRes, statsRes, activityRes]) => {
      setUser(userRes.data ?? null);
      setStats(statsRes.data ?? null);
      setActivity(activityRes.data ?? []);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-16">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  const conversionRate = stats && stats.total_assigned > 0
    ? ((stats.sold_count / stats.total_assigned) * 100).toFixed(0)
    : '0';

  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <h1 className="text-[15px] font-semibold text-slate-900">Account</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Your profile and performance</p>
      </div>
      <div className="px-6 md:px-8 py-5">
        {/* User header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-primary tracking-tight">{user?.name ?? 'Account'}</h1>
            <p className="text-[11px] text-muted mt-0.5">
              {user?.area_postcode ? `${user.area_postcode} area` : 'Contractor'}
              {user?.commission_rate ? ` · ${(user.commission_rate * 100).toFixed(0)}% commission` : ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-[11px] text-muted hover:text-red-500 transition-colors py-1.5 px-3 rounded-lg border border-slate-200"
          >
            {loggingOut ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Sign out
          </button>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-xl overflow-hidden mb-6">
          <MetricCell label="Conversion" value={`${conversionRate}%`} />
          <MetricCell label="Sales" value={String(stats?.sold_count ?? 0)} />
          <MetricCell label="Earned" value={`£${(stats?.total_commission ?? 0).toFixed(0)}`} highlight />
        </div>

        {/* Pipeline breakdown */}
        <div className="mb-6">
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em] mb-3">Your Pipeline</h4>
          <div className="space-y-0">
            {[
              { label: 'New', value: stats?.new_count ?? 0, dot: 'bg-blue-500' },
              { label: 'Visited', value: stats?.visited_count ?? 0, dot: 'bg-amber-500' },
              { label: 'Pitched', value: stats?.pitched_count ?? 0, dot: 'bg-violet-500' },
              { label: 'Sold', value: stats?.sold_count ?? 0, dot: 'bg-emerald-500' },
              { label: 'Rejected', value: stats?.rejected_count ?? 0, dot: 'bg-slate-300' },
            ].map(({ label, value, dot }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className="text-[13px] text-secondary">{label}</span>
                </div>
                <span className="text-[13px] font-semibold text-primary tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h4 className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em] mb-3">Recent Activity</h4>
          {activity.length === 0 ? (
            <p className="text-[13px] text-muted py-6 text-center">No activity yet</p>
          ) : (
            <div className="space-y-0">
              {activity.slice(0, 20).map((item, i) => {
                const config = ACTION_CONFIG[item.action] ?? { label: item.action, icon: Clock, color: 'text-muted' };
                const Icon = config.icon;
                return (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-primary leading-snug">
                        <span className="font-medium">{config.label}</span>
                        {item.business_name && (
                          <span className="text-secondary"> — {item.business_name}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 tabular-nums">{formatRelativeTime(item.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MetricCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white py-4 text-center">
      <div className={`text-xl font-semibold tabular-nums ${highlight ? 'text-emerald-600' : 'text-primary'}`}>{value}</div>
      <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
