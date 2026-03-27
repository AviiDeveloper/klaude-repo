'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, MapPin } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    phone: '',
    area: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const steps = [
    { type: 'welcome' },
    { type: 'earnings' },
    { type: 'walkthrough' },
    { type: 'tools' },
    { type: 'input', field: 'name', title: 'What should we call you?', subtitle: 'Just your first name is fine' },
    { type: 'input', field: 'phone', title: 'Your phone number', subtitle: 'So we can reach you about leads and payouts' },
    { type: 'input', field: 'pin', title: 'Create a quick PIN', subtitle: '4 digits — use this with your name to log back in' },
    { type: 'input', field: 'area', title: 'What area do you cover?', subtitle: 'e.g. Manchester City Centre, Birmingham' },
    { type: 'agreement' },
    { type: 'done' },
  ];

  const handleNext = async () => {
    const step = steps[currentStep];

    if (step.type === 'agreement') {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            pin: formData.pin,
            phone: formData.phone,
            area_postcode: formData.area,
          }),
        });
        if (res.ok) {
          setCurrentStep(currentStep + 1);
        } else {
          const data = await res.json();
          console.error('Signup failed:', data.error);
        }
      } catch (err) {
        console.error('Signup failed', err);
      }
      return;
    }

    if (step.type === 'done') {
      router.push('/dashboard');
      return;
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] bg-gray-100 z-50">
        <div
          className="h-full bg-[#0071E3] transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Back Button */}
      {currentStep > 0 && currentStep < steps.length - 1 && (
        <button
          onClick={handleBack}
          className="fixed top-6 left-6 p-2 text-gray-400 hover:text-gray-900 transition-colors z-40"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">

          {/* Welcome */}
          {step.type === 'welcome' && (
            <div className="text-center">
              <h1 className="text-[clamp(32px,6vw,48px)] font-semibold text-gray-900 tracking-[-0.04em] leading-[1.05] mb-4">
                Start earning today
              </h1>
              <p className="text-[17px] text-gray-500 mb-14 tracking-[-0.01em]">
                Walk into businesses. Show them their new website. Earn £50 per sale.
              </p>
              <div className="space-y-4 max-w-sm mx-auto text-left">
                {[
                  { title: 'Flexible hours', body: 'Choose your own schedule, no shifts' },
                  { title: 'Instant earnings', body: '£50 commission per sale, paid weekly' },
                  { title: 'No experience needed', body: 'We give you scripts, demos, and support' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start py-4 border-b border-gray-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[13px] font-semibold text-gray-400 shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-gray-900 tracking-[-0.01em]">{item.title}</h3>
                      <p className="text-[13px] text-gray-500 mt-0.5">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Earnings Simulator */}
          {step.type === 'earnings' && (
            <div className="text-center">
              <h1 className="text-[clamp(28px,5vw,40px)] font-semibold text-gray-900 tracking-[-0.03em] leading-[1.1] mb-3">
                Real results, no promises
              </h1>
              <p className="text-[15px] text-gray-400 mb-10 tracking-[-0.01em]">
                Here's what our contractors have actually earned
              </p>
              <div className="bg-gray-50 rounded-2xl p-8 max-w-sm mx-auto text-left space-y-6">
                <div className="text-center pb-6 border-b border-gray-200">
                  <p className="text-[13px] text-gray-400 mb-1">Contractor earnings last month</p>
                  <p className="text-[40px] font-semibold text-gray-900 tracking-[-0.04em]">£50 – £800</p>
                  <p className="text-[12px] text-gray-400 mt-1">Results vary by effort, area, and approach</p>
                </div>
                <div className="space-y-4 text-[14px]">
                  <div className="flex gap-3">
                    <span className="text-gray-300 font-semibold shrink-0">—</span>
                    <p className="text-gray-600 leading-snug">Every closed sale pays <span className="font-semibold text-gray-900">£50 commission</span>, within 7 days</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-300 font-semibold shrink-0">—</span>
                    <p className="text-gray-600 leading-snug">No targets. No minimum hours. No shifts.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-gray-300 font-semibold shrink-0">—</span>
                    <p className="text-gray-600 leading-snug">Some contractors close one sale a week. Some close ten. It's entirely up to you.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Walkthrough */}
          {step.type === 'walkthrough' && (
            <div className="text-center">
              <h1 className="text-[clamp(28px,5vw,40px)] font-semibold text-gray-900 tracking-[-0.03em] leading-[1.1] mb-3">
                How a typical day works
              </h1>
              <p className="text-[15px] text-gray-400 mb-14 tracking-[-0.01em]">
                Four simple steps to success
              </p>
              <div className="space-y-8 max-w-sm mx-auto text-left">
                {[
                  { num: '01', title: 'Get your leads', desc: 'We send you local businesses that need websites' },
                  { num: '02', title: 'Walk in and pitch', desc: 'Show them their demo site on your phone' },
                  { num: '03', title: 'Handle objections', desc: 'Use our proven scripts and talking points' },
                  { num: '04', title: 'Close and earn', desc: '£50 in your account, they get their site' },
                ].map((item) => (
                  <div key={item.num} className="flex gap-6 items-start">
                    <span className="text-[36px] font-semibold text-gray-200 tracking-[-0.04em] leading-none shrink-0 w-[56px]">{item.num}</span>
                    <div className="pt-1">
                      <h3 className="text-[17px] font-semibold text-gray-900 tracking-[-0.02em] mb-1">{item.title}</h3>
                      <p className="text-[14px] text-gray-500 leading-[1.5]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {step.type === 'tools' && (
            <div className="text-center">
              <h1 className="text-[clamp(28px,5vw,40px)] font-semibold text-gray-900 tracking-[-0.03em] leading-[1.1] mb-3">
                Everything you need
              </h1>
              <p className="text-[15px] text-gray-400 mb-14 tracking-[-0.01em]">
                We provide all the tools to make sales easy
              </p>
              <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto text-left">
                {[
                  { title: 'AI-generated demos', desc: 'Custom previews for each business' },
                  { title: 'Objection handlers', desc: 'Ready answers for common pushback' },
                  { title: 'Local lead pipeline', desc: 'Curated list of businesses in your area' },
                  { title: 'Real-time dashboard', desc: 'Track visits, pitches, and earnings' },
                ].map((item, i) => (
                  <div key={i}>
                    <h3 className="text-[14px] font-semibold text-gray-900 tracking-[-0.01em] mb-1">{item.title}</h3>
                    <p className="text-[12px] text-gray-500 leading-[1.5]">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Fields */}
          {step.type === 'input' && (
            <div className="text-center">
              <h1 className="text-[clamp(28px,5vw,40px)] font-semibold text-gray-900 tracking-[-0.03em] leading-[1.1] mb-3">
                {step.title}
              </h1>
              <p className="text-[15px] text-gray-400 mb-12 tracking-[-0.01em]">
                {step.subtitle}
              </p>
              <div className="max-w-xs mx-auto">
                {step.field === 'name' && (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    autoFocus
                    className="w-full text-center text-[28px] font-light text-gray-900 placeholder:text-gray-300 bg-transparent border-b-2 border-gray-200 focus:border-[#0071E3] outline-none pb-4 transition-colors tracking-[-0.02em]"
                  />
                )}
                {step.field === 'phone' && (
                  <input
                    type="tel"
                    inputMode="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="07xxx xxx xxx"
                    autoFocus
                    className="w-full text-center text-[28px] font-light text-gray-900 placeholder:text-gray-300 bg-transparent border-b-2 border-gray-200 focus:border-[#0071E3] outline-none pb-4 transition-colors tracking-[-0.02em]"
                  />
                )}
                {step.field === 'pin' && (
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="••••"
                    autoFocus
                    className="w-full text-center text-[28px] font-light text-gray-900 placeholder:text-gray-300 bg-transparent border-b-2 border-gray-200 focus:border-[#0071E3] outline-none pb-4 transition-colors tracking-[0.3em]"
                  />
                )}
                {step.field === 'area' && (
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="e.g. Manchester City Centre"
                      autoFocus
                      className="w-full text-center text-[20px] font-light text-gray-900 placeholder:text-gray-300 bg-gray-50 border-2 border-gray-200 focus:border-[#0071E3] outline-none py-4 px-12 rounded-xl transition-colors tracking-[-0.01em]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agreement */}
          {step.type === 'agreement' && (
            <div className="text-center">
              <h1 className="text-[clamp(28px,5vw,40px)] font-semibold text-gray-900 tracking-[-0.03em] leading-[1.1] mb-3">
                One last thing
              </h1>
              <p className="text-[15px] text-gray-400 mb-10 tracking-[-0.01em]">
                Please read and confirm before we create your account
              </p>
              <div className="max-w-sm mx-auto">
                <div className="bg-gray-50 rounded-2xl p-6 text-left mb-6">
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    This is <span className="font-semibold text-gray-900">commission-only work</span>. There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd. Results depend entirely on your own effort and approach.
                  </p>
                </div>
                <label className="flex gap-3 items-start cursor-pointer text-left" onClick={() => setAgreedToTerms(!agreedToTerms)}>
                  <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                    agreedToTerms ? 'bg-[#0071E3] border-[#0071E3]' : 'border-gray-300 bg-white'
                  }`}>
                    {agreedToTerms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-[14px] text-gray-600 leading-snug">
                    I understand this is commission-only work. There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Done */}
          {step.type === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h1 className="text-[clamp(32px,6vw,48px)] font-semibold text-gray-900 tracking-[-0.04em] leading-[1.05] mb-3">
                You're in!
              </h1>
              <p className="text-[17px] text-gray-500 mb-8 tracking-[-0.01em]">
                Your dashboard is ready
              </p>
              <div className="bg-gray-50 rounded-2xl p-6 max-w-xs mx-auto">
                <p className="text-[15px] text-gray-900 font-medium mb-1">Welcome, {formData.name}!</p>
                <p className="text-[13px] text-gray-500 mb-4">
                  Your dashboard is ready with fresh leads in {formData.area}
                </p>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <p className="text-[11px] text-gray-400">To log back in, use:</p>
                  <p className="text-[13px] text-gray-600 mt-1 font-medium">Name: {formData.name} · PIN: ••••</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-12 flex justify-center">
            <button
              onClick={handleNext}
              disabled={
                (step.field === 'name' && !formData.name) ||
                (step.field === 'phone' && !formData.phone) ||
                (step.field === 'pin' && formData.pin.length !== 4) ||
                (step.field === 'area' && !formData.area) ||
                (step.type === 'agreement' && !agreedToTerms)
              }
              className="bg-[#0071E3] text-white px-8 py-3.5 rounded-full text-[15px] font-medium hover:bg-[#0077ED] transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-2 group"
            >
              {currentStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Skip to Login */}
          {currentStep === 0 && (
            <div className="mt-6 text-center">
              <a href="/login" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">
                Already have an account? Sign in
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {steps.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              index === currentStep ? 'w-8 bg-[#0071E3]' : 'w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
