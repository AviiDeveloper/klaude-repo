'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Loader2, Globe } from 'lucide-react';

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
  const [phase, setPhase] = useState<'viewing' | 'buying' | 'done'>('viewing');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000);
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
      .catch(e => setError(e.message === 'expired' ? 'expired' : 'not_found'))
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
    } catch { /* */ }
    setSubmitting(false);
    setPhase('done');
  }

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <p className="text-[32px] font-semibold text-neutral-900 tracking-tight mb-3">
            {error === 'expired' ? 'Link expired.' : 'Not found.'}
          </p>
          <p className="text-[15px] text-neutral-400 leading-relaxed">
            Ask the person who shared this with you for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  const demoSiteUrl = demo.demo_domain ? `/demo-sites/${demo.demo_domain}.html` : null;
  const firstName = name.split(' ')[0];

  return (
    <div className="h-screen bg-white relative overflow-hidden">

      {/* Demo site — full viewport */}
      {demoSiteUrl ? (
        <iframe
          src={demoSiteUrl}
          className="w-full h-full border-0"
          title={demo.business_name}
        />
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-[17px] text-neutral-400">Your website is being prepared.</p>
          </div>
        </div>
      )}

      {/* ── CTA: just text ── */}
      {phase === 'viewing' && (
        <button
          onClick={() => setPhase('buying')}
          className={`
            fixed bottom-8 left-1/2 -translate-x-1/2 z-50
            bg-neutral-900 text-white
            px-7 py-3.5 rounded-full
            text-[15px] font-medium tracking-[-0.01em]
            shadow-[0_2px_20px_rgba(0,0,0,0.15)]
            hover:bg-neutral-800
            active:scale-[0.97]
            transition-all duration-200
            ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
          `}
          style={{ transitionProperty: 'opacity, transform, background-color', transitionDuration: visible ? '0.6s' : '0s' }}
        >
          Get this website
        </button>
      )}

      {/* ── Confirmation ── */}
      {phase === 'done' && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-7 py-3.5 rounded-full text-[15px] font-medium shadow-[0_2px_20px_rgba(0,0,0,0.15)]"
        >
          We&apos;ll be in touch{firstName ? `, ${firstName}` : ''}.
        </div>
      )}

      {/* ── Purchase sheet ── */}
      {phase === 'buying' && (
        <>
          <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setPhase('viewing')} />

          <div className="fixed bottom-0 inset-x-0 z-50 sheet-enter">
            <div className="bg-white rounded-t-[20px]">
              <div className="mx-auto max-w-[380px] px-6 pt-3 pb-10">

                {/* Drag handle */}
                <div className="w-9 h-[5px] bg-neutral-200 rounded-full mx-auto mb-8" />

                {/* Title */}
                <h2 className="text-[22px] font-semibold text-neutral-900 tracking-tight text-center mb-1">
                  Get this website
                </h2>
                <p className="text-[15px] text-neutral-400 text-center mb-8">
                  {'\u00A3'}350 setup{' '}<span className="text-neutral-300">·</span>{' '}{'\u00A3'}25/mo
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                  <div className="space-y-2 mb-6">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Name"
                      required
                      autoFocus
                      className="w-full bg-neutral-100 rounded-xl py-3.5 px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-900/5 transition-shadow"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="Phone"
                      required
                      className="w-full bg-neutral-100 rounded-xl py-3.5 px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-neutral-900/5 transition-shadow"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !name.trim() || !phone.trim()}
                    className="w-full bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-xl hover:bg-neutral-800 active:bg-neutral-700 disabled:opacity-30 transition-colors"
                  >
                    {submitting ? 'Sending...' : 'Continue'}
                  </button>

                  <p className="text-[13px] text-neutral-300 text-center mt-4">
                    We&apos;ll call to confirm. No payment taken now.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes sheetEnter {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .sheet-enter {
          animation: sheetEnter 0.45s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
}
