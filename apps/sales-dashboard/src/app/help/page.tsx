'use client';

import { useState } from 'react';
import { MessageCircle, ChevronDown, ChevronRight, Mail, AlertTriangle, BookOpen, Video, FileText } from 'lucide-react';

const FAQ: Array<{ q: string; a: string }> = [
  { q: 'How do I get paid?', a: 'You earn £50 for every sale you close. Payments are processed weekly and sent to your bank account. You need to add your bank details in Payouts.' },
  { q: 'Am I employed by SalesFlow?', a: 'No. You are an independent contractor. You work when you want, choose which leads to visit, and can stop at any time. You are responsible for your own tax.' },
  { q: 'What do I say when I walk in?', a: 'Each lead has Talking Points — key things to mention and avoid. There\'s also an Objection Handler with scripted responses to common pushbacks like "I don\'t need a website" or "It\'s too expensive."' },
  { q: 'What if a business says no?', a: 'Tap "Reject" and select a reason. The lead goes back to the system. No penalty — some businesses just aren\'t interested.' },
  { q: 'What if I can\'t find the business?', a: 'Use the Map tab for directions. If the business has closed or moved, reject the lead with "Business closed / gone" and move to the next one.' },
  { q: 'How are leads assigned to me?', a: 'The system automatically assigns businesses in your area based on your postcode. You can change your area in Settings.' },
  { q: 'Can I work with a friend?', a: 'Yes! Share the app link and they can sign up. Each person gets their own leads and earns their own commission.' },
  { q: 'Is there a minimum number of visits?', a: 'No. You\'re a contractor — work as much or as little as you want. There are no targets or penalties.' },
  { q: 'What happens after I make a sale?', a: 'The client gets their website set up within 48 hours. You don\'t need to do anything else — we handle the rest.' },
  { q: 'What if the client wants changes to their site?', a: 'All client support goes through us. You\'re only responsible for the initial sale.' },
];

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <div className="px-6 md:px-8 py-5 border-b border-slate-100">
        <h1 className="text-[15px] font-semibold text-slate-900">Help Centre</h1>
        <p className="text-[11px] text-slate-400 mt-0.5">Guides, FAQ, and support</p>
      </div>

      <div className="px-6 md:px-8 py-6 max-w-2xl">
        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <QuickLink icon={BookOpen} title="Pitch Guide" desc="How to sell" />
          <QuickLink icon={Video} title="Video Tutorial" desc="Watch & learn" />
          <QuickLink icon={FileText} title="Contractor FAQ" desc="Your rights" />
          <QuickLink icon={Mail} title="Contact Support" desc="Get help" />
        </div>

        {/* FAQ */}
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Frequently Asked Questions</h2>
        <div className="border border-slate-100 rounded-xl overflow-hidden mb-8">
          {FAQ.map((item, i) => (
            <div key={i} className={i > 0 ? 'border-t border-slate-50' : ''}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-[13px] font-medium text-slate-900 pr-4">{item.q}</span>
                <ChevronDown className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-4 -mt-1">
                  <p className="text-[12px] text-slate-500 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact */}
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Contact Us</h2>
        <div className="border border-slate-100 rounded-xl overflow-hidden mb-8">
          <a href="mailto:support@salesflow.app" className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50">
            <Mail className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-slate-900">Email support</div>
              <div className="text-[11px] text-slate-400">support@salesflow.app</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-200" />
          </a>
          <a href="#" className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors">
            <AlertTriangle className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-slate-900">Report a problem</div>
              <div className="text-[11px] text-slate-400">Something broken or incorrect</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-200" />
          </a>
        </div>
      </div>
    </>
  );
}

function QuickLink({ icon: Icon, title, desc }: { icon: typeof BookOpen; title: string; desc: string }) {
  return (
    <button className="border border-slate-100 rounded-xl p-4 text-left hover:bg-slate-50 transition-colors">
      <Icon className="w-4 h-4 text-slate-400 mb-2" />
      <div className="text-[12px] font-semibold text-slate-900">{title}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{desc}</div>
    </button>
  );
}
