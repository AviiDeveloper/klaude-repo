'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Check, TrendingUp, MapPin, Wallet, Zap, Users } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    area: '',
    visitsPerWeek: 10,
  });

  const projectedEarnings = formData.visitsPerWeek * 50 * 4; // £50 per sale * 4 weeks

  const steps = [
    {
      type: 'welcome',
      title: 'Start earning today',
      subtitle: 'Walk into businesses. Show them their new website. Earn £50 per sale.',
      icon: TrendingUp,
    },
    {
      type: 'earnings',
      title: 'Set your own income',
      subtitle: 'Choose how many visits you make per week',
      icon: Wallet,
    },
    {
      type: 'walkthrough',
      title: 'How a typical day works',
      subtitle: 'Four simple steps to success',
      icon: Zap,
    },
    {
      type: 'tools',
      title: 'Everything you need',
      subtitle: 'We provide all the tools to make sales easy',
      icon: Users,
    },
    {
      type: 'input',
      field: 'name',
      title: 'What should we call you?',
      subtitle: 'Just your first name is fine',
    },
    {
      type: 'input',
      field: 'pin',
      title: 'Create a quick PIN',
      subtitle: '4 digits to secure your account',
    },
    {
      type: 'input',
      field: 'area',
      title: 'What area do you cover?',
      subtitle: 'e.g. Manchester City Centre, Birmingham',
    },
    {
      type: 'done',
      title: "You're in!",
      subtitle: 'Your dashboard is ready',
      icon: Check,
    },
  ];

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Submit signup
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Signup failed', err);
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  return (
    <div className="min-h-screen flex flex-col page-enter">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#222] z-50">
        <div
          className="h-full bg-white transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Back Button */}
      {currentStep > 0 && currentStep < steps.length - 1 && (
        <button
          onClick={handleBack}
          className="fixed top-6 left-6 p-2 text-[#666] hover:text-white transition-colors z-40"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Icon */}
          {Icon && (
            <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white">
                <Icon className="w-8 h-8 text-amber-400" />
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-semibold text-white text-center mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            {step.title}
          </h1>

          {/* Subtitle */}
          <p className="text-[17px] text-[#666] text-center mb-12 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
            {step.subtitle}
          </p>

          {/* Step Content */}
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Welcome */}
            {step.type === 'welcome' && (
              <div className="space-y-6 max-w-md mx-auto">
                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <span className="text-2xl">💼</span>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-medium text-white mb-1">Be your own boss</h3>
                      <p className="text-[13px] text-[#666]">Work when you want, where you want</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-medium text-white mb-1">Instant earnings</h3>
                      <p className="text-[13px] text-[#666]">£50 commission per sale, paid weekly</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <span className="text-2xl">🚀</span>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-medium text-white mb-1">No experience needed</h3>
                      <p className="text-[13px] text-[#666]">We give you scripts, demos, and support</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Earnings Simulator */}
            {step.type === 'earnings' && (
              <div className="max-w-md mx-auto">
                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-8">
                  <label className="block text-[13px] text-[#999] mb-4">Visits per week</label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={formData.visitsPerWeek}
                    onChange={(e) => setFormData({ ...formData, visitsPerWeek: parseInt(e.target.value) })}
                    className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer accent-white"
                  />
                  <div className="flex justify-between mt-2 text-[11px] text-[#666]">
                    <span>5</span>
                    <span>30</span>
                  </div>

                  <div className="mt-8 pt-8 border-t border-[#222]">
                    <div className="text-center">
                      <p className="text-[13px] text-[#999] mb-2">Projected monthly earnings</p>
                      <p className="text-5xl font-semibold text-white font-mono">£{projectedEarnings.toLocaleString()}</p>
                      <p className="text-[13px] text-[#666] mt-2">
                        {formData.visitsPerWeek} visits/week × £50 × 4 weeks
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Walkthrough */}
            {step.type === 'walkthrough' && (
              <div className="space-y-4 max-w-md mx-auto">
                {[
                  { num: '1', title: 'Get your leads', desc: 'We send you local businesses that need websites' },
                  { num: '2', title: 'Walk in & pitch', desc: 'Show them their demo site on your phone' },
                  { num: '3', title: 'Handle objections', desc: 'Use our proven scripts and talking points' },
                  { num: '4', title: 'Close & earn', desc: '£50 in your account, they get their site' },
                ].map((item) => (
                  <div key={item.num} className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6 flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center text-[13px] font-semibold">
                      {item.num}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-medium text-white mb-1">{item.title}</h3>
                      <p className="text-[13px] text-[#666]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tools */}
            {step.type === 'tools' && (
              <div className="space-y-4 max-w-md mx-auto">
                {[
                  { icon: '🎨', title: 'AI-generated demo sites', desc: 'Custom previews for each business' },
                  { icon: '💬', title: 'Objection handlers', desc: 'Ready answers for common pushback' },
                  { icon: '📍', title: 'Local lead pipeline', desc: 'Curated list of businesses in your area' },
                  { icon: '📊', title: 'Real-time dashboard', desc: 'Track visits, pitches, and earnings' },
                ].map((item) => (
                  <div key={item.title} className="bg-[#0a0a0a] rounded-xl border border-[#333] p-6 flex items-start gap-4">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <h3 className="text-[15px] font-medium text-white mb-1">{item.title}</h3>
                      <p className="text-[13px] text-[#666]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Input Fields */}
            {step.type === 'input' && (
              <div className="max-w-md mx-auto">
                {step.field === 'name' && (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    autoFocus
                    className="w-full text-center text-3xl font-light text-white placeholder:text-[#333] bg-transparent border-b-2 border-[#333] focus:border-white outline-none pb-4 transition-colors"
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
                    className="w-full text-center text-3xl font-light text-white placeholder:text-[#333] bg-transparent border-b-2 border-[#333] focus:border-white outline-none pb-4 transition-colors tracking-widest"
                  />
                )}

                {step.field === 'area' && (
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666]" />
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="e.g. Manchester City Centre"
                      autoFocus
                      className="w-full text-center text-2xl font-light text-white placeholder:text-[#333] bg-[#0a0a0a] border-2 border-[#333] focus:border-white outline-none py-4 px-12 rounded-xl transition-colors"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Done */}
            {step.type === 'done' && (
              <div className="max-w-md mx-auto text-center">
                <div className="bg-[#0a0a0a] rounded-xl border border-[#333] p-8">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-[15px] text-[#999] mb-4">Welcome to SalesFlow, {formData.name}!</p>
                  <p className="text-[13px] text-[#666]">
                    Your dashboard is ready with fresh leads in {formData.area}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="mt-12 flex justify-center animate-in fade-in duration-500 delay-300">
            <button
              onClick={handleNext}
              disabled={
                (step.field === 'name' && !formData.name) ||
                (step.field === 'pin' && formData.pin.length !== 4) ||
                (step.field === 'area' && !formData.area)
              }
              className="bg-white text-black px-8 py-4 rounded-lg text-[15px] font-medium hover:bg-[#ededed] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center group"
            >
              {currentStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Skip to Login */}
          {currentStep === 0 && (
            <div className="mt-8 text-center">
              <a href="/login" className="text-[13px] text-[#666] hover:text-white transition-colors">
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
              index === currentStep ? 'w-8 bg-white' : 'w-1.5 bg-[#333]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
