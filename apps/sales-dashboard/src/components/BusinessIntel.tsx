'use client';

import { useState } from 'react';
import { TrendingUp, Users, Globe, Shield, Sparkles, ChevronRight, BarChart3, Lightbulb, Package } from 'lucide-react';

// ---------------------------------------------------------------------------
// Business type knowledge base — industry-specific sales intelligence
// ---------------------------------------------------------------------------

interface IndustryIntel {
  whyWebsite: string[];
  industryStats: Array<{ stat: string; source: string }>;
  whatTheyGet: Array<{ feature: string; desc: string }>;
  competitorInsight: string;
  painPoints: string[];
  afterSale: Array<{ feature: string; desc: string }>;
  openingLine: string;
}

const INDUSTRY_INTEL: Record<string, IndustryIntel> = {
  barber: {
    whyWebsite: [
      '63% of customers search online before choosing a new barber — without a website, they\'re invisible to new customers moving to the area',
      'A website with online booking reduces no-shows by up to 30% — customers commit when they book online',
      'Google ranks businesses with websites higher in local search — their competitors with sites get shown first',
      'Young customers (16-35) specifically look for a barber\'s portfolio/style online before walking in',
    ],
    industryStats: [
      { stat: '72% of people search "barber near me" on their phone', source: 'Google Trends 2025' },
      { stat: 'Barber shops with websites see 40% more new customers', source: 'Salon Business Report' },
      { stat: 'Average UK barber earns £26k — top earners with online presence earn £45k+', source: 'Indeed UK' },
      { stat: 'Online booking increases revenue by 20% through reduced gaps', source: 'Booksy Data' },
    ],
    whatTheyGet: [
      { feature: 'Online booking system', desc: 'Customers book 24/7 — no missed calls during busy cuts' },
      { feature: 'Service menu with prices', desc: 'Customers know exactly what to expect — reduces time explaining' },
      { feature: 'Photo gallery', desc: 'Showcase their best work — new customers see the quality before visiting' },
      { feature: 'Google Maps integration', desc: 'One-tap directions — no more "where are you located?" calls' },
      { feature: 'Customer reviews displayed', desc: 'Social proof converts browsers into walkers-in' },
      { feature: 'Mobile-optimised', desc: '80% of barber searches are on phones — site looks perfect on any device' },
    ],
    competitorInsight: 'If there are other barbers nearby with websites, they\'re capturing the online search traffic. Every "barber near me" search that doesn\'t show this business is a lost customer going to a competitor.',
    painPoints: [
      'Relying only on walk-ins means income is unpredictable',
      'No way for customers to see their work before visiting',
      'Missing out on the entire "I just moved here, need a barber" market',
      'Can\'t compete with chain barbers who have strong online presence',
    ],
    afterSale: [
      { feature: 'SEO optimisation', desc: 'We\'ll make sure they rank for "barber in [area]" searches' },
      { feature: 'Monthly updates', desc: 'New photos, seasonal offers, updated hours — we handle it' },
      { feature: 'Review management', desc: 'Automatic Google review link sent to customers' },
      { feature: 'Social media integration', desc: 'Instagram feed embedded — their posts appear on the site automatically' },
    ],
    openingLine: 'I noticed you don\'t have a website yet — I\'ve actually put together a demo of what one could look like for your shop. Mind if I show you? Takes 30 seconds.',
  },

  salon: {
    whyWebsite: [
      '78% of women research a salon online before booking — they want to see styles, reviews, and pricing',
      'A professional website positions them as premium — clients associate web presence with quality',
      'Online booking fills cancellation gaps automatically — no more empty chairs costing money',
      'Portfolio galleries drive bookings — clients choose their stylist based on past work they can see online',
    ],
    industryStats: [
      { stat: '78% of salon clients research online before first visit', source: 'Phorest Salon Report' },
      { stat: 'Salons with online booking earn 27% more than phone-only', source: 'Booksy Industry Data' },
      { stat: 'UK hair & beauty industry worth £8.9 billion', source: 'NHBF 2025' },
      { stat: 'Average salon client spends £42 per visit', source: 'Treatwell UK' },
    ],
    whatTheyGet: [
      { feature: 'Stylist portfolios', desc: 'Each stylist showcases their specialties and best work' },
      { feature: 'Online booking', desc: 'Clients book their preferred stylist at their preferred time' },
      { feature: 'Price list', desc: 'Transparent pricing builds trust and reduces awkward conversations' },
      { feature: 'Before & after gallery', desc: 'The most powerful conversion tool — visual proof of quality' },
      { feature: 'Gift voucher page', desc: 'Extra revenue stream — clients buy vouchers for friends' },
      { feature: 'Product range showcase', desc: 'Sell retail products to clients who want to recreate their look at home' },
    ],
    competitorInsight: 'Premium salons all have websites. Not having one signals "budget" to potential high-value clients who would spend more per visit.',
    painPoints: [
      'Phone rings during appointments — missed calls mean missed bookings',
      'Can\'t showcase their best transformations to potential clients',
      'Competing against chains like Toni & Guy who dominate online search',
      'Clients can\'t see availability without calling — many just go elsewhere',
    ],
    afterSale: [
      { feature: 'Appointment reminders', desc: 'Automated text/email reduces no-shows' },
      { feature: 'Seasonal campaigns', desc: 'Christmas, Valentine\'s, Prom season — we update offers' },
      { feature: 'Blog content', desc: 'Hair care tips that boost Google rankings' },
      { feature: 'Email capture', desc: 'Build a mailing list for promotions and quiet-day offers' },
    ],
    openingLine: 'I\'ve been looking at salons in the area and noticed you\'re not showing up in Google searches for your specialties. I\'ve put together a demo to show you what that could look like — want to take a quick look?',
  },

  restaurant: {
    whyWebsite: [
      '90% of diners research restaurants online before visiting — menu, photos, and reviews drive the decision',
      'A website with the full menu stops customers going to competitors when they can\'t find yours on Google',
      'Online reservation reduces phone interruptions during service — staff can focus on guests',
      'Food photography on a website is the #1 driver of new restaurant visits after word-of-mouth',
    ],
    industryStats: [
      { stat: '90% check a restaurant online before dining', source: 'OpenTable 2025' },
      { stat: '77% visit a restaurant\'s website before deciding', source: 'MGH Survey' },
      { stat: 'Restaurants with websites see 30% more covers', source: 'Toast POS Data' },
      { stat: 'UK eating out market worth £96 billion', source: 'MCA Insight' },
    ],
    whatTheyGet: [
      { feature: 'Full menu with photos', desc: 'Customers decide what to order before arriving — faster table turns' },
      { feature: 'Online reservations', desc: 'Book a table 24/7 — no missed calls during rush' },
      { feature: 'Private dining/events page', desc: 'Capture corporate and celebration bookings — highest margin' },
      { feature: 'Location & parking info', desc: 'Remove friction — customers know exactly how to get there' },
      { feature: 'Special offers section', desc: 'Promote quiet days — "Tuesday 2-for-1" fills empty tables' },
      { feature: 'Allergen information', desc: 'Legal requirement made easy — builds trust with dietary needs' },
    ],
    competitorInsight: 'Every restaurant on Deliveroo and JustEat has an online presence. Not having a website means relying entirely on third-party platforms that take 25-35% commission.',
    painPoints: [
      'Losing 25-35% commission to delivery platforms for online orders',
      'Can\'t promote their own specials, events, or private dining',
      'Customers see competitors first when searching "restaurant near me"',
      'No way to build a direct relationship with customers for repeat visits',
    ],
    afterSale: [
      { feature: 'Menu updates', desc: 'Seasonal menu changes updated within 24 hours' },
      { feature: 'Event promotion', desc: 'Special nights, live music, themed evenings — we create the pages' },
      { feature: 'Direct ordering (future)', desc: 'Take orders through their own site — no platform commission' },
      { feature: 'Email list', desc: 'Capture regulars for "new menu" announcements and offers' },
    ],
    openingLine: 'I saw your reviews on Google and the food looks amazing. I noticed you don\'t have your own website though — customers can\'t see your full menu or book a table online. I\'ve mocked up what that could look like, want to see?',
  },

  cafe: {
    whyWebsite: [
      'Coffee shops are "destination" businesses — people specifically search for cafes to work in, meet friends, or grab breakfast',
      'A website showcasing the atmosphere converts "which cafe?" searches into visits',
      'Displaying your menu online prevents customers defaulting to chain cafes they already know',
      'WiFi-seeking remote workers look for cafes online — a website with "Free WiFi" listed attracts this high-spend audience',
    ],
    industryStats: [
      { stat: 'UK coffee market worth £4.2 billion', source: 'British Coffee Association' },
      { stat: '65% of 18-35s choose cafes based on online photos/vibe', source: 'Allegra World Coffee' },
      { stat: 'Average café customer spends £4.80 per visit', source: 'MCA Insight' },
      { stat: 'Independent cafes growing 7% year-on-year', source: 'Square UK Data' },
    ],
    whatTheyGet: [
      { feature: 'Menu with photos', desc: 'Showcase signature drinks and food — drives footfall' },
      { feature: 'Atmosphere gallery', desc: 'Show the vibe — cosy interior, outdoor seating, latte art' },
      { feature: '"What\'s on" section', desc: 'Open mic nights, book clubs, art displays — community events' },
      { feature: 'WiFi & facilities info', desc: 'Remote workers specifically search for this — high-value regulars' },
      { feature: 'Loyalty/offers page', desc: 'Digital loyalty cards and seasonal promotions' },
      { feature: 'Catering info', desc: 'Office catering and event platters — hidden revenue stream' },
    ],
    competitorInsight: 'Costa, Starbucks, and Nero dominate online search. An independent cafe without a website is invisible to anyone who doesn\'t already walk past it.',
    painPoints: [
      'Competing with chains who have massive marketing budgets',
      'No way to promote events, new menu items, or seasonal specials',
      'Losing the "work from a cafe" crowd who search online first',
      'Can\'t build a loyal community without an online presence',
    ],
    afterSale: [
      { feature: 'Event listings', desc: 'We add and promote their events and workshops' },
      { feature: 'Seasonal menus', desc: 'Pumpkin spice in autumn, iced drinks in summer — we update it' },
      { feature: 'Instagram integration', desc: 'Their coffee photos auto-appear on the site' },
      { feature: 'Google Business sync', desc: 'Hours, menu, photos kept in sync with Google' },
    ],
    openingLine: 'Love the look of your place from the outside. I noticed there\'s no website though — a lot of people search "cafe near me" especially remote workers looking for a place to set up. I\'ve put together something to show you what it could look like.',
  },

  plumber: {
    whyWebsite: [
      'Plumbing is an emergency service — when a pipe bursts at 11pm, people Google "emergency plumber near me" and call the first result',
      'Without a website, they\'re invisible in the exact moment someone desperately needs them',
      'A website with "Gas Safe Registered" badge builds instant trust — customers need to know they\'re qualified',
      'Displaying pricing (even "from £X") reduces the "how much?" barrier that stops people calling',
    ],
    industryStats: [
      { stat: '"Emergency plumber" gets 90,000+ UK searches per month', source: 'Google Keyword Planner' },
      { stat: '82% of people won\'t call a tradesperson without checking them online first', source: 'Checkatrade Survey' },
      { stat: 'Average UK plumber earns £35k — those with websites earn 40% more', source: 'Indeed UK' },
      { stat: 'Homeowners spend avg £300 per plumbing job', source: 'MyBuilder Data' },
    ],
    whatTheyGet: [
      { feature: 'Emergency callout banner', desc: '24/7 availability displayed prominently — captures urgent searches' },
      { feature: 'Gas Safe/accreditation badges', desc: 'Instant trust — customers see they\'re qualified and insured' },
      { feature: 'Service list with guide prices', desc: 'Customers know the ballpark before calling — more qualified leads' },
      { feature: 'Coverage area map', desc: 'Clear "we serve these areas" — no wasted calls from far away' },
      { feature: 'Customer testimonials', desc: 'Reviews from real local jobs — strongest trust signal for trades' },
      { feature: 'Click-to-call button', desc: 'One tap from mobile search to phone ringing — no friction' },
    ],
    competitorInsight: 'British Gas, HomeServe, and Checkatrade dominate plumber searches. A website levels the playing field — local trust beats corporate pricing.',
    painPoints: [
      'Missing emergency callouts that go to whoever shows up first on Google',
      'Relying on word-of-mouth alone limits growth to one area',
      'Can\'t show qualifications/insurance to sceptical customers online',
      'Paying Checkatrade/MyBuilder fees when a website generates leads for free',
    ],
    afterSale: [
      { feature: 'Google Ads setup', desc: 'Target "plumber in [area]" searches — pay only for clicks' },
      { feature: 'Review collection', desc: 'Automated review request after every job' },
      { feature: 'Seasonal content', desc: 'Boiler service reminders in autumn, burst pipe tips in winter' },
      { feature: 'Job gallery', desc: 'Before/after photos of bathroom fits and installations' },
    ],
    openingLine: 'I was looking at plumbers in the area and noticed you\'re not showing up when people search "plumber near me" — which is where most emergency callouts start these days. I\'ve put together a quick demo of what a site could look like for you.',
  },

  electrician: {
    whyWebsite: [
      'Electrical work requires trust — customers need to verify NICEIC/Part P certification before letting someone into their home',
      'A website is the only place to display accreditations, insurance, and past work permanently',
      'Landlord certificate searches are growing 20% year-on-year — a website captures this recurring revenue',
      'EV charger installation is booming — electricians with websites get these high-value £800+ jobs',
    ],
    industryStats: [
      { stat: '"Electrician near me" gets 110,000+ UK monthly searches', source: 'Google Keyword Planner' },
      { stat: '85% verify tradesperson qualifications online before hiring', source: 'TrustMark Survey' },
      { stat: 'UK EV charger market growing 35% annually', source: 'SMMT Data' },
      { stat: 'Average electrical job value: £450', source: 'MyBuilder Data' },
    ],
    whatTheyGet: [
      { feature: 'Accreditation display', desc: 'NICEIC, Part P, Trustmark badges front and centre' },
      { feature: 'Service categories', desc: 'Domestic, commercial, testing, EV — separate pages for each' },
      { feature: 'Free quote form', desc: 'Customers describe their job — qualified leads while they sleep' },
      { feature: 'Certificate info page', desc: 'EICR, PAT testing, landlord certs — recurring revenue explained' },
      { feature: 'Emergency contact', desc: 'Prominent "Call now" for power outages and faults' },
      { feature: 'Coverage area', desc: 'Clear postcode radius — saves time on out-of-area enquiries' },
    ],
    competitorInsight: 'EV charger installation is the growth market — customers search online first and pick electricians with professional websites showing EV experience.',
    painPoints: [
      'Customers can\'t verify qualifications without a website',
      'Missing the EV charger boom — these customers always research online',
      'Paying referral fees to platforms instead of generating own leads',
      'No way to capture landlord certificate renewal business systematically',
    ],
    afterSale: [
      { feature: 'Certificate reminders', desc: 'Automated "your EICR is due" emails to past customers' },
      { feature: 'EV charger page', desc: 'Dedicated page targeting the growing EV market' },
      { feature: 'Google Local setup', desc: 'Appear in the map pack for local electrician searches' },
      { feature: 'Job portfolio', desc: 'Before/after of consumer unit upgrades, rewires, installations' },
    ],
    openingLine: 'I noticed you\'re NICEIC registered — that\'s a big trust signal but right now there\'s nowhere for customers to see that when they search online. I\'ve put together a quick demo site that puts your accreditations front and centre.',
  },

  bakery: {
    whyWebsite: [
      'Custom cake orders are the highest-margin product — 90% of cake customers search and compare online',
      'A website with a gallery of past cakes converts browsers into buyers — visual products need visual marketing',
      'Wholesale and event catering enquiries come through websites — walk-ins only capture retail',
      'Displaying "baked fresh daily" with photos creates urgency that social media alone can\'t sustain',
    ],
    industryStats: [
      { stat: 'UK bakery market worth £4 billion', source: 'IBIS World' },
      { stat: '85% of celebration cake buyers search online first', source: 'Hitched UK' },
      { stat: 'Artisan bakeries growing 8% year-on-year', source: 'Mintel' },
      { stat: 'Average custom cake order: £150-£350', source: 'Cake International' },
    ],
    whatTheyGet: [
      { feature: 'Cake gallery', desc: 'Wedding, birthday, celebration cakes — the portfolio sells itself' },
      { feature: 'Online ordering', desc: 'Pre-order bread, pastries, and custom cakes — guaranteed sales' },
      { feature: 'Wholesale enquiry form', desc: 'Cafes and restaurants can request trade pricing' },
      { feature: 'Daily specials section', desc: 'Today\'s fresh items — drives footfall for perishable products' },
      { feature: 'Event catering page', desc: 'Corporate events, weddings, parties — high-value bulk orders' },
      { feature: 'Allergen & dietary info', desc: 'Gluten-free, vegan options — captures health-conscious market' },
    ],
    competitorInsight: 'Greggs and supermarket bakeries dominate convenience. An artisan bakery\'s weapon is quality and personality — a website tells that story.',
    painPoints: [
      'Custom cake customers can\'t see past work — they go to Instagram bakeries instead',
      'Missing wholesale and event catering opportunities that only come through websites',
      'Can\'t compete with supermarket bakeries on price — need to compete on quality and story',
      'No way to take pre-orders for bread — baking blind means waste',
    ],
    afterSale: [
      { feature: 'Seasonal pages', desc: 'Christmas, Easter, Valentine\'s — themed ordering pages' },
      { feature: 'Cake portfolio updates', desc: 'New creations added to the gallery as they make them' },
      { feature: 'Google Business sync', desc: 'Photos, hours, and specials kept updated automatically' },
      { feature: 'Email list', desc: '"Fresh this week" newsletter to drive regular visits' },
    ],
    openingLine: 'Your cakes look incredible from what I can see on Google — but there\'s no website where people can browse your full range and place orders. I\'ve put together a demo of what that could look like.',
  },
};

