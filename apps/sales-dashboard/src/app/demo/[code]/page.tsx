'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { X, Check, Loader2, Globe, ArrowRight, Sparkles, Shield, Phone } from 'lucide-react';

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
  const [btnHovered, setBtnHovered] = useState(false);
  const [btnVisible, setBtnVisible] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Delay button entrance for polish
  useEffect(() => {
    const t = setTimeout(() => setBtnVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

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

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 animate-ping opacity-20" />
          </div>
          <p className="text-xs text-slate-400 font-medium">Loading your preview</p>
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center px-6 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-5">
            <X className="w-7 h-7 text-slate-300" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">{error}</h1>
          <p className="text-sm text-slate-400 leading-relaxed">The person who shared this with you can send a new link.</p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  const demoSiteUrl = demo.demo_domain
    ? `/demo-sites/${demo.demo_domain}.html`
    : null;

  const firstName = name.split(' ')[0];

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* ═══ FULL SCREEN DEMO ═══ */}
      {demoSiteUrl ? (
        <iframe
          src={demoSiteUrl}
          className="w-full border-0"
          style={{ height: '100vh' }}
          title={`${demo.business_name} website`}
        />
      ) : (
        <div className="flex items-center justify-center bg-gradient-to-b from-slate-50 to-white" style={{ height: '100vh' }}>
          <div className="text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-5">
              <Globe className="w-8 h-8 text-slate-300" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Your website is being crafted</h2>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">We&apos;re designing something special for {demo.business_name}. Check back soon.</p>
          </div>
        </div>
      )}

      {/* ═══ FLOATING CTA — the premium buy button ═══ */}
      {!showBuy && !submitted && (
        <div
          className={`fixed bottom-6 right-6 z-50 transition-all duration-700 ${
            btnVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={() => setShowBuy(true)}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            className="group relative"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400/40 via-orange-400/40 to-rose-400/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Button body */}
            <div className="relative flex items-center gap-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_50px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">

              {/* Left: icon + text */}
              <div className="flex items-center gap-2.5 pl-5 pr-2 py-3.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-[13px] font-semibold leading-none">Make it yours</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-medium">This could be your website</div>
                </div>
              </div>

              {/* Right: price badge */}
              <div className="flex items-center gap-1.5 bg-white/[0.08] border-l border-white/[0.06] pl-3.5 pr-4 py-3.5 rounded-r-2xl">
                <span className="text-[18px] font-bold tracking-tight">{'\u00A3'}350</span>
                <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${btnHovered ? 'translate-x-0.5' : ''}`} />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ═══ SUCCESS STATE ═══ */}
      {submitted && (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 opacity-100 translate-y-0`}>
          <div className="flex items-center gap-3 bg-emerald-600 text-white rounded-2xl shadow-[0_8px_40px_rgba(16,185,129,0.35)] px-5 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[13px] font-semibold leading-none">Thank you{firstName ? `, ${firstName}` : ''}!</div>
              <div className="text-[10px] text-emerald-200 mt-0.5">We&apos;ll call you shortly</div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BUY PANEL — glass bottom sheet ═══ */}
      {showBuy && !submitted && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-fade-in"
            onClick={() => setShowBuy(false)}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
            <div className="bg-white rounded-t-3xl shadow-[0_-8px_60px_rgba(0,0,0,0.15)]">
              <div className="max-w-md mx-auto px-6 pt-4 pb-8">
                {/* Handle bar */}
                <div className="w-8 h-1 bg-slate-200 rounded-full mx-auto mb-6" />

                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-900">Get this website</h2>
                      <p className="text-[12px] text-slate-400 mt-0.5">
                        {'\u00A3'}350 setup · {'\u00A3'}25/mo · ready in 48hrs
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBuy(false)}
                    className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      autoFocus
                      className="w-full bg-slate-50 border-0 rounded-xl py-3.5 px-4 text-[14px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Phone number"
                      required
                      className="w-full bg-slate-50 border-0 rounded-xl py-3.5 px-4 text-[14px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !phone.trim()}
                    className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white text-[14px] font-semibold py-4 rounded-xl hover:from-slate-800 hover:to-slate-800 transition-all disabled:opacity-30 disabled:hover:from-slate-900 shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Yes, I want this
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Trust signals */}
                  <div className="flex items-center justify-center gap-5 pt-2">
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-300 font-medium">
                      <Phone className="w-3 h-3" /> We call first
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-slate-300 font-medium">
                      <Shield className="w-3 h-3" /> No obligation
                    </span>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
