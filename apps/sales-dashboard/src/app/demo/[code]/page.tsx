'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Check, Loader2, Globe } from 'lucide-react';

interface DemoData {
  business_name: string;
  demo_domain: string | null;
  status: string;
}

export default function CustomerDemoPage() {
  const params = useParams();
  const code = params.code as string;
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetch(`/api/demo-links/${code}`)
      .then(r => {
        if (r.status === 410) throw new Error('expired');
        if (r.status === 404) throw new Error('not_found');
        return r.json();
      })
      .then(d => setDemo(d.data))
      .catch(e => setError(e.message === 'expired' ? 'This demo link has expired.' : 'Demo not found.'))
      .finally(() => setLoading(false));
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/demo-links/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      setSubmitted(true);
    } catch { /* */ }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-base font-semibold text-slate-900 mb-1">{error}</h1>
          <p className="text-sm text-slate-400">Contact the person who showed you this.</p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  // Try public static file first, fall back to API route
  const demoSiteUrl = demo.demo_domain
    ? `/demo-sites/${demo.demo_domain}.html`
    : null;

  return (
    <div className="min-h-screen bg-white relative">
      {/* ═══ FULL SCREEN DEMO — the site IS the pitch ═══ */}
      {demoSiteUrl ? (
        <iframe
          src={demoSiteUrl}
          className="w-full border-0"
          style={{ height: '100vh' }}
          title={`${demo.business_name} website`}
        />
      ) : (
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <div className="text-center px-6">
            <Globe className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <h2 className="text-base font-semibold text-slate-900 mb-1">Your website is being built</h2>
            <p className="text-sm text-slate-400">Check back soon.</p>
          </div>
        </div>
      )}

      {/* ═══ FLOATING BUY BUTTON — always visible ═══ */}
      {!showBuy && !submitted && (
        <button
          onClick={() => setShowBuy(true)}
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-semibold pl-5 pr-4 py-3 rounded-full shadow-2xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
        >
          Get This Website
          <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{'\u00A3'}350</span>
        </button>
      )}

      {/* ═══ SUCCESS PILL — replaces buy button after submit ═══ */}
      {submitted && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-sm font-medium px-5 py-3 rounded-full shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          We&apos;ll be in touch, {name.split(' ')[0]}
        </div>
      )}

      {/* ═══ BUY PANEL — slides up over the demo, minimal ═══ */}
      {showBuy && !submitted && (
        <>
          {/* Dim overlay — clicking it closes */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowBuy(false)}
          />

          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up">
            <div className="max-w-md mx-auto px-6 pt-5 pb-8">
              {/* Handle */}
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

              {/* One-liner */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Get this website</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{'\u00A3'}350 one-time · {'\u00A3'}25/mo hosting</p>
                </div>
                <button onClick={() => setShowBuy(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Form — just name and phone */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Phone number"
                  required
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !phone.trim()}
                  className="w-full bg-slate-900 text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Yes, I want this'}
                </button>
                <p className="text-[10px] text-slate-300 text-center">
                  We&apos;ll call to confirm before taking payment
                </p>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Slide-up animation */}
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