// Fallback for types not in the database
const DEFAULT_INTEL: IndustryIntel = {
  whyWebsite: [
    '81% of consumers research a business online before visiting or buying',
    'Businesses with websites are perceived as 50% more trustworthy than those without',
    'Google prioritises businesses with websites in local search results — no site means no visibility',
    'A website works 24/7 — it generates leads, answers questions, and takes enquiries while they sleep',
  ],
  industryStats: [
    { stat: '81% of consumers research online before buying', source: 'GE Capital Retail' },
    { stat: '75% judge credibility by website design', source: 'Stanford Web Credibility' },
    { stat: '97% of people learn about local businesses online', source: 'SEO Tribunal' },
    { stat: 'Businesses with sites grow 40% faster', source: 'Deloitte Digital' },
  ],
  whatTheyGet: [
    { feature: 'Professional design', desc: 'Tailored to their brand — colours, photos, and personality' },
    { feature: 'Mobile responsive', desc: 'Perfect on phones, tablets, and desktops' },
    { feature: 'Google optimised', desc: 'Built to rank in local search results' },
    { feature: 'Contact forms', desc: 'Capture leads 24/7 — no missed phone calls' },
    { feature: 'Social proof', desc: 'Reviews and testimonials displayed prominently' },
    { feature: 'Maps & directions', desc: 'One-tap directions from Google Maps' },
  ],
  competitorInsight: 'Their competitors with websites are capturing the 81% of customers who search online first.',
  painPoints: [
    'Invisible to anyone who doesn\'t already walk past',
    'Losing customers to competitors who show up on Google',
    'No way to showcase quality, reviews, or credentials online',
    'Relying solely on word-of-mouth limits growth potential',
  ],
  afterSale: [
    { feature: 'Content updates', desc: 'We keep the site fresh with new photos and content' },
    { feature: 'Performance reports', desc: 'Monthly visitor stats so they see the impact' },
    { feature: 'Google Business management', desc: 'Hours, photos, and posts kept updated' },
    { feature: 'Priority support', desc: 'Any changes needed — we handle them quickly' },
  ],
  openingLine: 'I noticed you don\'t have a website and I\'ve actually put together a demo to show you what one could look like. Want to take a quick look? Takes 30 seconds.',
};

