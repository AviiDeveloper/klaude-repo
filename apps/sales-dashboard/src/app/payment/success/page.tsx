'use client';

import { Check } from 'lucide-react';

export default function PaymentSuccessPage() {
  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-[28px] font-semibold text-slate-900 mb-3">Payment received!</h1>
        <p className="text-[15px] text-slate-600 mb-2">
          Your website is being set up right now.
        </p>
        <p className="text-[15px] text-slate-600">
          You'll receive a confirmation with your live website URL within 90 seconds.
        </p>
      </div>
    </div>
  );
}
