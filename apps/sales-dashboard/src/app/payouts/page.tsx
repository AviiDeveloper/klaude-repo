'use client';

import { useState, useEffect } from 'react';
import { Download, TrendingUp, Users, Target, CheckCircle, Clock } from 'lucide-react';

interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending';
  period: string;
}

interface PayoutData {
  available_balance: number;
  projected_monthly: number;
  total_earned: number;
  close_rate: number;
  visit_to_sale_rate: number;
  weekly_activity: {
    day: string;
    visits: number;
    sales: number;
  }[];
  funnel: {
    assigned: number;
    visited: number;
    pitched: number;
    sold: number;
  };
  payment_history: PaymentRecord[];
}

export default function PayoutsPage() {
  const [data, setData] = useState<PayoutData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayoutData();
  }, []);

  const fetchPayoutData = async () => {
    try {
      const res = await fetch('/api/payouts');
      const payoutData = await res.json();
      setData(payoutData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch payout data', err);
      setLoading(false);
    }
  };

  const exportTaxData = () => {
    // Trigger tax data export for HMRC
    window.location.href = '/api/payouts/export-tax';
  };

  if (loading || !data) {
    return (
      <div className="pt-20 text-center text-[13px] text-[#666]">Loading...</div>
    );
  }

  const funnelSteps = [
    { label: 'Assigned', value: data.funnel.assigned, color: 'bg-blue-500' },
    { label: 'Visited', value: data.funnel.visited, color: 'bg-yellow-500' },
    { label: 'Pitched', value: data.funnel.pitched, color: 'bg-purple-500' },
    { label: 'Sold', value: data.funnel.sold, color: 'bg-green-500' },
  ];

  const maxFunnelValue = data.funnel.assigned;

  return (
    <div className="py-8 page-enter">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em] mb-1">Payouts</h1>
        <p className="text-[13px] text-[#666]">Track your earnings and commissions</p>
      </div>

      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#0a0a0a] rounded-xl p-6 border border-[#333] glow-border">
          <p className="text-[11px] uppercase tracking-wide text-[#666] mb-3">Available Balance</p>
          <p className="text-[36px] font-semibold text-white font-mono mb-2">£{data.available_balance.toLocaleString()}</p>
          <p className="text-[13px] text-[#666]">Ready to withdraw</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl p-6 border border-[#333]">
          <p className="text-[11px] uppercase tracking-wide text-[#666] mb-3">Projected Monthly</p>
          <p className="text-[36px] font-semibold text-white font-mono mb-2">£{data.projected_monthly.toLocaleString()}</p>
          <p className="text-[13px] text-[#666]">Based on current rate</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl p-6 border border-[#333]">
          <p className="text-[11px] uppercase tracking-wide text-[#666] mb-3">Total Earned</p>
          <p className="text-[36px] font-semibold text-white font-mono mb-2">£{data.total_earned.toLocaleString()}</p>
          <p className="text-[13px] text-[#666]">All time</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Performance Metrics</h2>
              <p className="text-[13px] text-[#666]">Your conversion rates</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] text-[#999]">Close Rate</span>
                <span className="text-[15px] font-semibold text-white font-mono">{data.close_rate}%</span>
              </div>
              <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${data.close_rate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] text-[#999]">Visit to Sale</span>
                <span className="text-[15px] font-semibold text-white font-mono">{data.visit_to_sale_rate}%</span>
              </div>
              <div className="h-2 bg-[#222] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${data.visit_to_sale_rate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Activity */}
        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Weekly Activity</h2>
              <p className="text-[13px] text-[#666]">Last 7 days</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.weekly_activity.map((day) => (
              <div key={day.day} className="flex items-center gap-3">
                <span className="text-[11px] text-[#666] w-8 font-mono">{day.day}</span>
                <div className="flex-1 flex gap-2">
                  <div className="flex-1 h-8 bg-[#222] rounded overflow-hidden flex items-center px-2">
                    <div
                      className="h-4 bg-blue-400 rounded"
                      style={{ width: `${(day.visits / 10) * 100}%` }}
                    />
                    <span className="ml-2 text-[11px] text-[#999]">{day.visits}v</span>
                  </div>
                  <div className="flex-1 h-8 bg-[#222] rounded overflow-hidden flex items-center px-2">
                    <div
                      className="h-4 bg-green-400 rounded"
                      style={{ width: `${(day.sales / 5) * 100}%` }}
                    />
                    <span className="ml-2 text-[11px] text-[#999]">{day.sales}s</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-[#222] text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-400 rounded"></span>
              <span className="text-[#999]">Visits</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded"></span>
              <span className="text-[#999]">Sales</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-white">Conversion Funnel</h2>
            <p className="text-[13px] text-[#666]">Lead progression overview</p>
          </div>
        </div>

        <div className="space-y-3">
          {funnelSteps.map((step, idx) => {
            const percentage = maxFunnelValue > 0 ? (step.value / maxFunnelValue) * 100 : 0;
            const conversionFromPrevious = idx > 0
              ? funnelSteps[idx - 1].value > 0
                ? ((step.value / funnelSteps[idx - 1].value) * 100).toFixed(0)
                : 0
              : 100;

            return (
              <div key={step.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] text-[#999]">{step.label}</span>
                  <div className="flex items-center gap-3">
                    {idx > 0 && (
                      <span className="text-[11px] text-[#666]">{conversionFromPrevious}% conversion</span>
                    )}
                    <span className="text-[15px] font-semibold text-white font-mono">{step.value}</span>
                  </div>
                </div>
                <div className="h-12 bg-[#111] rounded-lg overflow-hidden flex items-center px-3">
                  <div
                    className={`h-8 ${step.color} rounded transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#333] overflow-hidden mb-8">
        <div className="p-6 border-b border-[#222]">
          <h2 className="text-[15px] font-semibold text-white">Payment History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222] bg-[#111]">
                <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-[#666]">
                  Period
                </th>
                <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-[#666]">
                  Date
                </th>
                <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-[#666]">
                  Amount
                </th>
                <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-[#666]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.payment_history.map((payment) => (
                <tr key={payment.id} className="border-b border-[#222]">
                  <td className="py-4 px-6 text-[13px] text-white">{payment.period}</td>
                  <td className="py-4 px-6 text-[13px] text-[#999]">
                    {new Date(payment.date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-4 px-6 text-[15px] font-medium text-white font-mono">
                    £{payment.amount.toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    {payment.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 rounded-md text-[11px] font-medium uppercase tracking-wide border border-green-500/20">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 text-yellow-500 rounded-md text-[11px] font-medium uppercase tracking-wide border border-yellow-500/20">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Section */}
      <div className="bg-[#111] border border-[#333] rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white mb-2">Tax Information</h2>
            <p className="text-[13px] text-[#999] mb-4">
              Total earned this tax year: <span className="font-semibold text-white font-mono">£{data.total_earned.toLocaleString()}</span>
            </p>
            <p className="text-[12px] text-[#666] max-w-2xl">
              As a self-employed contractor, you're responsible for declaring this income to HMRC. Export your earnings summary for your Self Assessment.
            </p>
          </div>
          <button
            onClick={exportTaxData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#333] border border-[#444] text-white rounded-lg text-[13px] font-medium hover:bg-[#444] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export for HMRC
          </button>
        </div>
      </div>
    </div>
  );
}