function getIntel(businessType: string | null): IndustryIntel {
  if (!businessType) return DEFAULT_INTEL;
  const t = businessType.toLowerCase();
  for (const [key, intel] of Object.entries(INDUSTRY_INTEL)) {
    if (t.includes(key)) return intel;
  }
  // Check aliases
  if (t.includes('hair') || t.includes('beauty')) return INDUSTRY_INTEL.salon;
  if (t.includes('coffee')) return INDUSTRY_INTEL.cafe;
  if (t.includes('pizza') || t.includes('takeaway') || t.includes('kebab') || t.includes('chip')) return INDUSTRY_INTEL.restaurant;
  if (t.includes('pub') || t.includes('bar') || t.includes('grill')) return INDUSTRY_INTEL.restaurant;
  if (t.includes('builder') || t.includes('roofer') || t.includes('painter')) return INDUSTRY_INTEL.plumber;
  return DEFAULT_INTEL;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'why' | 'stats' | 'features' | 'after' | 'script';

interface BusinessIntelProps {
  businessName: string;
  businessType: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  hasWebsite?: boolean;
  services?: string[];
}

export function BusinessIntel({ businessName, businessType, googleRating, reviewCount, hasWebsite, services }: BusinessIntelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('script');
  const intel = getIntel(businessType);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Globe }> = [
    { id: 'script', label: 'Opening Line', icon: Lightbulb },
    { id: 'why', label: 'Why They Need It', icon: TrendingUp },
    { id: 'stats', label: 'Industry Data', icon: BarChart3 },
    { id: 'features', label: 'What They Get', icon: Package },
    { id: 'after', label: 'After the Sale', icon: Sparkles },
  ];

  return (
    <div>
      <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3">Business Intelligence</h3>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? 'text-slate-900 border-slate-900'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Suggested opening line</div>
                    <p className="text-[13px] text-amber-900 leading-relaxed italic">"{intel.openingLine}"</p>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Their likely pain points</div>
                <ul className="space-y-2">
                  {intel.painPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span className="text-[12px] text-slate-600 leading-relaxed">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Competitor angle</div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{intel.competitorInsight}</p>
              </div>
            </div>
          )}

          {activeTab === 'why' && (
            <ul className="space-y-3">
              {intel.whyWebsite.map((reason, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-600">{i + 1}</span>
                  </div>
                  <p className="text-[12px] text-slate-600 leading-relaxed">{reason}</p>
                </li>
              ))}
            </ul>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-3">
              {intel.industryStats.map((s, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] text-slate-900 font-medium">{s.stat}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Source: {s.source}</p>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-300 mt-2 italic">Use these stats during your pitch — businesses respond to data about their own industry.</p>
            </div>
          )}

          {activeTab === 'features' && (
            <div>
              <p className="text-[11px] text-slate-400 mb-3">What {businessName} gets with their website:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {intel.whatTheyGet.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50/50">
                    <div className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0 mt-2" />
                    <div>
                      <div className="text-[12px] font-medium text-slate-900">{f.feature}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'after' && (
            <div>
              <p className="text-[11px] text-slate-400 mb-3">What happens after they pay — use this to justify the monthly fee:</p>
              <div className="space-y-2.5">
                {intel.afterSale.map((f, i) => (
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
