'use client';

import { useState, useRef, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Loader2, MapPin, Briefcase, MessageCircle, Zap, Check } from 'lucide-react';

const TOTAL_STEPS = 5; // 0-4

export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [postcode, setPostcode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus input on step change
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [step]);

  function next() {
    setError('');

    if (step === 1) {
      if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return; }
    }
    if (step === 2) {
      if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4-6 digits'); return; }
      if (pin !== pinConfirm) { setError('PINs don\'t match'); return; }
    }
    if (step === 3) {
      if (postcode.trim().length < 2) { setError('Enter your area postcode'); return; }
    }

    if (step === 3) {
      // Final step — submit
      handleSignup();
    } else {
      setStep(step + 1);
    }
  }

  function back() {
    if (step > 0) {
      setError('');
      setStep(step - 1);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      next();
    }
  }

  async function handleSignup() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          pin: pin.trim(),
          area_postcode: postcode.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        // Go back to the relevant step if it's a name conflict
        if (res.status === 409) setStep(1);
        return;
      }

      // Success — move to confirmation step
      setStep(4);
      setLoading(false);
    } catch {
      setError('Connection error — try again');
      setLoading(false);
    }
  }

  // Progress dots
  const progress = (
    <div className="flex items-center justify-center gap-2 mb-10">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all duration-300 ${
            i === step ? 'w-6 bg-slate-900' :
            i < step ? 'w-3 bg-slate-400' :
            'w-3 bg-slate-200'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-md">
        {step > 0 && step < 4 && progress}

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-slate-900">SalesFlow</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest">Join the team</div>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Earn commission selling websites
            </h1>
            <p className="text-[14px] text-slate-500 mb-10 leading-relaxed">
              Walk into local businesses, show them a demo site we've already built, and earn money for every sale.
            </p>

            <div className="space-y-5 mb-10">
              <HowItWorksItem
                icon={MapPin}
                title="Get assigned leads"
                desc="Businesses near you that don't have websites — with all the info you need."
              />
              <HowItWorksItem
                icon={MessageCircle}
                title="Walk in and pitch"
                desc="We give you talking points, a demo site to show, and answers to objections."
              />
              <HowItWorksItem
                icon={Briefcase}
                title="Earn commission"
                desc="£35 per sale upfront + £2.50/month recurring. Work when you want."
              />
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Get started
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-[11px] text-slate-400 text-center mt-6">
              Already have an account? <a href="/login" className="text-slate-700 font-medium hover:underline">Sign in</a>
            </p>
          </div>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <StepContainer onBack={back}>
            <StepLabel number={1} total={3} />
            <h2 className="text-xl font-bold text-slate-900 mb-1">What should we call you?</h2>
            <p className="text-[13px] text-slate-400 mb-6">This is how you'll appear in the app.</p>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your first name"
              autoCapitalize="words"
              autoComplete="given-name"
              className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-[15px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
            />
            {error && <p className="text-red-500 text-[12px] mt-2">{error}</p>}
            <NextButton onClick={next} disabled={name.trim().length < 2} />
          </StepContainer>
        )}

        {/* Step 2: PIN */}
        {step === 2 && (
          <StepContainer onBack={back}>
            <StepLabel number={2} total={3} />
            <h2 className="text-xl font-bold text-slate-900 mb-1">Create a quick PIN</h2>
            <p className="text-[13px] text-slate-400 mb-6">4-6 digits. You'll use this to sign in.</p>
            <div className="space-y-3">
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="Enter PIN"
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-[15px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all tracking-[0.3em] text-center"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="Confirm PIN"
                autoComplete="new-password"
                className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-[15px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all tracking-[0.3em] text-center"
              />
            </div>
            {error && <p className="text-red-500 text-[12px] mt-2">{error}</p>}
            <NextButton onClick={next} disabled={pin.length < 4 || pinConfirm.length < 4} />
          </StepContainer>
        )}

        {/* Step 3: Area */}
        {step === 3 && (
          <StepContainer onBack={back}>
            <StepLabel number={3} total={3} />
            <h2 className="text-xl font-bold text-slate-900 mb-1">What area do you cover?</h2>
            <p className="text-[13px] text-slate-400 mb-6">We'll assign businesses near this postcode.</p>
            <input
              ref={inputRef}
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. M1, M4, LS1"
              autoCapitalize="characters"
              className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-[15px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-[15px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all mt-3"
            />
            {error && <p className="text-red-500 text-[12px] mt-2">{error}</p>}
            <NextButton onClick={next} disabled={postcode.trim().length < 2 || loading} loading={loading} label="Create account" />
          </StepContainer>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="animate-fade-in text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">You're in, {name}!</h2>
            <p className="text-[13px] text-slate-400 mb-8">Your account is ready. Leads will appear as they're assigned to your area.</p>

            <div className="bg-slate-50 rounded-xl px-5 py-4 mb-8 text-left space-y-2">
              <SummaryRow label="Name" value={name} />
              <SummaryRow label="Area" value={postcode} />
              <SummaryRow label="Commission" value="10% per sale" />
              <SummaryRow label="Per sale" value="£35 upfront + £2.50/mo" />
            </div>

            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function HowItWorksItem({ icon: Icon, title, desc }: { icon: typeof MapPin; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        <p className="text-[12px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function StepContainer({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>
      {children}
    </div>
  );
}

function StepLabel({ number, total }: { number: number; total: number }) {
  return (
    <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-[0.1em] mb-3 block">
      Step {number} of {total}
    </span>
  );
}

function NextButton({ onClick, disabled, loading, label }: { onClick: () => void; disabled: boolean; loading?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full mt-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[14px] font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {label ?? 'Continue'}
          <ArrowRight className="w-4 h-4" />
        </>
      )}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-slate-400">{label}</span>
      <span className="text-[13px] font-medium text-slate-900">{value}</span>
    </div>
  );
}
