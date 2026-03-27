'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ArrowRight, MapPin, Smartphone, BookOpen, Banknote } from 'lucide-react';

const faqs = [
  {
    q: 'Do I need sales experience?',
    a: 'No experience needed. We provide scripts, demo tools, and objection handlers so you can pitch confidently from day one.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'Commission is paid weekly via bank transfer. Every confirmed sale pays £50, usually within 7 days.',
  },
  {
    q: 'What do I actually sell?',
    a: 'Professional websites for local businesses — takeaways, salons, tradespeople, retailers. We generate a custom demo for each business before you even walk in.',
  },
  {
    q: 'Is there a contract or minimum commitment?',
    a: "No contract, no minimum hours, no shifts. You work when and where you want. It's entirely self-directed.",
  },
  {
    q: 'What areas can I work in?',
    a: 'Any UK town or city. You pick your area when you sign up, and we generate leads local to you.',
  },
  {
    q: 'Am I employed or self-employed?',
    a: 'You work as a self-employed contractor. There is no employment relationship, no guaranteed earnings, and no minimum hours. This is commission-only work.',
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-[-0.02em]">SalesFlow</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-[#0071E3] text-white text-[13px] font-medium px-4 py-2 rounded-full hover:bg-[#0077ED] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-[13px] font-medium text-[#0071E3] mb-4 tracking-wide uppercase">
            Commission-only · No experience needed · UK
          </p>
          <h1 className="text-[clamp(40px,8vw,72px)] font-semibold tracking-[-0.04em] leading-[1.0] mb-6">
            Earn £50 for every<br />website you sell
          </h1>
          <p className="text-[18px] text-gray-500 leading-relaxed mb-10 max-w-lg mx-auto tracking-[-0.01em]">
            Walk into local businesses, show them their new website on your phone, and close the deal. No office, no targets, no shifts.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="bg-[#0071E3] text-white px-8 py-4 rounded-full text-[16px] font-medium hover:bg-[#0077ED] transition-colors inline-flex items-center justify-center gap-2 group"
            >
              Start earning today
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="bg-gray-100 text-gray-900 px-8 py-4 rounded-full text-[16px] font-medium hover:bg-gray-200 transition-colors inline-flex items-center justify-center"
            >
              Already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-gray-100 py-6 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-8 text-center">
          {[
            { stat: '£50', label: 'per confirmed sale' },
            { stat: '7 days', label: 'average payout time' },
            { stat: '£50–£800', label: 'contractor range last month' },
          ].map((item) => (
            <div key={item.stat}>
              <p className="text-[28px] font-semibold tracking-[-0.03em]">{item.stat}</p>
              <p className="text-[13px] text-gray-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em] text-center mb-14">
            How a typical day works
          </h2>
          <div className="space-y-10">
            {[
              { num: '01', icon: MapPin, title: 'Get your leads', desc: "We generate a list of local businesses in your area that don't have a website, or have a bad one." },
              { num: '02', icon: Smartphone, title: 'Walk in and show them', desc: 'Pull up their custom demo site on your phone. They see their own business name, logo, and content — already built.' },
              { num: '03', icon: BookOpen, title: 'Handle objections', desc: "Use our proven scripts and talking points. We've answered every common objection so you don't have to wing it." },
              { num: '04', icon: Banknote, title: 'Close and earn', desc: '£50 lands in your account within 7 days. The business gets their site published. Everyone wins.' },
            ].map((step) => (
              <div key={step.num} className="flex gap-6 items-start">
                <span className="text-[48px] font-semibold text-gray-100 tracking-[-0.04em] leading-none shrink-0 w-[64px] tabular-nums">
                  {step.num}
                </span>
                <div className="pt-2">
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em] mb-1">{step.title}</h3>
                  <p className="text-[15px] text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em] text-center mb-14">
            Everything provided for you
          </h2>
          <div className="grid sm:grid-cols-2 gap-8">
            {[
              { title: 'AI-generated demo sites', desc: 'A custom website preview is created for each business before you visit — using their real name, category, and location.' },
              { title: 'Sales scripts & objection handlers', desc: 'Word-for-word scripts for every situation. Know exactly what to say when they say "we already have a website" or "not interested".' },
              { title: 'Local lead pipeline', desc: 'A curated list of businesses in your chosen area, refreshed regularly. No cold-calling from a phone book.' },
              { title: 'Real-time earnings dashboard', desc: 'Track your visits, pitches, closed sales, and payouts all in one place from your phone.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-6">
                <h3 className="text-[16px] font-semibold tracking-[-0.01em] mb-2">{item.title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real results */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em] mb-4">
            Real results, no promises
          </h2>
          <p className="text-[16px] text-gray-500 mb-10">
            Our contractors earned between <span className="font-semibold text-gray-900">£50 and £800</span> last month. Results vary based on effort, area, and approach.
          </p>
          <div className="bg-gray-50 rounded-2xl p-8 text-left space-y-4">
            {[
              'Every closed sale pays £50 commission, within 7 days',
              'No targets. No minimum hours. No shifts.',
              "Some contractors close one sale a week. Some close ten. It's entirely up to you.",
            ].map((line) => (
              <div key={line} className="flex gap-3">
                <span className="text-gray-300 font-semibold shrink-0">—</span>
                <p className="text-[15px] text-gray-600">{line}</p>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-gray-400 mt-4">
            This is commission-only work. There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em] text-center mb-14">
            Common questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                >
                  <span className="text-[15px] font-medium tracking-[-0.01em]">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-[14px] text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-[clamp(32px,5vw,48px)] font-semibold tracking-[-0.04em] leading-[1.05] mb-4">
            Ready to start earning?
          </h2>
          <p className="text-[16px] text-gray-500 mb-10">
            Sign up in under 2 minutes. No CV, no interview.
          </p>
          <Link
            href="/signup"
            className="bg-[#0071E3] text-white px-10 py-4 rounded-full text-[16px] font-medium hover:bg-[#0077ED] transition-colors inline-flex items-center gap-2 group"
          >
            Get started now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[13px] text-gray-400">© 2026 SalesFlow Ltd. Commission-only contractor platform.</span>
          <div className="flex gap-6">
            <Link href="/legal/privacy" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">Terms</Link>
            <Link href="/login" className="text-[13px] text-gray-400 hover:text-gray-900 transition-colors">Contractor login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
