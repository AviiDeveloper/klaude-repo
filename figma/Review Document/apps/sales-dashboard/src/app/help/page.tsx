'use client';

import { useState } from 'react';
import { ChevronDown, MessageCircle, Mail, Phone, BookOpen, Zap, DollarSign } from 'lucide-react';

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  const faqs = [
    {
      id: '1',
      category: 'Getting Started',
      icon: Zap,
      question: 'How do I get my first leads?',
      answer:
        "New leads are automatically assigned to you based on your coverage area. Check your Dashboard daily for fresh opportunities. We recommend starting with businesses that have high ratings and are nearby.",
    },
    {
      id: '2',
      category: 'Getting Started',
      icon: Zap,
      question: 'What should I say when I walk in?',
      answer:
        'Start friendly and direct: "Hi, I\'m [name]. I help local businesses get online. I\'ve actually built a demo website for [Business Name] - can I show you real quick?" Then pull up the demo site on your phone.',
    },
    {
      id: '3',
      category: 'Pricing',
      icon: DollarSign,
      question: 'How much commission do I earn per sale?',
      answer:
        "You earn £50 for every website sold. Payments are processed weekly and appear in your Payouts section. There's no cap on earnings - the more you sell, the more you make.",
    },
    {
      id: '4',
      category: 'Pricing',
      icon: DollarSign,
      question: 'When do I get paid?',
      answer:
        'Commissions are paid weekly via bank transfer. Sales made Monday-Sunday are paid the following Friday. You can track pending and paid commissions in the Payouts page.',
    },
    {
      id: '5',
      category: 'Pitching',
      icon: BookOpen,
      question: 'What if they already have a website?',
      answer:
        'Great opening! Ask when it was last updated and if they can easily edit it themselves. Most small business sites are outdated or hard to manage. Position yours as modern, mobile-optimized, and simple.',
    },
    {
      id: '6',
      category: 'Pitching',
      icon: BookOpen,
      question: 'How do I handle "I need to think about it"?',
      answer:
        'Say: "Absolutely! Before you decide, let me show you the demo site we made - takes 2 minutes." Then pull it up. Seeing their actual business in a professional site often converts hesitation into interest.',
    },
    {
      id: '7',
      category: 'Pitching',
      icon: BookOpen,
      question: 'What if they say £350 is too expensive?',
      answer:
        'Break it down: "It\'s just £25/month - less than a phone bill. How many new customers would you need from your website to make that worthwhile? Most get that in a week." Or offer the one-time £350 option.',
    },
    {
      id: '8',
      category: 'Technical',
      icon: Zap,
      question: 'How do demo sites get generated?',
      answer:
        "Our AI scrapes the business's Google listing, reviews, and services, then builds a custom demo site automatically. You don't need to do anything - just show it to them on your phone.",
    },
    {
      id: '9',
      category: 'Technical',
      icon: Zap,
      question: 'Can I customize the demo sites?',
      answer:
        'Not directly, but if a customer wants changes before purchasing, note them in the Follow Up tab. Our team will make adjustments during the handoff process.',
    },
  ];

  const categories = Array.from(new Set(faqs.map((f) => f.category)));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight mb-2">Help Centre</h1>
          <p className="text-[15px] text-slate-500">
            Everything you need to know about selling with SalesFlow
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <a
            href="/help/getting-started"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 mb-1">Getting Started Guide</h3>
            <p className="text-[13px] text-slate-500">Your first week as a SalesFlow contractor</p>
          </a>

          <a
            href="/help/scripts"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
              <MessageCircle className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 mb-1">Pitch Scripts</h3>
            <p className="text-[13px] text-slate-500">Proven templates for every situation</p>
          </a>

          <a
            href="/help/best-practices"
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-[15px] font-semibold text-slate-900 mb-1">Best Practices</h3>
            <p className="text-[13px] text-slate-500">Tips from top-performing contractors</p>
          </a>
        </div>

        {/* FAQ Sections by Category */}
        {categories.map((category) => {
          const categoryFaqs = faqs.filter((f) => f.category === category);
          const CategoryIcon = categoryFaqs[0]?.icon;

          return (
            <div key={category} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                {CategoryIcon && (
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <CategoryIcon className="w-4 h-4 text-slate-600" />
                  </div>
                )}
                <h2 className="text-[17px] font-semibold text-slate-900">{category}</h2>
              </div>

              <div className="space-y-3">
                {categoryFaqs.map((faq) => {
                  const isOpen = openFaq === faq.id;

                  return (
                    <div
                      key={faq.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-[15px] font-medium text-slate-900 pr-4">{faq.question}</span>
                        <ChevronDown
                          className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 pt-0">
                          <p className="text-[13px] text-slate-700 leading-relaxed">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Contact Support */}
        <div className="bg-slate-900 text-white rounded-xl p-8 mt-12">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-[20px] font-semibold mb-2">Still need help?</h2>
            <p className="text-[13px] text-slate-300 mb-6">
              Our support team is here Monday-Friday, 9am-6pm
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:support@salesflow.co.uk"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-900 rounded-lg text-[13px] font-medium hover:bg-slate-100 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email Support
              </a>

              <a
                href="tel:+442030000000"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white/10 text-white border border-white/20 rounded-lg text-[13px] font-medium hover:bg-white/20 transition-colors"
              >
                <Phone className="w-4 h-4" />
                020 3000 0000
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
