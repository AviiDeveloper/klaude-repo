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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const funnelSteps = [
    { label: 'Assigned', value: data.funnel.assigned, color: 'bg-blue-500' },
    { label: 'Visited', value: data.funnel.visited, color: 'bg-amber-500' },
    { label: 'Pitched', value: data.funnel.pitched, color: 'bg-purple-500' },
    { label: 'Sold', value: data.funnel.sold, color: 'bg-emerald-500' },
  ];

  const maxFunnelValue = data.funnel.assigned;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight mb-1">Payouts</h1>
          <p className="text-[15px] text-slate-500">Track your earnings and commissions</p>
        </div>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-3">Available Balance</p>
            <p className="text-[36px] font-semibold mb-2">£{data.available_balance.toLocaleString()}</p>
            <p className="text-[13px] text-slate-400">Ready to withdraw</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">Projected Monthly</p>
            <p className="text-[36px] font-semibold text-slate-900 mb-2">£{data.projected_monthly.toLocaleString()}</p>
            <p className="text-[13px] text-slate-500">Based on current rate</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">Total Earned</p>
            <p className="text-[36px] font-semibold text-slate-900 mb-2">£{data.total_earned.toLocaleString()}</p>
            <p className="text-[13px] text-slate-500">All time</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Performance Metrics</h2>
                <p className="text-[13px] text-slate-500">Your conversion rates</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] text-slate-600">Close Rate</span>
                  <span className="text-[15px] font-semibold text-slate-900">{data.close_rate}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${data.close_rate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[13px] text-slate-600">Visit to Sale</span>
                  <span className="text-[15px] font-semibold text-slate-900">{data.visit_to_sale_rate}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${data.visit_to_sale_rate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Activity */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Weekly Activity</h2>
                <p className="text-[13px] text-slate-500">Last 7 days</p>
              </div>
            </div>

            <div className="space-y-3">
              {data.weekly_activity.map((day) => (
                <div key={day.day} className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 w-8">{day.day}</span>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 h-8 bg-slate-100 rounded overflow-hidden flex items-center px-2">
                      <div
                        className="h-4 bg-blue-400 rounded"
                        style={{ width: `${(day.visits / 10) * 100}%` }}
                      />
                      <span className="ml-2 text-[11px] text-slate-600">{day.visits}v</span>
                    </div>
                    <div className="flex-1 h-8 bg-slate-100 rounded overflow-hidden flex items-center px-2">
                      <div
                        className="h-4 bg-emerald-400 rounded"
                        style={{ width: `${(day.sales / 5) * 100}%` }}
                      />
                      <span className="ml-2 text-[11px] text-slate-600">{day.sales}s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded"></span>
                <span className="text-slate-600">Visits</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-400 rounded"></span>
                <span className="text-slate-600">Sales</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Conversion Funnel</h2>
              <p className="text-[13px] text-slate-500">Lead progression overview</p>
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
                    <span className="text-[13px] text-slate-600">{step.label}</span>
                    <div className="flex items-center gap-3">
                      {idx > 0 && (
                        <span className="text-[11px] text-slate-400">{conversionFromPrevious}% conversion</span>
                      )}
                      <span className="text-[15px] font-semibold text-slate-900">{step.value}</span>
                    </div>
                  </div>
                  <div className="h-12 bg-slate-50 rounded-lg overflow-hidden flex items-center px-3">
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-[15px] font-semibold text-slate-900">Payment History</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                    Period
                  </th>
                  <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                    Date
                  </th>
                  <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                    Amount
                  </th>
                  <th className="text-left py-3 px-6 text-[11px] uppercase tracking-wide font-medium text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.payment_history.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-50">
                    <td className="py-4 px-6 text-[13px] text-slate-900">{payment.period}</td>
                    <td className="py-4 px-6 text-[13px] text-slate-600">
                      {new Date(payment.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-6 text-[15px] font-medium text-slate-900">
                      £{payment.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      {payment.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium uppercase tracking-wide border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[11px] font-medium uppercase tracking-wide border border-amber-200">
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
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 mb-2">Tax Information</h2>
              <p className="text-[13px] text-slate-600 mb-4">
                Total earned this tax year: <span className="font-semibold text-slate-900">£{data.total_earned.toLocaleString()}</span>
              </p>
              <p className="text-[12px] text-slate-500 max-w-2xl">
                As a self-employed contractor, you're responsible for declaring this income to HMRC. Export your earnings summary for your Self Assessment.
              </p>
            </div>
            <button
              onClick={exportTaxData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-[13px] font-medium hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export for HMRC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
