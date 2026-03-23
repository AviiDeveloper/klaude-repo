'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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
  const [step, setStep] = useState(0); // 0: intro, 1: name, 2: phone, 3: changes, 4: confirm
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

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

  async function handlePurchase() {
    setSubmitting(true);
    try {
      await fetch(`/api/demo-links/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), notes: notes.trim() || undefined }),
      });
    } catch { /* */ }
    setSubmitting(false);
    setPhase('done');
  }

  function nextStep() {
    if (step === 0) setStep(1);
    else if (step === 1 && name.trim()) setStep(2);
    else if (step === 2 && phone.trim()) setStep(3);
    else if (step === 3) setStep(4);
    else if (step === 4) handlePurchase();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); nextStep(); }
  }

  if (loading) {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-neutral-200 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-white flex items-center justify-center px-8">
        <div className="text-center max-w-[280px]">
          <p className="text-[28px] font-semibold tracking-[-0.03em] text-neutral-900 mb-2.5 leading-[1.1]">
            {error === 'expired' ? 'This link has expired.' : 'Link not found.'}
          </p>
          <p className="text-[14px] text-neutral-400 leading-relaxed">
            Ask the person who sent this for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  const demoSiteUrl = demo.demo_domain ? `/demo-sites/${demo.demo_domain}.html` : null;
  const firstName = name.split(' ')[0];

  // Step validation
  const canProceed = step === 0 || (step === 1 && name.trim().length > 0) || (step === 2 && phone.trim().length > 0) || step === 3 || step === 4;

  return (
    <div className="h-screen bg-neutral-100 relative overflow-hidden">

      {/* Demo site — full viewport */}
      {demoSiteUrl ? (
        <iframe
          src={demoSiteUrl}
          className="w-full h-full border-0"
          title={demo.business_name}
        />
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-[15px] text-neutral-400 tracking-[-0.01em]">
            Your website is being prepared.
          </p>
        </div>
      )}

      {/* ── CTA button ── */}
      {phase === 'viewing' && (
        <button
          onClick={() => { setPhase('buying'); setStep(0); }}
          className="fixed bottom-8 left-1/2 z-50 flex items-center gap-2.5 bg-neutral-900/95 backdrop-blur-sm text-white pl-5 pr-4 py-3 rounded-full text-[14px] font-medium tracking-[-0.01em] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.18)] hover:bg-neutral-800/95 active:scale-[0.97] transition-all"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible
              ? 'translateX(-50%) translateY(0)'
              : 'translateX(-50%) translateY(10px)',
            transition: visible
              ? 'opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1), background-color 0.15s'
              : 'none',
          }}
        >
          <span>Get this website</span>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-[12px] leading-none">↗</span>
        </button>
      )}

      {/* ── Confirmation ── */}
      {phase === 'done' && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-neutral-900/95 backdrop-blur-sm text-white pl-4 pr-5 py-3 rounded-full text-[14px] font-medium tracking-[-0.01em] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_32px_rgba(0,0,0,0.18)] confirm-enter">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/90 text-[11px] shrink-0">✓</span>
          <span>Order received{firstName ? `, ${firstName}` : ''}.</span>
        </div>
      )}

      {/* ── Multi-step card ── */}
      {phase === 'buying' && (
        <>
          <div className="fixed inset-0 z-40 bg-black/10 overlay-enter" onClick={() => setPhase('viewing')} />

          <div className="fixed bottom-4 inset-x-4 md:bottom-6 md:left-auto md:right-6 md:max-w-[380px] z-50 sheet-enter">
            <div className="bg-white rounded-[20px] shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_8px_40px_rgba(0,0,0,0.14)] overflow-hidden">

              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 pt-5 pb-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className={`h-[3px] rounded-full transition-all duration-300 ${
                      i === step ? 'w-5 bg-neutral-900' : i < step ? 'w-2 bg-neutral-900' : 'w-2 bg-neutral-200'
                    }`}
                  />
                ))}
              </div>

              <div className="px-6 pt-5 pb-6">

                {/* ── Step 0: Intro ── */}
                {step === 0 && (
                  <div className="text-center step-content">
                    <p className="text-[11px] font-medium tracking-[0.08em] uppercase text-neutral-400 mb-2">
                      {demo.business_name}
                    </p>
                    <h2 className="text-[22px] font-semibold text-neutral-900 tracking-[-0.03em] leading-tight mb-1">
                      Make it yours.
                    </h2>
                    <p className="text-[14px] text-neutral-400 mb-6">
                      Your own website, live in 48 hours.
                    </p>
                    <div className="flex items-center justify-center gap-4 mb-7">
                      <div className="text-center">
                        <p className="text-[20px] font-semibold text-neutral-900 tracking-tight">{'\u00A3'}350</p>
                        <p className="text-[11px] text-neutral-400">one-time setup</p>
                      </div>
                      <div className="w-px h-8 bg-neutral-100" />
                      <div className="text-center">
                        <p className="text-[20px] font-semibold text-neutral-900 tracking-tight">{'\u00A3'}25<span className="text-neutral-300 font-normal text-[14px]">/mo</span></p>
                        <p className="text-[11px] text-neutral-400">hosting &amp; support</p>
                      </div>
                    </div>
                    <button onClick={nextStep} className="w-full bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-[14px] hover:bg-neutral-800 active:bg-neutral-700 transition-colors">
                      I&apos;m interested
                    </button>
                  </div>
                )}

                {/* ── Step 1: Name ── */}
                {step === 1 && (
                  <div className="step-content">
                    <p className="text-[13px] text-neutral-400 mb-1">Step 1 of 4</p>
                    <h2 className="text-[20px] font-semibold text-neutral-900 tracking-[-0.02em] mb-6">
                      What&apos;s your name?
                    </h2>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Full name"
                      autoFocus
                      className="w-full bg-transparent border-b border-neutral-200 py-3 text-[17px] text-neutral-900 placeholder:text-neutral-300 outline-none focus:border-neutral-900 transition-colors"
                    />
                    <div className="flex gap-2 mt-8">
                      <button onClick={() => setStep(0)} className="px-5 py-3 text-[14px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">Back</button>
                      <button onClick={nextStep} disabled={!name.trim()} className="flex-1 bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-[14px] hover:bg-neutral-800 disabled:opacity-20 transition-all">
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 2: Phone ── */}
                {step === 2 && (
                  <div className="step-content">
                    <p className="text-[13px] text-neutral-400 mb-1">Step 2 of 4</p>
                    <h2 className="text-[20px] font-semibold text-neutral-900 tracking-[-0.02em] mb-6">
                      Best number to reach you?
                    </h2>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Phone number"
                      autoFocus
                      className="w-full bg-transparent border-b border-neutral-200 py-3 text-[17px] text-neutral-900 placeholder:text-neutral-300 outline-none focus:border-neutral-900 transition-colors"
                    />
                    <div className="flex gap-2 mt-8">
                      <button onClick={() => setStep(1)} className="px-5 py-3 text-[14px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">Back</button>
                      <button onClick={nextStep} disabled={!phone.trim()} className="flex-1 bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-[14px] hover:bg-neutral-800 disabled:opacity-20 transition-all">
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Changes ── */}
                {step === 3 && (
                  <div className="step-content">
                    <p className="text-[13px] text-neutral-400 mb-1">Step 3 of 4</p>
                    <h2 className="text-[20px] font-semibold text-neutral-900 tracking-[-0.02em] mb-2">
                      Any changes you&apos;d like?
                    </h2>
                    <p className="text-[13px] text-neutral-400 mb-6">Optional — we can discuss later too.</p>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. add online booking, different colours, a price list page..."
                      rows={3}
                      autoFocus
                      className="w-full bg-transparent border-b border-neutral-200 py-3 text-[15px] text-neutral-900 placeholder:text-neutral-300 outline-none focus:border-neutral-900 transition-colors resize-none"
                    />
                    <div className="flex gap-2 mt-8">
                      <button onClick={() => setStep(2)} className="px-5 py-3 text-[14px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">Back</button>
                      <button onClick={nextStep} className="flex-1 bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-[14px] hover:bg-neutral-800 transition-all">
                        {notes.trim() ? 'Continue' : 'Skip'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 4: Confirm ── */}
                {step === 4 && (
                  <div className="step-content">
                    <p className="text-[13px] text-neutral-400 mb-1">Step 4 of 4</p>
                    <h2 className="text-[20px] font-semibold text-neutral-900 tracking-[-0.02em] mb-6">
                      Confirm your order
                    </h2>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-neutral-400">Name</span>
                        <span className="text-[14px] text-neutral-900 font-medium">{name}</span>
                      </div>
                      <div className="h-px bg-neutral-100" />
                      <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-neutral-400">Phone</span>
                        <span className="text-[14px] text-neutral-900 font-medium">{phone}</span>
                      </div>
                      {notes.trim() && (
                        <>
                          <div className="h-px bg-neutral-100" />
                          <div className="flex justify-between items-start">
                            <span className="text-[13px] text-neutral-400 shrink-0">Changes</span>
                            <span className="text-[13px] text-neutral-600 text-right ml-4">{notes}</span>
                          </div>
                        </>
                      )}
                      <div className="h-px bg-neutral-100" />
                      <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-neutral-400">Total</span>
                        <span className="text-[16px] text-neutral-900 font-semibold">{'\u00A3'}350</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[13px] text-neutral-400">Monthly</span>
                        <span className="text-[14px] text-neutral-600">{'\u00A3'}25/mo</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setStep(3)} className="px-5 py-3 text-[14px] font-medium text-neutral-400 hover:text-neutral-600 transition-colors">Back</button>
                      <button onClick={handlePurchase} disabled={submitting} className="flex-1 bg-neutral-900 text-white text-[15px] font-medium py-3.5 rounded-[14px] hover:bg-neutral-800 disabled:opacity-50 transition-all">
                        {submitting ? 'Processing\u2026' : 'Purchase'}
                      </button>
                    </div>

                    <p className="text-[11px] text-neutral-300 text-center mt-4">
                      Your site goes live within 48 hours.
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes sheetEnter {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .sheet-enter { animation: sheetEnter 0.5s cubic-bezier(0.32, 0.72, 0, 1); }

        @keyframes overlayEnter {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .overlay-enter { animation: overlayEnter 0.3s ease; }

        @keyframes confirmEnter {
          from { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.97); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .confirm-enter { animation: confirmEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1); }

        .step-content {
          animation: stepIn 0.25s ease-out;
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
