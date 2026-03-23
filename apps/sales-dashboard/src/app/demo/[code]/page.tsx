'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  X, Check, Loader2, Phone, Mail, Globe, Star, Shield, Clock,
  Smartphone, Search, Calendar, MessageSquare, ShoppingBag, Image,
  Palette, BarChart3, MapPin, ChevronDown, Zap, Users, TrendingUp,
  ArrowRight, CheckCircle2, CreditCard, Headphones
} from 'lucide-react';

interface DemoData {
  business_name: string;
  demo_domain: string | null;
  status: string;
}

// Feature wishlist items — these get fed to the AI agent for the final build
const FEATURE_OPTIONS = [
  { id: 'online-booking', label: 'Online Booking', desc: 'Let customers book appointments directly', icon: Calendar },
  { id: 'menu-ordering', label: 'Online Ordering', desc: 'Take orders through your website', icon: ShoppingBag },
  { id: 'photo-gallery', label: 'Photo Gallery', desc: 'Showcase your work and products', icon: Image },
  { id: 'contact-form', label: 'Contact Form', desc: 'Let customers send enquiries', icon: MessageSquare },
  { id: 'google-maps', label: 'Google Maps', desc: 'Help customers find you', icon: MapPin },
  { id: 'customer-reviews', label: 'Customer Reviews', desc: 'Display your best reviews', icon: Star },
  { id: 'social-media', label: 'Social Media Links', desc: 'Connect your Instagram, Facebook, etc.', icon: Users },
  { id: 'custom-branding', label: 'Custom Branding', desc: 'Your colours, logo, and style', icon: Palette },
  { id: 'seo', label: 'Google Search Ranking', desc: 'Get found when people search locally', icon: Search },
  { id: 'mobile-optimised', label: 'Mobile Optimised', desc: 'Looks great on every device', icon: Smartphone },
  { id: 'analytics', label: 'Visitor Analytics', desc: 'See who visits your site', icon: BarChart3 },
  { id: 'whatsapp', label: 'WhatsApp Button', desc: 'One-tap messaging for customers', icon: Phone },
];

