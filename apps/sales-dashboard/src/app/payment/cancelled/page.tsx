'use client';

import { ArrowLeft } from 'lucide-react';

export default function PaymentCancelledPage() {
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        <h1 className="text-[28px] font-semibold text-slate-900 mb-3">Payment cancelled</h1>
        <p className="text-[15px] text-slate-600 mb-6">
          No worries — no payment has been taken. You can go back to the demo anytime.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[15px] font-medium hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </button>
      </div>
    </div>
  );
}
