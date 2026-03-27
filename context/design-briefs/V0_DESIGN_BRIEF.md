# SalesFlow — Redesign Brief for Vercel v0

## CRITICAL DESIGN REFERENCE

This app must look like **Apple's website** — not a SaaS dashboard, not a Bootstrap template, not "vibe coded". Study these specific patterns from apple.com:

### Apple design rules to follow:
1. **NO sidebar navigation.** Use a slim horizontal top bar like apple.com's nav (logo left, links centre, icon right)
2. **NO card borders.** Cards use subtle background fills (`bg-gray-50` or `bg-gray-100`), never `border border-gray-200`
3. **Massive headlines.** 40-56px, -0.04em tracking, font-weight 600-700. Headlines ARE the design.
4. **Extreme whitespace.** Sections have 80-120px vertical padding. Nothing feels cramped.
5. **One accent colour only.** Blue (`#0071E3`) for links and primary actions. Everything else is black/gray/white.
6. **Light body text.** Body text is `text-gray-500` or `text-gray-600`, weight 400. NOT dark.
7. **Buttons:** Primary = filled blue rounded-full. Secondary = outlined black rounded-full. Never dark/slate buttons.
8. **Links with arrows.** Text links use ↗ or → suffix, not buttons. Blue colour.
9. **Product cards.** Large rounded-2xl cards with bg-gray-50/100, no borders, large product-style presentation.
10. **Empty states.** Just text. "Your Bag is empty." — large heading, one link below. No icons, no illustrations.
11. **Font: SF Pro / Inter** at -0.03em tracking on all text. System font stack.

### What NOT to do:
- NO dark sidebars
- NO slate-950 backgrounds
- NO amber/orange accents
- NO emoji icons in tables
- NO status toggle switches in tables
- NO badge pills with colours
- NO gradient anything
- NO shadow-2xl on cards (use shadow-none or very subtle)
- NO uppercase tracking-wide labels (Apple never does this)

---

## Tech Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- `lucide-react` for the few icons needed
- Every page: `'use client';`
- Font: Inter (loaded globally)
- NO shadcn, NO external UI libraries

---

## APP LAYOUT

**Top navigation bar** (not sidebar):
```
[⚡ SalesFlow]     [Leads]  [Map]  [Payouts]  [Referrals]  [Help]     [👤]
```
- White background, thin bottom border
- Logo left, nav links centre, account icon right
- Active link: underlined or heavier weight, NOT highlighted background
- Mobile: hamburger menu or bottom tab bar

---

## PAGE 1: Dashboard `/dashboard` (the Leads page)

Inspired by: Apple Watch shop page — big heading, horizontal filter tabs, product cards

```
Leads                                    [Connect with a Specialist ↗ style link]

All  ·  New  ·  Visited  ·  Pitched  ·  Sold

[Large rounded cards in a grid/list, each card = one business lead]
```

Each lead card (Apple Watch card style — bg-gray-50, rounded-2xl, no border, generous padding):
```
Mannys Barbers                          ★ 4.7 (89)
Barber · M4 1HN

[Call ↗]  [View Demo ↗]
```

Stats at top — NOT in bordered cards. Just large numbers with small labels below them, in a horizontal row:
```
5 queue    0 visited    0 pitched    0 sold    £0 earned
```

Fetch pattern:
```tsx
const [stats, setStats] = useState(null);
const [leads, setLeads] = useState([]);
useEffect(() => {
  Promise.all([fetch('/api/stats'), fetch('/api/leads')])
    .then(([s, l]) => Promise.all([s.json(), l.json()]))
    .then(([s, l]) => { setStats(s.data); setLeads(l.data ?? []); });
}, []);
```

Lead interface:
```ts
interface Lead {
  id: string;
  business_name: string;
  business_type: string;
  postcode: string;
  phone: string;
  google_rating: number;
  google_review_count: number;
  status: 'new' | 'visited' | 'pitched' | 'sold' | 'rejected';
  has_demo_site: boolean;
  follow_up_date?: string;
  contact_name?: string;
  opening_hours: string[];
  services: string[];
}
```

Clicking a card → `router.push('/lead/${lead.id}')`

---

## PAGE 2: Lead Detail `/lead/[id]`

Inspired by: Apple product page — large centred heading, key info below, action buttons

