'use client';

import { useState } from 'react';
import { Users, Gift, Copy, Check, Share2, TrendingUp } from 'lucide-react';

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const referralCode = 'SALES-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  const referralLink = `https://app.salesflow.co.uk/signup?ref=${referralCode}`;

  function copyLink() {
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <h1 className="text-[15px] font-semibold text-slate-900">Referrals</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Invite friends and earn bonus commission</p>
      </div>

      <div className="px-6 md:px-8 py-6 max-w-2xl">
        {/* Hero card */}
        <div className="bg-slate-900 rounded-2xl p-6 mb-6 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center mx-auto mb-4">
            <Gift className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Earn {'\u00A3'}20 per referral</h2>
          <p className="text-[13px] text-slate-400 mb-6 max-w-sm mx-auto">
            When someone you refer makes their first sale, you both earn a {'\u00A3'}20 bonus.
          </p>

          {/* Referral link */}
          <div className="bg-white/10 rounded-xl p-3 flex items-center gap-2 mb-4">
            <input
              readOnly
              value={referralLink}
              className="flex-1 bg-transparent text-[12px] text-white font-mono outline-none truncate"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 bg-white text-slate-900 text-[12px] font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>

          <button className="w-full bg-white/10 text-white text-[13px] font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
            <Share2 className="w-4 h-4" />
            Share invite link
          </button>
        </div>

        {/* How it works */}
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">How it works</h2>
        <div className="border border-slate-100 rounded-xl overflow-hidden mb-6">
          <Step number={1} title="Share your link" desc="Send your referral link to friends who want to earn" />
          <Step number={2} title="They sign up" desc="Your friend creates an account using your link" />
          <Step number={3} title="They make a sale" desc="When they close their first deal, you both get paid" />
          <Step number={4} title="You earn £20" desc="Bonus added to your next payout automatically" />
        </div>

        {/* Stats */}
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Your Referrals</h2>
        <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-xl overflow-hidden mb-6">
          <div className="bg-white py-4 text-center">
            <div className="text-xl font-semibold text-slate-900 tabular-nums">0</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Invited</div>
          </div>
          <div className="bg-white py-4 text-center">
            <div className="text-xl font-semibold text-slate-900 tabular-nums">0</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Joined</div>
          </div>
          <div className="bg-white py-4 text-center">
            <div className="text-xl font-semibold text-emerald-600 tabular-nums">{'\u00A3'}0</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Earned</div>
          </div>
        </div>

        <p className="text-[11px] text-slate-300 text-center">
          Referral bonuses are paid when your referral makes their first sale. No limit on referrals.
        </p>
      </div>
    </>
  );
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 border-b border-slate-50 last:border-0">
      <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] font-bold text-slate-500">{number}</span>
      </div>
      <div>
        <div className="text-[13px] font-medium text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
