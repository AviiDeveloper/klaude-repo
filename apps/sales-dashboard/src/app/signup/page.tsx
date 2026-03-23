'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ArrowRight, ArrowLeft, Loader2, MapPin, Briefcase, MessageCircle,
  Zap, Check, Monitor, Shield, Clock, TrendingUp, Star, Phone,
  CalendarDays, Target, ChevronRight, Smartphone, DollarSign,
  Users, BarChart3,
} from 'lucide-react';

// Step indices
const STEP_WELCOME = 0;
const STEP_EARNINGS = 1;
const STEP_DAY = 2;
const STEP_TOOLS = 3;
const STEP_NAME = 4;
const STEP_PIN = 5;
const STEP_AREA = 6;
const STEP_DONE = 7;
const TOTAL_STEPS = 8;

export default function SignupPage() {
  const [step, setStep] = useState(STEP_WELCOME);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [postcode, setPostcode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Earnings calculator state
  const [visitsPerDay, setVisitsPerDay] = useState(5);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [closeRate, setCloseRate] = useState(20);

  const weeklySales = Math.round(visitsPerDay * daysPerWeek * (closeRate / 100));
  const weeklyEarnings = weeklySales * 50;
  const monthlyEarnings = weeklyEarnings * 4;
  // Commission is flat £50 per sale

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [step]);

  function next() {
    setError('');
    if (step === STEP_NAME) {
      if (name.trim().length <= 1) { setError('Name must be at least 2 characters'); return; }
    }
    if (step === STEP_PIN) {
      if (!/^\d{4,6}$/.test(pin)) { setError('PIN must be 4-6 digits'); return; }
      if (pin !== pinConfirm) { setError('PINs don\'t match'); return; }
    }
    if (step === STEP_AREA) {
      if (postcode.trim().length <= 1) { setError('Enter your area postcode'); return; }
      handleSignup();
      return;
    }
    setStep(step + 1);
  }

  function back() {
    if (step > 0) { setError(''); setStep(step - 1); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); next(); }
  }

  async function handleSignup() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), pin, area_postcode: postcode.trim(), phone: phone.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (res.status === 409) setStep(STEP_NAME);
        setLoading(false);
        return;
      }
      setStep(STEP_DONE);
    } catch (_err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  // Progress bar (only shows during info + form steps)
  const showProgress = step !== STEP_DONE;
  const progressPct = step !== STEP_DONE ? ((step + 1) / TOTAL_STEPS) * 100 : 100;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar */}
      {showProgress && (
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-slate-900 transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg">

          {/* ── STEP 0: Welcome ── */}
          {step === STEP_WELCOME && (
            <Slide>
              <div className="flex items-center gap-2.5 mb-8">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-slate-900">SalesFlow</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-[0.15em]">Join the team</div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-3 leading-tight">
                Earn money selling websites to local businesses
              </h1>
              <p className="text-[15px] text-slate-500 mb-10 leading-relaxed">
                We find businesses that need websites, build demo sites for them, and you walk in and close the deal. No experience needed.
              </p>

              <div className="space-y-4 mb-10">
                <ValueProp icon={MapPin} title="Leads delivered to you" desc="Businesses in your area that don't have websites — with ratings, reviews, and contact info." />
                <ValueProp icon={Monitor} title="Demo sites already built" desc="Show them a real website on your phone. Built with their branding, services, and reviews." />
                <ValueProp icon={Briefcase} title="Everything you need to pitch" desc="Talking points, objection scripts, pricing breakdowns. Just walk in and talk." />
                <ValueProp icon={TrendingUp} title="Commission that grows" desc="£50 per sale. Simple, flat rate. Your income grows with every deal you close." />
              </div>

              <CtaButton onClick={next} label="See how much you could earn" />
              <BottomLink href="/login" text="Already have an account?" link="Sign in" />
            </Slide>
          )}

          {/* ── STEP 1: Earnings Simulator ── */}
          {step === STEP_EARNINGS && (
            <Slide>
              <BackButton onClick={back} />
              <SectionTag text="Your potential" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How much could you earn?</h2>
              <p className="text-[13px] text-slate-400 mb-8">Adjust the sliders to see your projected earnings.</p>

              <div className="space-y-6 mb-8">
                <SliderInput label="Visits per day" value={visitsPerDay} min={1} max={15} onChange={setVisitsPerDay} suffix="businesses" />
                <SliderInput label="Days per week" value={daysPerWeek} min={1} max={7} onChange={setDaysPerWeek} suffix="days" />
                <SliderInput label="Close rate" value={closeRate} min={5} max={50} onChange={setCloseRate} suffix="%" />
              </div>

              <div className="bg-slate-900 rounded-2xl p-6 mb-8">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white tabular-nums">{weeklySales}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Sales / week</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-emerald-400 tabular-nums">£{weeklySales * 50}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Weekly earnings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-400 tabular-nums">£{monthlyEarnings}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Monthly earnings</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 text-center">
                  <div className="text-[11px] text-slate-500">£50 flat commission per sale</div>
                </div>
              </div>

              <CtaButton onClick={next} label="See a typical day" />
            </Slide>
          )}

          {/* ── STEP 2: Day in the Life ── */}
          {step === STEP_DAY && (
            <Slide>
              <BackButton onClick={back} />
              <SectionTag text="A typical day" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How it works in practice</h2>
              <p className="text-[13px] text-slate-400 mb-8">Here's what a day looks like as a SalesFlow contractor.</p>

              <div className="space-y-0">
                <TimelineItem time="9:00am" icon={Smartphone} title="Open the app" desc="See your leads sorted by distance. Pick the nearest business." first />
                <TimelineItem time="9:15am" icon={MapPin} title="Walk to the business" desc="The app shows you the address, what they do, their rating, and hours." />
                <TimelineItem time="9:20am" icon={MessageCircle} title="Talk to the owner" desc="Use the talking points we give you. Mention their reviews, services." />
                <TimelineItem time="9:25am" icon={Monitor} title="Show the demo" desc="Pull up the website we built using their real business data. Full screen on your phone." />
                <TimelineItem time="9:30am" icon={Shield} title="Handle objections" desc={'"Too expensive?" \u2014 the app has scripted responses for every common objection.'} />
                <TimelineItem time="9:35am" icon={Check} title="Close the deal" desc={"Mark as sold in the app. \u00A350 commission earned. Move to the next lead."} last />
              </div>

              <div className="mt-8">
                <CtaButton onClick={next} label="See what tools you get" />
              </div>
            </Slide>
          )}

          {/* ── STEP 3: Tools ── */}
          {step === STEP_TOOLS && (
            <Slide>
              <BackButton onClick={back} />
              <SectionTag text="Your toolkit" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Everything you need, in your pocket</h2>
              <p className="text-[13px] text-slate-400 mb-8">The app handles the hard part. You just need to show up.</p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <ToolCard icon={Monitor} title="AI Demo Sites" desc="Custom websites built for each business using their real data" />
                <ToolCard icon={MessageCircle} title="Talking Points" desc="Key things to say, what to avoid, best time to visit" />
                <ToolCard icon={Shield} title="Objection Scripts" desc="6 scripted responses for common pushbacks" />
                <ToolCard icon={DollarSign} title="Price Breakdown" desc="Show clients exactly what they get for £350 + £25/mo" />
                <ToolCard icon={CalendarDays} title="Follow-up Reminders" desc="Set callbacks so you never forget to chase a lead" />
                <ToolCard icon={BarChart3} title="Commission Tracker" desc="See your earnings, pipeline, and conversion rate" />
                <ToolCard icon={Users} title="Contact Capture" desc="Save who you spoke to and their role" />
                <ToolCard icon={MapPin} title="Area Routing" desc="Leads grouped by postcode with directions" />
              </div>

              <CtaButton onClick={next} label="Create your account" />
            </Slide>
          )}

          {/* ── STEP 4: Name ── */}
          {step === STEP_NAME && (
            <Slide>
              <BackButton onClick={back} />
              <FormStepLabel number={1} total={3} />
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
              <FormNextButton onClick={next} disabled={name.trim().length <= 1} />
            </Slide>
          )}

          {/* ── STEP 5: PIN ── */}
          {step === STEP_PIN && (
            <Slide>
              <BackButton onClick={back} />
              <FormStepLabel number={2} total={3} />
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
              <FormNextButton onClick={next} disabled={pin.length <= 3 || pinConfirm.length <= 3} />
            </Slide>
          )}

          {/* ── STEP 6: Area ── */}
          {step === STEP_AREA && (
            <Slide>
              <BackButton onClick={back} />
              <FormStepLabel number={3} total={3} />
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
                placeholder="Phone number (optional)"
                className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-[15px] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all mt-3"
              />
              {error && <p className="text-red-500 text-[12px] mt-2">{error}</p>}
              <FormNextButton onClick={next} disabled={postcode.trim().length <= 1 || loading} loading={loading} label="Create account" />
            </Slide>
          )}

          {/* ── STEP 7: Done ── */}
          {step === STEP_DONE && (
            <Slide>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">You're in, {name}!</h2>
                <p className="text-[14px] text-slate-400 mb-8">Your account is ready. Leads will appear as they're assigned to your area.</p>

                <div className="bg-slate-50 rounded-2xl px-6 py-5 mb-8 text-left space-y-3">
                  <SummaryRow label="Name" value={name} />
                  <SummaryRow label="Area" value={postcode} />
                  <SummaryRow label="Commission" value="£50 per sale" />
                </div>

                <button
                  onClick={() => { window.location.href = '/dashboard'; }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  Open Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </Slide>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable sub-components ───────────────────────────────────

function Slide({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-600 mb-6 transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Back
    </button>
  );
}

function SectionTag({ text }: { text: string }) {
  return <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-[0.12em] mb-3 block">{text}</span>;
}

function FormStepLabel({ number, total }: { number: number; total: number }) {
  return <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-[0.1em] mb-3 block">Step {number} of {total}</span>;
}

function CtaButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
      {label} <ArrowRight className="w-4 h-4" />
    </button>
  );
}

function FormNextButton({ onClick, disabled, loading, label }: { onClick: () => void; disabled: boolean; loading?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full mt-6 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[14px] font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{label ?? 'Continue'} <ArrowRight className="w-4 h-4" /></>}
    </button>
  );
}

function BottomLink({ href, text, link }: { href: string; text: string; link: string }) {
  return (
    <p className="text-[11px] text-slate-400 text-center mt-6">
      {text} <a href={href} className="text-slate-700 font-medium hover:underline">{link}</a>
    </p>
  );
}

function ValueProp({ icon: Icon, title, desc }: { icon: typeof MapPin; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4.5 h-4.5 text-slate-500" />
      </div>
      <div>
        <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
        <p className="text-[12px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function SliderInput({ label, value, min, max, onChange, suffix }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-slate-600 font-medium">{label}</span>
        <span className="text-[14px] font-semibold text-slate-900 tabular-nums">{value} {suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-900"
      />
    </div>
  );
}

function TimelineItem({ time, icon: Icon, title, desc, first, last }: {
  time: string; icon: typeof MapPin; title: string; desc: string; first?: boolean; last?: boolean;
}) {
  return (
    <div className="flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center w-12 flex-shrink-0">
        <span className="text-[10px] text-slate-400 tabular-nums font-medium">{time}</span>
        <div className={`w-px flex-1 ${last ? '' : 'bg-slate-200'}`} />
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 pb-6">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div>
          <h4 className="text-[13px] font-semibold text-slate-900">{title}</h4>
          <p className="text-[12px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ icon: Icon, title, desc }: { icon: typeof MapPin; title: string; desc: string }) {
  return (
    <div className="border border-slate-100 rounded-xl p-4">
      <Icon className="w-4 h-4 text-slate-400 mb-2.5" />
      <h4 className="text-[12px] font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
    </div>
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
