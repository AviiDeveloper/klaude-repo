'use client';

import { useEffect, useState } from 'react';
import { Wallet, Building2, Download, Clock, CheckCircle2, AlertCircle, ChevronRight, Plus, FileText, TrendingUp, Target, BarChart3, Zap, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsData {
  total_commission?: number;
  sold_count?: number;
  visited_count?: number;
  pitched_count?: number;
  total_leads?: number;
  visits_this_week?: number;
  sales_this_week?: number;
}

export default function PayoutsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => setStats(d.data ?? null));
  }, []);

  const totalSold = stats?.sold_count ?? 0;
  const totalEarned = totalSold * 50;
  const totalVisited = stats?.visited_count ?? 0;
  const totalPitched = stats?.pitched_count ?? 0;
  const totalLeads = stats?.total_leads ?? 0;
  const salesThisWeek = stats?.sales_this_week ?? 0;
  const visitsThisWeek = stats?.visits_this_week ?? 0;

  // Derived analytics
  const closeRate = totalPitched > 0 ? ((totalSold / totalPitched) * 100) : 0;
  const visitToSaleRate = totalVisited > 0 ? ((totalSold / totalVisited) * 100) : 0;
  const avgEarningsPerVisit = totalVisited > 0 ? (totalEarned / totalVisited) : 0;
  const projectedMonthly = salesThisWeek > 0 ? salesThisWeek * 50 * 4.33 : totalSold > 0 ? (totalSold * 50 / Math.max(1, 4)) * 4.33 : 0;

  // Simulated weekly data for chart (in production this comes from API)
  const weeklyData = [
    { label: 'Mon', visits: 3, sales: 0, earned: 0 },
    { label: 'Tue', visits: 5, sales: 1, earned: 50 },
    { label: 'Wed', visits: 4, sales: 0, earned: 0 },
    { label: 'Thu', visits: 6, sales: 2, earned: 100 },
    { label: 'Fri', visits: 2, sales: 0, earned: 0 },
    { label: 'Sat', visits: 0, sales: 0, earned: 0 },
    { label: 'Sun', visits: 0, sales: 0, earned: 0 },
  ];
  const maxVisits = Math.max(...weeklyData.map(d => d.visits), 1);
  const weekTotal = weeklyData.reduce((s, d) => s + d.earned, 0);

  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <h1 className="text-[15px] font-semibold text-slate-900">Payouts & Analytics</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Commission tracking, performance metrics, and payments</p>
      </div>

      <div className="px-6 md:px-8 py-6 max-w-4xl">
        {/* Top row: Balance + Projection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Balance card */}
          <div className="bg-slate-900 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Available balance</span>
              <Wallet className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-3xl font-bold text-white tabular-nums mb-0.5">
              {'\u00A3'}{totalEarned.toFixed(2)}
            </div>
            <div className="text-[12px] text-slate-500">{totalSold} sale{totalSold !== 1 ? 's' : ''} at {'\u00A3'}50 each</div>
            <div className="mt-4 flex gap-3">
              <button className="flex-1 bg-white text-slate-900 text-[12px] font-medium py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors">
                <Building2 className="w-3.5 h-3.5" />
                Withdraw
              </button>
              <button className="flex-1 bg-white/10 text-white text-[12px] font-medium py-2.5 rounded-xl flex items-center justify-center gap-1.5 hover:bg-white/20 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Projected earnings */}
          <div className="border border-slate-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Projected this month</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums mb-0.5">
              {'\u00A3'}{projectedMonthly.toFixed(0)}
            </div>
            <div className="text-[12px] text-slate-400">Based on current weekly pace</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                <div className="text-[16px] font-bold text-slate-900 tabular-nums">{salesThisWeek}</div>
                <div className="text-[10px] text-slate-400">Sales this week</div>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                <div className="text-[16px] font-bold text-slate-900 tabular-nums">{'\u00A3'}{(salesThisWeek * 50).toFixed(0)}</div>
                <div className="text-[10px] text-slate-400">Earned this week</div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 rounded-xl overflow-hidden mb-6">
          <MetricCard label="Close rate" value={`${closeRate.toFixed(0)}%`} sublabel={`${totalSold}/${totalPitched} pitched`} trend={closeRate >= 20 ? 'up' : 'neutral'} />
          <MetricCard label="Visit → Sale" value={`${visitToSaleRate.toFixed(0)}%`} sublabel={`${totalSold}/${totalVisited} visited`} trend={visitToSaleRate >= 10 ? 'up' : 'neutral'} />
          <MetricCard label="Avg per visit" value={`\u00A3${avgEarningsPerVisit.toFixed(0)}`} sublabel="earnings per visit" trend={avgEarningsPerVisit >= 5 ? 'up' : 'neutral'} />
          <MetricCard label="Total leads" value={String(totalLeads)} sublabel={`${totalLeads - totalVisited} unvisited`} trend="neutral" />
        </div>

        {/* Weekly activity chart */}
        <Section title="This Week's Activity">
          <div className="px-4 py-4">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <span className="text-[20px] font-bold text-slate-900 tabular-nums">{'\u00A3'}{weekTotal}</span>
                <span className="text-[12px] text-slate-400 ml-2">earned this week</span>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /> Visits</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Sales</span>
              </div>
            </div>
            <div className="flex items-end gap-2 h-32">
              {weeklyData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24 gap-0.5">
                    {/* Visit bar */}
                    <div
                      className="w-full max-w-[28px] bg-slate-200 rounded-t-md transition-all duration-500"
                      style={{ height: `${(d.visits / maxVisits) * 100}%`, minHeight: d.visits > 0 ? '4px' : '0' }}
                    />
                    {/* Sale indicator */}
                    {d.sales > 0 && (
                      <div className="w-full max-w-[28px] bg-emerald-500 rounded-md" style={{ height: '4px' }} />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{d.label}</span>
                  {d.earned > 0 && (
                    <span className="text-[9px] font-semibold text-emerald-600">{'\u00A3'}{d.earned}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Conversion funnel */}
        <Section title="Conversion Funnel">
          <div className="px-4 py-4">
            <div className="space-y-2.5">
              <FunnelRow label="Assigned" count={totalLeads} total={totalLeads} color="bg-slate-400" />
              <FunnelRow label="Visited" count={totalVisited} total={totalLeads} color="bg-blue-400" />
              <FunnelRow label="Pitched" count={totalPitched} total={totalLeads} color="bg-amber-400" />
              <FunnelRow label="Sold" count={totalSold} total={totalLeads} color="bg-emerald-500" />
            </div>
            {totalLeads > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Overall conversion</span>
                <span className="text-[13px] font-semibold text-slate-900">{((totalSold / totalLeads) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </Section>

        {/* Two column: Payment method + Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Section title="Payment Method">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-300" />
                  <div>
                    <p className="text-[13px] text-slate-400">No payment method</p>
                    <p className="text-[11px] text-slate-300">Add bank details to withdraw</p>
                  </div>
                </div>
                <button className="flex items-center gap-1 text-[11px] font-medium text-slate-900 bg-slate-50 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
          </Section>

          <Section title="Payout Schedule">
            <InfoRow icon={Clock} title="Weekly" desc="Processed every Friday" />
            <InfoRow icon={Building2} title="Minimum" desc={'\u00A3' + '50 (1 sale)'} />
            <InfoRow icon={CheckCircle2} title="Speed" desc="1-3 business days" />
          </Section>
        </div>

        {/* Payment history */}
        <Section title="Payment History">
          {totalSold > 0 ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: Math.min(totalSold, 10) }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${i < 2 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                      {i < 2 ? <Clock className="w-3 h-3 text-amber-500" /> : <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-slate-900">Sale #{totalSold - i}</div>
                      <div className="text-[10px] text-slate-400">{i < 2 ? 'Pending — processing Friday' : 'Paid — 14 Mar 2026'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-900 tabular-nums">{'\u00A3'}50.00</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${i < 2 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {i < 2 ? 'Pending' : 'Paid'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Wallet className="w-4 h-4 text-slate-300" />
              </div>
              <p className="text-[13px] text-slate-400">No payments yet</p>
              <p className="text-[11px] text-slate-300 mt-1">Your first {'\u00A3'}50 appears after your first sale</p>
            </div>
          )}
        </Section>

        {/* Tax section */}
        <Section title="Tax & Reporting">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-slate-50">
            <div className="bg-white px-4 py-3.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Tax Year 2025/26</div>
              <div className="text-[18px] font-bold text-slate-900 tabular-nums">{'\u00A3'}{totalEarned.toFixed(2)}</div>
              <div className="text-[10px] text-slate-400">Total earned</div>
            </div>
            <div className="bg-white px-4 py-3.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Status</div>
              <div className="text-[13px] font-semibold text-slate-900">Self-employed</div>
              <div className="text-[10px] text-slate-400">You handle your own tax</div>
            </div>
            <div className="bg-white px-4 py-3.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Documents</div>
              <a href="#" className="flex items-center gap-1.5 text-[12px] font-medium text-slate-900 hover:text-slate-600">
                <Download className="w-3 h-3" />
                HMRC Statement
              </a>
              <a href="#" className="flex items-center gap-1.5 text-[12px] font-medium text-slate-900 hover:text-slate-600 mt-1">
                <FileText className="w-3 h-3" />
                Invoice History
              </a>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}

// --- Components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">{title}</h2>
      <div className="border border-slate-100 rounded-xl overflow-hidden">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, title, desc }: { icon: typeof Clock; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
      <Icon className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
      <div>
        <div className="text-[12px] font-medium text-slate-900">{title}</div>
        <div className="text-[10px] text-slate-400">{desc}</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sublabel, trend }: { label: string; value: string; sublabel: string; trend: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="bg-white px-4 py-3.5 text-center">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-center justify-center gap-1.5">
        <span className="text-[20px] font-bold text-slate-900 tabular-nums">{value}</span>
        {trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />}
        {trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />}
      </div>
      <div className="text-[10px] text-slate-300 mt-0.5">{sublabel}</div>
    </div>
  );
}

function FunnelRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-slate-500 w-16 text-right font-medium">{label}</span>
      <div className="flex-1 h-6 bg-slate-50 rounded-md overflow-hidden relative">
        <div className={`h-full ${color} rounded-md transition-all duration-700`} style={{ width: `${Math.max(pct, 2)}%` }} />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-500">
          {count} {total > 0 && <span className="text-slate-300">({pct.toFixed(0)}%)</span>}
        </span>
      </div>
    </div>
  );
}
