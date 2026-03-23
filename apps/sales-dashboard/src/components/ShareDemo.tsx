'use client';

import { useState } from 'react';
import { Share2, Copy, Check, QrCode, MessageCircle, Mail, Loader2, Eye, Clock } from 'lucide-react';

interface ShareDemoProps {
  assignmentId: string;
  businessName: string;
  hasDemoSite: boolean;
}

interface DemoLink {
  code: string;
  status: string;
  views: number;
  last_viewed_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  interested_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function ShareDemo({ assignmentId, businessName, hasDemoSite }: ShareDemoProps) {
  const [link, setLink] = useState<DemoLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  async function generateLink() {
    setLoading(true);
    try {
      const res = await fetch('/api/demo-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      if (res.ok) {
        const data = await res.json();
        setLink(data.data.link);
        setShowDetails(true);
      }
    } catch { /* */ }
    setLoading(false);
  }

  function getFullUrl() {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/demo/${link?.code}`;
  }

  function copyLink() {
    navigator.clipboard?.writeText(getFullUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareViaWhatsApp() {
    const text = `Hi! I put together a website demo for ${businessName} — take a look and let me know what you think: ${getFullUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function shareViaSms() {
    const text = `Hi! Here's a website demo I put together for ${businessName}: ${getFullUrl()}`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
  }

  function shareViaEmail() {
    const subject = `Website demo for ${businessName}`;
    const body = `Hi,\n\nI put together a website demo for ${businessName} — you can view it here:\n\n${getFullUrl()}\n\nLet me know what you think!\n\nBest regards`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  }

  // Not yet generated
  if (!link && !showDetails) {
    return (
      <div className="border border-slate-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-slate-900">Share demo with client</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {hasDemoSite
                ? 'Generate a unique link so they can view the demo and express interest'
                : 'Demo site not ready yet — generate a link once the site is built'
              }
            </div>
          </div>
          <button
            onClick={generateLink}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-[12px] font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
            Generate Link
          </button>
        </div>
      </div>
    );
  }

  // Link generated — show sharing options
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      {/* Link display */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Shareable Demo Link</span>
          {link?.status === 'interested' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium ml-auto">Customer interested!</span>
          )}
          {link?.status === 'viewed' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium ml-auto">Viewed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={getFullUrl()}
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[12px] text-slate-700 font-mono truncate"
          />
          <button
            onClick={copyLink}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
              copied ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="px-4 py-3 flex gap-2">
        <button onClick={shareViaWhatsApp} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          WhatsApp
        </button>
        <button onClick={shareViaSms} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-medium hover:bg-blue-100 transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          Text
        </button>
        <button onClick={shareViaEmail} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-50 text-slate-700 text-[11px] font-medium hover:bg-slate-100 transition-colors">
          <Mail className="w-3.5 h-3.5" />
          Email
        </button>
      </div>

      {/* Stats */}
      {link && (link.views > 0 || link.customer_name) && (
        <div className="px-4 py-3 border-t border-slate-100 space-y-1.5">
          {link.views > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Eye className="w-3 h-3" />
              Viewed {link.views} time{link.views !== 1 ? 's' : ''}
              {link.last_viewed_at && <span className="text-slate-300">· last {new Date(link.last_viewed_at).toLocaleDateString()}</span>}
            </div>
          )}
          {link.customer_name && (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-medium">
              <Check className="w-3 h-3" />
              {link.customer_name} expressed interest
              {link.customer_phone && <span>({link.customer_phone})</span>}
            </div>
          )}
          {link.expires_at && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              Expires {new Date(link.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
