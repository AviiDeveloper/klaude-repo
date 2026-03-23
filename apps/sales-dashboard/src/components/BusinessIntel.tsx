'use client';

import { useState } from 'react';
import type { LeadDetail, ReviewItem } from '@/lib/types';
import { TrendingUp, Globe, Sparkles, BarChart3, Lightbulb, Package, AlertTriangle, Star, Clock, MapPin, Users, MessageSquareQuote, Eye, Shield } from 'lucide-react';

// ---------------------------------------------------------------------------
// Data-first intelligence generator
// Builds personalised insights from ACTUAL scraped data about THIS business.
// Industry knowledge base is the FALLBACK, not the primary source.
// ---------------------------------------------------------------------------

interface Insight {
  icon: typeof Globe;
  text: string;
  type: 'personalised' | 'industry'; // so we can visually distinguish
  source: string; // where this insight came from
}

function generatePersonalisedInsights(lead: LeadDetail): Insight[] {
  const insights: Insight[] = [];
  const name = lead.business_name;
  const type = lead.business_type ?? 'business';

  // --- SCRAPED DATA INSIGHTS (personalised) ---

  // No website — the core pitch
  if (!lead.has_website) {
    insights.push({
      icon: Globe,
      text: `${name} has no website. Every time someone searches "${type} near ${lead.postcode ?? 'me'}" on Google, this business is invisible. Their competitors with websites get those customers instead.`,
      type: 'personalised',
      source: 'Scraped from Google',
    });
  } else if (lead.website_quality_score !== null && lead.website_quality_score < 40) {
    insights.push({
      icon: AlertTriangle,
      text: `${name} has a website but it scored ${lead.website_quality_score}/100 in our quality check. It's likely outdated, not mobile-friendly, or loading slowly — which actually hurts their Google ranking more than having no site at all.`,
      type: 'personalised',
      source: 'Website quality scan',
    });
  }

  // Google rating
  if (lead.google_rating && lead.google_review_count) {
    if (lead.google_rating >= 4.5) {
      insights.push({
        icon: Star,
        text: `${name} is rated ${lead.google_rating}★ with ${lead.google_review_count} reviews — that's excellent. But without a website, these reviews are buried on Google Maps. A homepage that leads with "${lead.google_rating}★ rated by ${lead.google_review_count} customers" would be incredibly powerful social proof.`,
        type: 'personalised',
        source: `Google Maps — ${lead.google_review_count} reviews`,
      });
    } else if (lead.google_rating >= 4.0) {
      insights.push({
        icon: Star,
        text: `${name} has ${lead.google_review_count} reviews averaging ${lead.google_rating}★. A website with their best reviews front and centre would turn browsers into visitors. Right now, customers have to dig through Google to find these.`,
        type: 'personalised',
        source: `Google Maps — ${lead.google_review_count} reviews`,
      });
    } else {
      insights.push({
        icon: Star,
        text: `${name} has ${lead.google_rating}★ from ${lead.google_review_count} reviews. A website lets them control the narrative — showcase their best reviews, respond to feedback, and show improvements. Right now Google controls how they look.`,
        type: 'personalised',
        source: `Google Maps`,
      });
    }
  }

  // Best reviews — use actual customer words
  if (lead.best_reviews && lead.best_reviews.length > 0) {
    const topReview = lead.best_reviews[0];
    insights.push({
      icon: MessageSquareQuote,
      text: `Their top review says: "${topReview.text.slice(0, 120)}${topReview.text.length > 120 ? '...' : ''}" — ${topReview.author}. This should be on a homepage hero section, not buried in Google Maps where nobody scrolls.`,
      type: 'personalised',
      source: `Google review by ${topReview.author}`,
    });
  }

  // Opening hours
  if (lead.opening_hours && lead.opening_hours.length > 0) {
    insights.push({
      icon: Clock,
      text: `${name} is open ${lead.opening_hours[0]}. Without a website, customers have to call just to check hours — or worse, show up when they're closed. A website with live opening hours eliminates this friction completely.`,
      type: 'personalised',
      source: 'Scraped opening hours',
    });
  }

  // Services
  if (lead.services && lead.services.length > 0) {
    const serviceList = lead.services.slice(0, 4).join(', ');
    insights.push({
      icon: Package,
      text: `${name} offers ${serviceList}${lead.services.length > 4 ? ` and ${lead.services.length - 4} more` : ''}. None of these show up when people search for "${lead.services[0]} in ${lead.postcode ?? 'the area'}". A website with dedicated service pages would rank for each of these searches.`,
      type: 'personalised',
      source: `${lead.services.length} services scraped`,
    });
  }

  // Location
  if (lead.address) {
    insights.push({
      icon: MapPin,
      text: `Located at ${lead.address}. "Near me" searches have grown 500% in 5 years — every search for "${type} near ${lead.postcode ?? 'me'}" is a potential customer that ${name} is currently missing.`,
      type: 'personalised',
      source: 'Business address',
    });
  }

  // Demo site ready
  if (lead.has_demo_site && lead.demo_site_domain) {
    insights.push({
      icon: Eye,
      text: `We've already built a demo site for ${name}. Show it to them on your phone — it uses their actual brand colours, real photos, and genuine customer reviews. This is what their business looks like online.`,
      type: 'personalised',
      source: 'AI-generated demo site',
    });
  }

  // Trust badges from brief
  if (lead.trust_badges && lead.trust_badges.length > 0) {
    insights.push({
      icon: Shield,
      text: `Key selling points for ${name}: ${lead.trust_badges.join(', ')}. These should be displayed as trust badges on their homepage — customers need to see these before they'll call or visit.`,
      type: 'personalised',
      source: 'Brief generator',
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Opening line generator — completely personalised
// ---------------------------------------------------------------------------

function generateOpeningLine(lead: LeadDetail): string {
  const name = lead.business_name;

  // Best case: we have reviews to reference
  if (lead.google_rating && lead.google_review_count && lead.google_review_count > 10) {
    if (lead.best_reviews && lead.best_reviews.length > 0) {
      return `Hi, I came across ${name} on Google and saw you've got some great reviews — ${lead.google_rating} stars from ${lead.google_review_count} people. I noticed you don't have a website though, so all those reviews are just sitting on Google Maps. I've actually put together a quick demo of what a site could look like for you — mind if I show you? Takes 30 seconds.`;
    }
    return `Hi, I was looking at ${lead.business_type ?? 'businesses'}s in ${lead.postcode ?? 'the area'} and saw ${name} is rated ${lead.google_rating} stars — clearly doing something right. I noticed there's no website though, which means anyone searching online can't find you. I've put together a demo site — want a quick look?`;
  }

  // We have services info
  if (lead.services && lead.services.length > 0) {
    return `Hi, I've been looking at ${lead.business_type ?? 'businesses'}s in the area and I noticed ${name} doesn't have a website. I could see you offer ${lead.services.slice(0, 2).join(' and ')} — I've actually mocked up a site showing all your services. Want to take a quick look? It's already done.`;
  }

  // Minimal info — still personalised with name and type
  return `Hi, I noticed ${name} doesn't have a website yet and I've actually already put together a demo of what one could look like specifically for your ${lead.business_type ?? 'business'}. Mind if I show you? Takes 30 seconds on my phone.`;
}

// ---------------------------------------------------------------------------
// "What they get" — personalised to their actual data
// ---------------------------------------------------------------------------

function generateWhatTheyGet(lead: LeadDetail): Array<{ feature: string; desc: string; personalised: boolean }> {
  const features: Array<{ feature: string; desc: string; personalised: boolean }> = [];
  const name = lead.business_name;

  // Always
  features.push({
    feature: 'Professional website',
    desc: `Custom-designed for ${name} using ${lead.brand_colours ? 'your actual brand colours' : 'colours matched to your business'}`,
    personalised: !!lead.brand_colours,
  });

  // If they have reviews
  if (lead.google_review_count && lead.google_review_count > 0) {
    features.push({
      feature: 'Reviews showcase',
      desc: `Your ${lead.google_review_count} Google reviews displayed prominently — social proof that converts visitors`,
      personalised: true,
    });
  }

  // If they have services
  if (lead.services && lead.services.length > 0) {
    features.push({
      feature: `${lead.services.length} service pages`,
      desc: `Each service (${lead.services.slice(0, 3).join(', ')}${lead.services.length > 3 ? '...' : ''}) gets its own section — ranks in Google for each one`,
      personalised: true,
    });
  }

  // If they have opening hours
  if (lead.opening_hours && lead.opening_hours.length > 0) {
    features.push({
      feature: 'Live opening hours',
      desc: `Your hours (${lead.opening_hours[0]}) displayed clearly — no more "are you open?" calls`,
      personalised: true,
    });
  }

  // If we have their address
  if (lead.address) {
    features.push({
      feature: 'Google Maps integration',
      desc: `Interactive map showing ${lead.address} — one tap for driving directions`,
      personalised: true,
    });
  }

  // Phone
  if (lead.phone) {
    features.push({
      feature: 'Click-to-call button',
      desc: `Customers tap once to call ${lead.phone} — no copying numbers or searching for contact info`,
      personalised: true,
    });
  }

  // Always include these
  features.push(
    { feature: 'Mobile responsive', desc: '80% of local searches are on phones — the site looks perfect on every device', personalised: false },
    { feature: 'Google optimised', desc: `Built to rank for "${lead.business_type ?? 'business'} in ${lead.postcode ?? 'your area'}" searches`, personalised: !!lead.postcode },
  );

  return features;
}

// ---------------------------------------------------------------------------
// Industry knowledge (fallback context, NOT the primary pitch)
// ---------------------------------------------------------------------------

const INDUSTRY_STATS: Record<string, Array<{ stat: string; source: string }>> = {
  barber: [
    { stat: '72% of people search "barber near me" on their phone', source: 'Google Trends 2025' },
    { stat: 'Barber shops with websites see 40% more new customers', source: 'Salon Business Report' },
    { stat: 'Online booking reduces no-shows by up to 30%', source: 'Booksy Data' },
  ],
  salon: [
    { stat: '78% of salon clients research online before first visit', source: 'Phorest Salon Report' },
    { stat: 'Salons with online booking earn 27% more', source: 'Booksy Industry Data' },
    { stat: 'Average salon client spends £42 per visit', source: 'Treatwell UK' },
  ],
  restaurant: [
    { stat: '90% check a restaurant online before dining', source: 'OpenTable 2025' },
    { stat: '77% visit a restaurant\'s website before deciding', source: 'MGH Survey' },
    { stat: 'Restaurants with websites see 30% more covers', source: 'Toast POS Data' },
  ],
  cafe: [
    { stat: '65% of 18-35s choose cafes based on online photos', source: 'Allegra World Coffee' },
    { stat: 'Independent cafes growing 7% year-on-year', source: 'Square UK Data' },
    { stat: 'Average café customer spends £4.80 per visit', source: 'MCA Insight' },
  ],
  plumber: [
    { stat: '"Emergency plumber" gets 90,000+ UK monthly searches', source: 'Google Keyword Planner' },
    { stat: '82% won\'t call a tradesperson without checking online', source: 'Checkatrade Survey' },
    { stat: 'Homeowners spend avg £300 per plumbing job', source: 'MyBuilder Data' },
  ],
  electrician: [
    { stat: '"Electrician near me" gets 110,000+ UK monthly searches', source: 'Google Keyword Planner' },
    { stat: '85% verify qualifications online before hiring', source: 'TrustMark Survey' },
    { stat: 'UK EV charger market growing 35% annually', source: 'SMMT Data' },
  ],
  bakery: [
    { stat: '85% of celebration cake buyers search online first', source: 'Hitched UK' },
    { stat: 'Artisan bakeries growing 8% year-on-year', source: 'Mintel' },
    { stat: 'Average custom cake order: £150-£350', source: 'Cake International' },
  ],
};

const DEFAULT_STATS = [
  { stat: '81% of consumers research a business online before visiting', source: 'GE Capital Retail' },
  { stat: '75% judge credibility by website design', source: 'Stanford Web Credibility' },
  { stat: '97% of people learn about local businesses online', source: 'SEO Tribunal' },
];

function getIndustryStats(businessType: string | null): Array<{ stat: string; source: string }> {
  if (!businessType) return DEFAULT_STATS;
  const t = businessType.toLowerCase();
  for (const [key, stats] of Object.entries(INDUSTRY_STATS)) {
    if (t.includes(key)) return stats;
  }
  if (t.includes('hair') || t.includes('beauty')) return INDUSTRY_STATS.salon;
  if (t.includes('coffee')) return INDUSTRY_STATS.cafe;
  if (t.includes('pizza') || t.includes('takeaway') || t.includes('kebab')) return INDUSTRY_STATS.restaurant;
  if (t.includes('builder') || t.includes('roofer') || t.includes('painter')) return INDUSTRY_STATS.plumber;
  return DEFAULT_STATS;
}

const AFTER_SALE = [
  { feature: 'Monthly updates', desc: 'New photos, seasonal offers, updated hours — we handle all changes' },
  { feature: 'Google ranking', desc: 'SEO optimisation to climb local search results over time' },
  { feature: 'Performance reports', desc: 'Monthly visitor stats so they see the return on investment' },
  { feature: 'Priority support', desc: 'Any changes needed within 24 hours' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'insights' | 'script' | 'features' | 'stats' | 'after';

export function BusinessIntel({ lead }: { lead: LeadDetail }) {
  const [activeTab, setActiveTab] = useState<Tab>('insights');

  const insights = generatePersonalisedInsights(lead);
  const openingLine = generateOpeningLine(lead);
  const features = generateWhatTheyGet(lead);
  const industryStats = getIndustryStats(lead.business_type);
  const personalisedCount = insights.filter(i => i.type === 'personalised').length;

  const tabs: Array<{ id: Tab; label: string; icon: typeof Globe; badge?: string }> = [
    { id: 'insights', label: 'Key Insights', icon: Lightbulb, badge: `${personalisedCount}` },
    { id: 'script', label: 'What to Say', icon: MessageSquareQuote },
    { id: 'features', label: 'What They Get', icon: Package, badge: `${features.filter(f => f.personalised).length}` },
    { id: 'stats', label: 'Industry Data', icon: BarChart3 },
    { id: 'after', label: 'After Sale', icon: Sparkles },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Business Intelligence</h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">{personalisedCount} personalised</span>
      </div>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === id ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
              {badge && <span className={`text-[9px] px-1 py-px rounded ${activeTab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{badge}</span>}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* KEY INSIGHTS — personalised from scraped data */}
          {activeTab === 'insights' && (
            <div className="space-y-3">
              {insights.length === 0 && (
                <p className="text-[12px] text-slate-400 text-center py-4">No scraped data available yet. Insights will appear after the pipeline processes this lead.</p>
              )}
              {insights.map((insight, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${insight.type === 'personalised' ? 'bg-slate-50' : 'bg-white border border-slate-100'}`}>
                  <insight.icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${insight.type === 'personalised' ? 'text-slate-700' : 'text-slate-300'}`} />
                  <div className="flex-1">
                    <p className="text-[12px] text-slate-700 leading-relaxed">{insight.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${insight.type === 'personalised' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {insight.type === 'personalised' ? '● Personalised' : '○ Industry'}
                      </span>
                      <span className="text-[9px] text-slate-300">{insight.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* WHAT TO SAY — personalised opening line + avoid topics */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">Personalised opening line</div>
                <p className="text-[13px] text-amber-900 leading-relaxed italic">"{openingLine}"</p>
                <p className="text-[9px] text-amber-500 mt-2">Built from: {[
                  lead.google_rating && 'Google rating',
                  lead.best_reviews?.length && 'reviews',
                  lead.services?.length && 'services',
                  lead.postcode && 'location',
                ].filter(Boolean).join(', ') || 'business name'}</p>
              </div>

              {lead.avoid_topics && lead.avoid_topics.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-2">Do not mention</div>
                  <p className="text-[12px] text-red-700">{lead.avoid_topics.join(', ')}</p>
                  <p className="text-[10px] text-red-400 mt-1">These topics don't apply to this type of {lead.business_type ?? 'business'} and will make you sound generic.</p>
                </div>
              )}

              {lead.trust_badges && lead.trust_badges.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-2">Do mention</div>
                  <p className="text-[12px] text-emerald-700">{lead.trust_badges.join(' · ')}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">These resonate with {lead.business_type ?? 'this type of business'} customers.</p>
                </div>
              )}

              {lead.best_reviews && lead.best_reviews.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quote their own customers back to them</div>
                  {lead.best_reviews.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[12px] text-slate-600 italic">"{r.text.slice(0, 150)}{r.text.length > 150 ? '...' : ''}"</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">— {r.author}, {r.rating}★</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WHAT THEY GET — personalised features */}
          {activeTab === 'features' && (
            <div>
              <p className="text-[11px] text-slate-400 mb-3">What {lead.business_name} specifically gets:</p>
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${f.personalised ? 'bg-slate-50' : 'bg-white'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${f.personalised ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                      <div className="text-[12px] font-medium text-slate-900">{f.feature}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{f.desc}</div>
                    </div>
                    {f.personalised && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium flex-shrink-0 mt-0.5">Their data</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INDUSTRY DATA — fallback context */}
          {activeTab === 'stats' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400">Industry statistics to back up your pitch:</p>
              {industryStats.map((s, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] text-slate-900 font-medium">{s.stat}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Source: {s.source}</p>
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-slate-300 mt-2 italic">These are general industry stats. The Key Insights tab has data specific to {lead.business_name}.</p>
            </div>
          )}

          {/* AFTER SALE — what justifies the monthly */}
          {activeTab === 'after' && (
            <div>
              <p className="text-[11px] text-slate-400 mb-3">What happens after they pay — use this to justify the £25/month:</p>
              <div className="space-y-2.5">
                {AFTER_SALE.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[12px] font-medium text-slate-900">{f.feature}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
