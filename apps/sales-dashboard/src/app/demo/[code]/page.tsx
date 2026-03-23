'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Check, Loader2, Phone, Mail, MessageSquare } from 'lucide-react';

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
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

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
      const res = await fetch(`/api/demo-links/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, message: message.trim() || undefined }),
      });
      if (res.ok) setSubmitted(true);
    } catch { /* */ }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">{error}</h1>
          <p className="text-[13px] text-slate-400">Contact the person who shared this link with you for an updated version.</p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  // Construct demo site URL — on the Pi preview server
  const demoSiteUrl = demo.demo_domain
    ? `/api/demo-site/${demo.demo_domain}`
    : null;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal top bar */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-2.5 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-white">S</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-[14px] font-semibold text-slate-900 truncate">{demo.business_name}</h1>
              <p className="text-[10px] text-slate-400">Website preview</p>
            </div>
          </div>

          {!submitted ? (
            <button
              onClick={() => setShowForm(true)}
              className="bg-slate-900 text-white text-[12px] font-semibold px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              Get This Website
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-600 text-[12px] font-medium">
              <Check className="w-4 h-4" />
              Request sent
            </div>
          )}
        </div>
      </div>

      {/* Demo site iframe */}
      <div className="flex-1 relative">
        {demoSiteUrl ? (
          <iframe
            src={demoSiteUrl}
            className="w-full h-full min-h-[calc(100vh-52px)] border-0"
            title={`${demo.business_name} demo website`}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-[calc(100vh-52px)]">
            <div className="text-center px-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Demo site is being generated</h2>
              <p className="text-[13px] text-slate-400">Check back soon — we&apos;re building a custom website for {demo.business_name}.</p>
            </div>
          </div>
        )}
      </div>

      {/* Interest form modal */}
      {showForm && !submitted && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[16px] font-semibold text-slate-900">Get this website</h2>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-md hover:bg-slate-100">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <p className="text-[12px] text-slate-400 mb-5">Leave your details and we&apos;ll get your website set up.</p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Your name *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="e.g. Ahmed Khan"
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Phone number *</label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                  placeholder="e.g. 07700 900000"
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Email (optional)</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. ahmed@example.com"
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Any questions? (optional)</label>
                <textarea
                  value={message} onChange={e => setMessage(e.target.value)} rows={2}
                  placeholder="e.g. Can I add online booking?"
                  className="w-full border border-slate-200 rounded-xl py-3 px-4 text-[13px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
                />
              </div>

              <button
                type="submit" disabled={submitting || !name.trim() || !phone.trim()}
                className="w-full bg-slate-900 text-white text-[13px] font-semibold py-3.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, I want this website'}
              </button>

              <p className="text-[10px] text-slate-300 text-center">
                No commitment — we&apos;ll call to discuss pricing and next steps.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* Success overlay */}
      {submitted && showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Thank you, {name}!</h2>
            <p className="text-[13px] text-slate-500 mb-6">We&apos;ve received your interest. Someone will be in touch shortly to discuss getting your website set up.</p>
            <button onClick={() => setShowForm(false)} className="w-full bg-slate-900 text-white text-[13px] font-medium py-3 rounded-xl hover:bg-slate-800">
              Continue viewing demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
