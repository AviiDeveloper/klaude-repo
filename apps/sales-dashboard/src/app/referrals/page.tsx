'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Users, DollarSign, TrendingUp } from 'lucide-react';

interface ReferralData {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  active_referrals: number;
  total_earned: number;
  referrals: {
    id: string;
    name: string;
    status: 'active' | 'inactive';
    joined_date: string;
    sales_count: number;
    earned_from: number;
  }[];
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const res = await fetch('/api/referrals');
      const referralData = await res.json();
      setData(referralData);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch referral data', err);
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (data?.referral_link) {
      navigator.clipboard.writeText(data.referral_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareViaWhatsApp = () => {
    const message = `Join SalesFlow and start earning! Use my referral link: ${data?.referral_link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = 'Join SalesFlow - Earn money selling websites';
    const body = `I've been earning money with SalesFlow by selling websites to local businesses. You should join too!\n\nUse my referral link to get started: ${data?.referral_link}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading || !data) {
    return (
      <div className="pt-20 text-center text-[13px] text-[#666]">Loading...</div>
    );
  }

  return (
    <div className="py-8 page-enter">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold text-white tracking-[-0.03em] mb-1">Referrals</h1>
        <p className="text-[13px] text-[#666]">Invite friends and earn together</p>
      </div>

      {/* Invite Card */}
      <div className="bg-[#0a0a0a] border border-[#333] rounded-xl p-8 mb-8 glow-border">
        <div className="max-w-2xl">
          <h2 className="text-[24px] font-semibold text-white mb-3">Earn £25 per referral</h2>
          <p className="text-[15px] text-[#999] mb-6">
            Share SalesFlow with friends who'd be great at sales. When they make their first sale, you both earn an extra £25.
          </p>

          {/* Referral Link */}
          <div className="bg-[#111] rounded-lg p-4 mb-4 border border-[#333]">
            <p className="text-[11px] uppercase tracking-wide text-[#666] mb-2">Your Referral Link</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={data.referral_link}
                readOnly
                className="flex-1 bg-transparent text-white text-[15px] outline-none font-mono"
              />
              <button
                onClick={copyReferralLink}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-[13px] font-medium hover:bg-[#ededed] transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="flex gap-3">
            <button
              onClick={shareViaWhatsApp}
              className="flex-1 px-4 py-3 bg-[#333] hover:bg-[#444] rounded-lg text-[13px] font-medium text-white transition-colors"
            >
              Share via WhatsApp
            </button>
            <button
              onClick={shareViaEmail}
              className="flex-1 px-4 py-3 bg-[#333] hover:bg-[#444] rounded-lg text-[13px] font-medium text-white transition-colors"
            >
              Share via Email
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Total Referrals</p>
          </div>
          <p className="text-[32px] font-semibold text-white font-mono">{data.total_referrals}</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Active</p>
          </div>
          <p className="text-[32px] font-semibold text-green-400 font-mono">{data.active_referrals}</p>
        </div>

        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-[11px] uppercase tracking-wide text-[#666]">Earned</p>
          </div>
          <p className="text-[32px] font-semibold text-white font-mono">£{data.total_earned}</p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6 mb-8">
        <h2 className="text-[15px] font-semibold text-white mb-4">How It Works</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-[13px] font-semibold">
              1
            </div>
            <div>
              <p className="text-[13px] font-medium text-white mb-1">Share your link</p>
              <p className="text-[13px] text-[#999]">
                Send your unique referral link to friends interested in sales
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-[13px] font-semibold">
              2
            </div>
            <div>
              <p className="text-[13px] font-medium text-white mb-1">They sign up</p>
              <p className="text-[13px] text-[#999]">
                Your friend creates an account using your referral link
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-[13px] font-semibold">
              3
            </div>
            <div>
              <p className="text-[13px] font-medium text-white mb-1">You both earn</p>
              <p className="text-[13px] text-[#999]">
                When they make their first sale, you each get an extra £25
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Referral List */}
      {data.referrals.length > 0 && (
        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] overflow-hidden">
          <div className="p-6 border-b border-[#222]">
            <h2 className="text-[15px] font-semibold text-white">Your Referrals</h2>
          </div>

          <div className="divide-y divide-[#222]">
            {data.referrals.map((referral) => (
              <div key={referral.id} className="p-5 hover:bg-[#111] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center text-[15px] font-semibold">
                      {referral.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[15px] font-medium text-white">{referral.name}</p>
                      <p className="text-[13px] text-[#666]">
                        Joined {new Date(referral.joined_date).toLocaleDateString('en-GB', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[15px] font-semibold text-white font-mono">
                      £{referral.earned_from}
                    </p>
                    <p className="text-[13px] text-[#666]">
                      {referral.sales_count} {referral.sales_count === 1 ? 'sale' : 'sales'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {data.referrals.length === 0 && (
        <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-12 text-center">
          <Users className="w-12 h-12 text-[#333] mx-auto mb-4" />
          <p className="text-[15px] text-[#999] mb-2">No referrals yet</p>
          <p className="text-[13px] text-[#666]">
            Share your link above to start earning referral bonuses
          </p>
        </div>
      )}
    </div>
  );
}
