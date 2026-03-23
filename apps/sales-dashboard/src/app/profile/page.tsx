'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SalesUser, SalesStats } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
import {
  LogOut, Loader2, TrendingUp, Target, Eye,
  MessageCircle, CheckCircle, XCircle, Clock,
} from 'lucide-react';

interface ActivityItem {
  action: string;
  notes: string | null;
  business_name: string | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  status_visited: { label: 'Visited', icon: Eye, color: 'text-status-visited' },
  status_pitched: { label: 'Pitched', icon: MessageCircle, color: 'text-status-pitched' },
  status_sold: { label: 'Sold', icon: CheckCircle, color: 'text-status-sold' },
  status_rejected: { label: 'Rejected', icon: XCircle, color: 'text-status-rejected' },
  status_new: { label: 'Reopened', icon: Clock, color: 'text-status-new' },
};

export default function ProfilePage() {
  const router = useRouter();
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
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
        <BottomNav />
      </div>
    );
  }

  const conversionRate = stats && stats.total_assigned > 0
    ? ((stats.sold_count / stats.total_assigned) * 100).toFixed(0)
    : '0';

  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* User header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-primary tracking-tight">{user?.name ?? 'Account'}</h1>
            <p className="text-xs text-muted mt-0.5">
              {user?.area_postcode ? `${user.area_postcode} area` : 'Sales representative'}
              {user?.commission_rate ? ` \u00B7 ${(user.commission_rate * 100).toFixed(0)}% commission` : ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-status-rejected transition-colors py-1.5 px-2.5 rounded-md border border-border"
          >
            {loggingOut ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Sign out
          </button>
        </div>

        {/* Performance summary */}
        <div className="mb-6">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-3">Performance</h4>
          <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
            <div className="bg-white py-4 text-center">
              <TrendingUp className="w-4 h-4 mx-auto mb-1 text-muted" />
              <div className="text-xl font-bold text-primary">{conversionRate}%</div>
              <div className="text-2xs text-muted">Conversion</div>
            </div>
            <div className="bg-white py-4 text-center">
              <Target className="w-4 h-4 mx-auto mb-1 text-muted" />
              <div className="text-xl font-bold text-primary">{stats?.sold_count ?? 0}</div>
              <div className="text-2xs text-muted">Total sales</div>
            </div>
            <div className="bg-white py-4 text-center">
              <CheckCircle className="w-4 h-4 mx-auto mb-1 text-status-sold" />
              <div className="text-xl font-bold text-status-sold">
                {stats?.total_commission ? `\u00A3${stats.total_commission.toFixed(0)}` : '\u00A30'}
              </div>
              <div className="text-2xs text-muted">Commission</div>
            </div>
          </div>
        </div>

        {/* Pipeline breakdown */}
        <div className="mb-6">
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-3">Pipeline</h4>
          <div className="space-y-0 divide-y divide-border-light">
            {[
              { label: 'New leads', value: stats?.new_count ?? 0 },
              { label: 'Visited', value: stats?.visited_count ?? 0 },
              { label: 'Pitched', value: stats?.pitched_count ?? 0 },
              { label: 'Sold', value: stats?.sold_count ?? 0 },
              { label: 'Rejected', value: stats?.rejected_count ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-secondary">{label}</span>
                <span className="text-sm font-medium text-primary">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h4 className="text-2xs font-semibold text-muted uppercase tracking-widest mb-3">Recent activity</h4>
          {activity.length === 0 ? (
            <p className="text-sm text-muted py-4">No activity yet. Start visiting leads!</p>
          ) : (
            <div className="space-y-0 divide-y divide-border-light">
              {activity.slice(0, 20).map((item, i) => {
                const config = ACTION_CONFIG[item.action] ?? { label: item.action, icon: Clock, color: 'text-muted' };
                const Icon = config.icon;
                const time = formatRelativeTime(item.created_at);

                return (
                  <div key={i} className="flex items-start gap-2.5 py-2.5">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary">
                        <span className="font-medium">{config.label}</span>
                        {item.business_name && (
                          <span className="text-secondary"> — {item.business_name}</span>
                        )}
                      </p>
                      <p className="text-2xs text-muted">{time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
