'use client';

import { useEffect, useState } from 'react';
import { Wallet, Building2, Download, Clock, CheckCircle2, AlertCircle, ChevronRight, Plus, FileText } from 'lucide-react';

export default function PayoutsPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => setStats(d.data ?? null));
  }, []);

  const totalEarned = stats?.total_commission ?? 0;
  const totalSold = stats?.sold_count ?? 0;

  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <h1 className="text-[15px] font-semibold text-slate-900">Payouts</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Commission payments and tax information</p>
      </div>

      <div className="px-6 md:px-8 py-6 max-w-2xl">
        {/* Balance card */}
        <div className="bg-slate-900 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Available balance</span>
            <Wallet className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-3xl font-bold text-white tabular-nums mb-1">
            {'\u00A3'}{totalEarned.toFixed(2)}
          </div>
          <div className="text-[12px] text-slate-400">{totalSold} sales at {'\u00A3'}50 each</div>
          <div className="mt-5 flex gap-3">
            <button className="flex-1 bg-white text-slate-900 text-[13px] font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
              <Building2 className="w-3.5 h-3.5" />
              Withdraw
            </button>
            <button className="flex-1 bg-white/10 text-white text-[13px] font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Bank details */}
        <Section title="Payment Method">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-[13px] text-slate-400">No payment method added</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Add your bank details to receive payouts</p>
                </div>
              </div>
              <button className="flex items-center gap-1 text-[12px] font-medium text-slate-900 bg-slate-50 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>
        </Section>

        {/* Payout schedule */}
        <Section title="Payout Schedule">
          <InfoRow icon={Clock} title="Weekly payouts" desc="Commissions are processed every Friday" />
          <InfoRow icon={Building2} title="Minimum payout" desc={'\u00A3' + '50 — equivalent to 1 sale'} />
          <InfoRow icon={CheckCircle2} title="Processing time" desc="1-3 business days to your bank" />
        </Section>

        {/* Payment history */}
        <Section title="Payment History">
          {totalSold > 0 ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: Math.min(totalSold, 5) }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-[13px] font-medium text-slate-900">Commission #{totalSold - i}</div>
                    <div className="text-[11px] text-slate-400">Pending</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-slate-900 tabular-nums">{'\u00A3'}50.00</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Pending</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-slate-400">No payments yet</p>
              <p className="text-[11px] text-slate-300 mt-1">Your first {'\u00A3'}50 will appear after your first sale</p>
            </div>
          )}
        </Section>

        {/* Tax */}
        <Section title="Tax Information">
          <InfoRow icon={FileText} title="Self-employed" desc="As a contractor, you are responsible for your own tax returns" />
          <a href="#" className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4 text-slate-400" />
            <span className="text-[13px] font-medium text-slate-900 flex-1">Download earnings statement (HMRC)</span>
            <ChevronRight className="w-4 h-4 text-slate-200" />
          </a>
          <InfoRow icon={AlertCircle} title="Tax year 2025/26" desc={'Total earned: \u00A3' + totalEarned.toFixed(2)} />
        </Section>
      </div>
    </>
  );
}

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
    <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-slate-50 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <div>
        <div className="text-[13px] font-medium text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