export default function CustomerDemoPage() {
  const params = useParams();
  const code = params.code as string;
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'demo' | 'pricing' | 'features' | 'contact'>('demo');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(['contact-form', 'google-maps', 'mobile-optimised']);
  const [showGetStarted, setShowGetStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custNotes, setCustNotes] = useState('');

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

  function toggleFeature(id: string) {
    setSelectedFeatures(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`/api/demo-links/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName.trim(),
          phone: custPhone.trim(),
          email: custEmail.trim() || undefined,
          message: custNotes.trim() || undefined,
          selected_features: selectedFeatures,
        }),
      });
      setSubmitted(true);
    } catch { /* */ }
    setSubmitting(false);
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">{error}</h1>
          <p className="text-sm text-slate-400">Contact the person who shared this link for an updated version.</p>
        </div>
      </div>
    );
  }

  if (!demo) return null;

  const demoSiteUrl = demo.demo_domain ? `/api/demo-site/${demo.demo_domain}` : null;
  const businessName = demo.business_name;

  return (
    <div className="min-h-screen bg-white">
      {/* ═══ STICKY TOP BAR ═══ */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="text-xs font-bold text-white">{businessName.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 leading-none">{businessName}</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Your website preview</p>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {(['demo', 'pricing', 'features', 'contact'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSection(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSection === tab
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'demo' ? 'Preview' : tab === 'pricing' ? 'Pricing' : tab === 'features' ? 'Customise' : 'Get Started'}
              </button>
            ))}
          </nav>

          {!submitted ? (
            <button
              onClick={() => { setActiveSection('contact'); setShowGetStarted(true); }}
              className="bg-slate-900 text-white text-xs font-semibold px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Get This Website
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
              <Check className="w-4 h-4" /> Requested
            </div>
          )}
        </div>

        {/* Mobile tab bar */}
        <div className="md:hidden flex border-t border-slate-100">
          {(['demo', 'pricing', 'features', 'contact'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`flex-1 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                activeSection === tab
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-400'
              }`}
            >
              {tab === 'demo' ? 'Preview' : tab === 'pricing' ? 'Pricing' : tab === 'features' ? 'Customise' : 'Get Started'}
            </button>
          ))}
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}

      {/* --- DEMO TAB --- */}
      {activeSection === 'demo' && (
        <div className="relative">
          {demoSiteUrl ? (
            <iframe
              src={demoSiteUrl}
              className="w-full border-0"
              style={{ height: 'calc(100vh - 56px)' }}
              title={`${businessName} demo website`}
            />
          ) : (
            <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 56px)' }}>
              <div className="text-center px-6">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-slate-300" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Your website is being built</h2>
                <p className="text-sm text-slate-400">Check back soon — we&apos;re creating a custom design for {businessName}.</p>
              </div>
            </div>
          )}

          {/* Floating CTA at bottom of demo */}
          {!submitted && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
              <button
                onClick={() => setActiveSection('pricing')}
                className="bg-slate-900 text-white text-sm font-semibold px-8 py-3 rounded-full shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                Like what you see? <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- PRICING TAB --- */}
      {activeSection === 'pricing' && (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Get your own professional website</h2>
            <p className="text-sm text-slate-500">Everything {businessName} needs to stand out online</p>
          </div>

          {/* Price card */}
          <div className="border-2 border-slate-900 rounded-2xl overflow-hidden mb-10">
            <div className="bg-slate-900 px-6 py-5 text-center">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Complete Website Package</div>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold text-white">{'\u00A3'}350</span>
                <span className="text-sm text-slate-400">one-time</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">+ {'\u00A3'}25/month hosting & support</div>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <IncludedItem text="Custom designed website" />
                <IncludedItem text="Mobile responsive" />
                <IncludedItem text="Google search optimised" />
                <IncludedItem text="Contact form & enquiries" />
                <IncludedItem text="Google Maps integration" />
                <IncludedItem text="Social media links" />
                <IncludedItem text="SSL security certificate" />
                <IncludedItem text="Fast UK hosting" />
                <IncludedItem text="Ongoing updates & support" />
                <IncludedItem text="Analytics dashboard" />
                <IncludedItem text="Custom domain setup" />
                <IncludedItem text="Your branding & colours" />
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <button
                  onClick={() => setActiveSection('features')}
                  className="w-full bg-slate-900 text-white text-sm font-semibold py-3.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  Customise Your Website <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Trust row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <TrustItem icon={Clock} title="Live in 48 hours" desc="Your website will be ready within 2 business days of confirmation" />
            <TrustItem icon={Headphones} title="Ongoing support" desc="We handle all updates, changes, and technical issues — you focus on your business" />
            <TrustItem icon={CreditCard} title="No hidden fees" desc="One-time setup + simple monthly hosting. Cancel anytime." />
          </div>
        </div>
      )}

      {/* --- FEATURES/CUSTOMISE TAB --- */}
      {activeSection === 'features' && (
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-12">
          <div className="text-center mb-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">What features do you want?</h2>
            <p className="text-sm text-slate-500 mb-8">Select what matters most for {businessName}. We&apos;ll build it all in.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {FEATURE_OPTIONS.map(feat => {
              const selected = selectedFeatures.includes(feat.id);
              return (
                <button
                  key={feat.id}
                  onClick={() => toggleFeature(feat.id)}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${
                    selected
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selected ? 'bg-slate-900' : 'bg-slate-100'
                  }`}>
                    <feat.icon className={`w-4 h-4 ${selected ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{feat.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{feat.desc}</div>
                  </div>
                  {selected && (
                    <CheckCircle2 className="w-5 h-5 text-slate-900 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-50 rounded-xl px-5 py-4 flex items-center justify-between mb-6">
            <div>
              <div className="text-sm font-semibold text-slate-900">{selectedFeatures.length} features selected</div>
              <div className="text-[11px] text-slate-400 mt-0.5">All included in your {'\u00A3'}350 package — no extra cost</div>
            </div>
            <button
              onClick={() => setActiveSection('contact')}
              className="bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* --- GET STARTED / CONTACT TAB --- */}
      {activeSection === 'contact' && (
        <div className="max-w-lg mx-auto px-4 md:px-6 py-12">
          {!submitted ? (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-7 h-7 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Get started</h2>
                <p className="text-sm text-slate-500">Leave your details and we&apos;ll have your website ready within 48 hours.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Your name *</label>
                  <input
                    type="text" value={custName} onChange={e => setCustName(e.target.value)} required autoFocus
                    placeholder="e.g. Ahmed Khan"
                    className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Phone number *</label>
                  <input
                    type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} required
                    placeholder="e.g. 07700 900000"
                    className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Email (optional)</label>
                  <input
                    type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)}
                    placeholder="e.g. ahmed@mybusiness.co.uk"
                    className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">Anything else you&apos;d like? (optional)</label>
                  <textarea
                    value={custNotes} onChange={e => setCustNotes(e.target.value)} rows={3}
                    placeholder="e.g. I'd like a price list page, or online booking would be great"
                    className="w-full border border-slate-200 rounded-xl py-3.5 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 resize-none"
                  />
                </div>

                {/* Selected features summary */}
                {selectedFeatures.length > 0 && (
                  <div className="bg-slate-50 rounded-xl px-4 py-3">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-2">Your selected features</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFeatures.map(fId => {
                        const feat = FEATURE_OPTIONS.find(f => f.id === fId);
                        return feat ? (
                          <span key={fId} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-600 font-medium">
                            <Check className="w-3 h-3 text-emerald-500" />{feat.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !custName.trim() || !custPhone.trim()}
                  className="w-full bg-slate-900 text-white text-sm font-semibold py-4 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <><span>Yes, build my website</span><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <div className="flex items-center justify-center gap-4 text-[10px] text-slate-300 mt-3">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> No obligation</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Ready in 48hrs</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> We&apos;ll call first</span>
                </div>
              </form>
            </>
          ) : (
            /* ═══ SUCCESS STATE ═══ */
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank you, {custName}!</h2>
              <p className="text-sm text-slate-500 mb-2">We&apos;ve received your request for {businessName}.</p>
              <p className="text-sm text-slate-400 mb-8">Someone will call you at <strong className="text-slate-600">{custPhone}</strong> within 24 hours to confirm everything and get started.</p>

              <div className="bg-slate-50 rounded-xl px-5 py-4 text-left mb-6 max-w-sm mx-auto">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-3">What happens next</div>
                <div className="space-y-3">
                  <NextStep number={1} text="We'll call to confirm your requirements" />
                  <NextStep number={2} text="Payment of £350 setup fee" />
                  <NextStep number={3} text="Your custom website built within 48 hours" />
                  <NextStep number={4} text="We'll walk you through the finished site" />
                  <NextStep number={5} text="Go live and start getting customers" />
                </div>
              </div>

              <button
                onClick={() => setActiveSection('demo')}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Back to demo preview
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function IncludedItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      <span className="text-sm text-slate-700">{text}</span>
    </div>
  );
}

function TrustItem({ icon: Icon, title, desc }: { icon: typeof Clock; title: string; desc: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-5 h-5 text-slate-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function NextStep({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-slate-500">{number}</span>
      </div>
      <span className="text-xs text-slate-600">{text}</span>
    </div>
  );
}