```
← Leads

Mannys Barbers
Barber · M4 1HN · ★ 4.7 (89 reviews)

[Call Now]  [Show Demo ↗]  [Mark Visited]

---

Overview    Prepare    Pitch    Follow Up        ← tab navigation (underline style)
```

Apple-style tabs (underline active, not pills/buttons).

Content sections use generous padding, simple lists, no boxed cards unless needed.

Fetch: `fetch('/api/leads/${id}').then(r => r.json()).then(d => setLead(d.data))`
Status: `fetch('/api/leads/${id}/status', { method: 'POST', body: JSON.stringify({ status }) })`

---

## PAGE 3: Login `/login`

Inspired by: Apple Sign In page — centred, minimal

```
⚡ SalesFlow

Sign in to SalesFlow.

[Username input — clean, no label, just placeholder]
[PIN input — masked]

[Sign In →]  (blue filled rounded-full button)

New here? Create an account ↗
```

POST: `fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ name, pin }) })`

---

## PAGE 4: Signup `/signup`

Multi-step wizard, one question per screen. Apple-style large centred text.

Steps:
0. "Start earning today." / "Walk into businesses. Show them their website. Earn £50 per sale." / [Get Started →]
1. Earnings — slider showing visits/week → projected monthly (£50 × sales × 4.33)
2. How it works — 4 simple steps with minimal icons
3. Tools — what the app gives you
4. "What should we call you?" — single large input
5. "Create a PIN." — 4-6 digit input + confirm
6. "What area do you cover?" — postcode input
7. "You're in, [name]." / [Open Dashboard →]

Progress dots, Back/Continue navigation.

POST: `fetch('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, pin, area_postcode }) })`

---

## PAGE 5: Map `/map`

Leads grouped by postcode. Simple, clean.

Fetch: `fetch('/api/leads').then(r => r.json()).then(d => groupByPostcode(d.data ?? []))`

Group leads by postcode prefix client-side.

---

## PAGE 6: Payouts `/payouts`

Inspired by: Apple Bag page — simple, clean, mostly text

```
Payouts

Available balance
£0.00
0 sales at £50 each

[Withdraw]  [Export ↗]

---

This Week                               Projected This Month
£0                                      £0

---

Payment History

No payments yet.
Your first £50 appears after your first sale.
```

Fetch: `fetch('/api/stats').then(r => r.json()).then(d => setStats(d.data))`

---

## PAGE 7: Settings `/settings`

Simple expandable sections. Apple System Preferences style.

---

## PAGE 8: Profile `/profile`

Fetch: `fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.data))`

---

## PAGE 9: Help `/help`

FAQ accordion. Contact section.

---

## PAGE 10: Referrals `/referrals`

Invite card + referral link + stats.

Fetch: `fetch('/api/referrals').then(r => r.json()).then(d => setData(d.data))`

---

## PAGE 11: Customer Demo `/demo/[code]`

**NO top navigation. Completely standalone public page.**

Full-screen iframe + floating "Get this website" pill + multi-step purchase card.

Steps: Intro (pricing) → Name → Phone → Changes (optional) → Confirm → Purchase

Fetch: `fetch('/api/demo-links/${code}')`
Submit: `fetch('/api/demo-links/${code}', { method: 'POST', body: JSON.stringify({ name, phone, notes }) })`
Iframe src: `/demo-sites/${demo_domain}.html`

---

## CONSTRAINTS

1. `'use client';` on every page
2. Tailwind CSS only — NO shadcn, NO external UI libs
3. `lucide-react` icons only (use sparingly — Apple barely uses icons)
4. `useRouter`/`useParams` from `next/navigation`
5. All API calls: relative paths `/api/...`, responses wrapped in `{ data: ... }`
6. Animations: CSS keyframes via `<style jsx>`, NOT tailwindcss-animate
7. `/demo/[code]` page has NO navigation bar — fully standalone
8. Use `{'\u00A3'}` for £, `&apos;` for apostrophes in JSX
9. **Primary blue: `#0071E3`** — the only accent colour
10. **No dark backgrounds** anywhere except the demo page's floating purchase pill

## OUTPUT

11 separate complete TSX files, one per page. File names:
```
dashboard/page.tsx
demo/[code]/page.tsx
help/page.tsx
lead/[id]/page.tsx
login/page.tsx
map/page.tsx
payouts/page.tsx
profile/page.tsx
referrals/page.tsx
settings/page.tsx
signup/page.tsx
```
