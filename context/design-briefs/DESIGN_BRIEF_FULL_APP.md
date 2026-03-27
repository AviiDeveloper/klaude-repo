# Design Brief: SalesFlow — Full App Redesign

## What is SalesFlow?
A platform where independent sales contractors walk into local businesses (barbers, cafes, plumbers) and sell them a professionally built website for £350. The app gives them leads, talking points, demo sites, and tracks their commissions.

**Three audiences, three experiences:**
1. **Salesperson dashboard** (port 4300) — the main app salespeople use daily
2. **Customer demo page** (public `/demo/[code]`) — what business owners see when shown their demo site
3. **Admin ops panel** (port 4400) — monitoring dashboard for system operators

---

## 1. SALESPERSON DASHBOARD

### Tech
- Next.js 14, TypeScript, Tailwind CSS, `lucide-react` icons
- File: `apps/sales-dashboard/src/`
- Currently has a dark sidebar (slate-950) + white content area

### Pages that need design

#### Login `/login`
Current: Basic form with name + PIN inputs
Needs: Branded, clean, sets the tone for the whole app

```tsx
// Current structure — just needs visual redesign
<div className="login-page">
  <Logo />
  <h1>SalesFlow</h1>
  <p>Walk in. Pitch. Sell.</p>
  <input placeholder="Username" />
  <input placeholder="PIN" type="password" />
  <button>Sign In</button>
  <a href="/signup">New here? Create an account</a>
</div>
```

#### Signup `/signup`
Current: 8-step onboarding wizard (Welcome → Earnings sim → Day walkthrough → Tools → Name → PIN → Area → Done)
Needs: Each step is its own screen with large typography, one action per screen

```tsx
// Steps array — each becomes a full-screen view
const steps = [
  { type: 'welcome', title: 'Start earning today', subtitle: 'Walk into businesses. Show them their new website. Earn £50 per sale.' },
  { type: 'earnings', title: 'Set your own income', subtitle: 'Interactive slider: visits/week → projected earnings' },
  { type: 'walkthrough', title: 'How a typical day works', subtitle: '4 illustrated steps' },
  { type: 'tools', title: 'Everything you need', subtitle: 'AI demo sites, talking points, objection scripts' },
  { type: 'input', field: 'name', title: "What should we call you?" },
  { type: 'input', field: 'pin', title: 'Create a quick PIN' },
  { type: 'input', field: 'area', title: 'What area do you cover?' },
  { type: 'done', title: "You're in!" },
];
```

#### Dashboard `/dashboard`
Current: Stats row + filter tabs + lead table
Needs: Better information density, useful at a glance

```tsx
// Data available per lead
interface Lead {
  business_name: string;      // "Mannys Barbers"
  business_type: string;      // "barber"
  postcode: string;           // "M4 1HN"
  phone: string;              // "0161 000 0001"
  google_rating: number;      // 4.7
  google_review_count: number; // 89
  status: 'new' | 'visited' | 'pitched' | 'sold' | 'rejected';
  has_demo_site: boolean;
  follow_up_date?: string;    // ISO date
  contact_name?: string;      // "Ahmed"
  contact_role?: string;      // "Owner"
  opening_hours: string[];    // ["Mon-Fri: 9-5:30", "Sat: 9-4"]
  services: string[];         // ["Skin Fade", "Beard Trim"]
}

// Stats available
interface Stats {
  queue: number;     // unvisited leads
  visited: number;
  pitched: number;
  sold: number;
  total_commission: number; // £50 per sale
}
```

Layout: Sidebar (dark) + main content area (white/light)
Sidebar items: Leads, Map, Payouts, Referrals | Help, Settings, Account

#### Lead Detail `/lead/[id]`
Current: Tabbed view (Overview → Prepare → Pitch → Follow Up)
Needs: Two-column on desktop. Left = actions + status. Right = business intel.

```tsx
// Tabs
const tabs = ['Overview', 'Prepare', 'Pitch', 'Follow Up'];

// Overview tab content
- Status badge (new/visited/pitched/sold)
- Action buttons (Mark Visited, Mark Pitched, Mark Sold, Reject)
- Quick call button (tap to dial)
- Show Demo Site button
- Follow-up date picker
- Contact person (name + role)

// Prepare tab content
- Talking points (generated from scraped data)
- "Don't mention" list
- Business hours (is it open now?)
- Services they offer

// Pitch tab content
- Objection handler cards
- Price breakdown
- Demo site full-screen viewer

// Follow Up tab content
- Notes history
- Follow-up reminder
- Contact details
```

#### Map `/map`
Current: Leads grouped by postcode in a list
Needs: Actual map (or at minimum, a better visual representation of areas)

#### Payouts `/payouts`
Current: Balance card + weekly chart + funnel + payment history
Needs: Clean financial dashboard feel

```tsx
// Data
- Available balance (£50 × sales count)
- Projected monthly earnings
- Close rate, visit-to-sale rate
- Weekly activity chart (visits + sales per day)
- Conversion funnel (assigned → visited → pitched → sold)
- Payment history list (pending/paid)
- Tax section (total earned, HMRC export)
```

#### Settings `/settings`
Current: Expandable sections (Security, Area, Notifications, Legal)
Needs: Clean settings page, iOS-style grouped rows

#### Profile `/profile`
Current: User info + stats + commission summary + activity log
Needs: Clean account page

#### Help `/help`
Current: FAQ accordion + quick links + contact
Needs: Clean help centre

#### Referrals `/referrals`
Current: Dark invite card + referral link + stats
Needs: Clean referral page with share functionality

---

## 2. CUSTOMER DEMO PAGE

### Current file
`apps/sales-dashboard/src/app/demo/[code]/page.tsx`

### What it does
Business owner opens a link like `salesflow.co.uk/demo/abc123`. They see a full-screen preview of their demo website with a floating "Get this website" button. Clicking it opens a multi-step purchase card.

### Current multi-step flow
```
Step 0: Intro — "Make it yours" + £350/£25mo pricing + "I'm interested"
Step 1: Name — "What's your name?" + bottom-border input
Step 2: Phone — "Best number to reach you?" + bottom-border input
Step 3: Changes — "Any changes you'd like?" + optional textarea + Skip/Continue
Step 4: Confirm — order summary + "Purchase" button
```

### Design requirements
- Demo site fills 100vh in an iframe — this is the hero, the product
- Floating CTA at bottom center, fades in after 2s
- Purchase card floats bottom-right on desktop (380px), inset on mobile (16px margins)
- Light overlay when card is open (bg-black/10, no blur)
- Each step animates in from right (translateX 8px)
- Progress dots at top of card
- Borderless inputs (bottom line only)
- This page has NO sidebar, NO navigation, NO auth — completely standalone

### Current code (full file)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface DemoData {
  business_name: string;
  demo_domain: string | null;
  status: string;
}

export default function CustomerDemoPage() {
  const params = useParams();
  const code = params.code as string;
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<'viewing' | 'buying' | 'done'>('viewing');
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // ... (state management + API calls - keep as-is)

  // Visual states:
  // phase='viewing': full-screen iframe + floating CTA button
  // phase='buying': iframe + dim overlay + floating card (step 0-4)
  // phase='done': iframe + confirmation pill at bottom
}
```

---

## 3. ADMIN OPS PANEL

### Tech
- Separate Next.js app at `apps/admin-panel/`
- Port 4400
- Desktop-only (not mobile)

### Pages
- Dashboard: KPI cards + conversion funnel + alerts + weekly stats
- Pipeline: Agent DAG visualization + run history + status
- Salesforce (Team): Table of contractors with stats
- Leads: Filterable table of all leads with status
- Settings: System config

### Current sidebar
Dark sidebar (slate-950) with amber accent icons. Nav: Dashboard, Pipeline, Team, Leads, Settings.

---

## Design Tokens (current)

```css
/* Salesperson app */
--primary: #0f172a;        /* slate-900 — headings, buttons */
--text: #0f172a;           /* slate-900 */
--text-secondary: #64748b; /* slate-500 */
--text-muted: #94a3b8;     /* slate-400 */
--text-faint: #cbd5e1;     /* slate-300 */
--surface: #f8fafc;        /* slate-50 */
--border: #e2e8f0;         /* slate-200 */
--accent: #2563eb;         /* blue-600 — links, active states */
--success: #059669;        /* emerald-600 */
--danger: #dc2626;         /* red-600 */
--warning: #d97706;        /* amber-600 */

/* Sidebar */
--sidebar-bg: #020617;     /* slate-950 */
--sidebar-text: #64748b;   /* slate-500 */
--sidebar-active-bg: rgba(255,255,255,0.1);
--sidebar-active-icon: #fbbf24; /* amber-400 */

/* Typography */
font-family: 'Inter', system-ui, sans-serif;
/* Sizes: 10px labels, 11px metadata, 12px small, 13px body, 14px emphasis, 15px inputs, 20-28px headings */
/* Tracking: -0.03em headings, -0.01em body, 0.08em uppercase labels */
```

---

## What I need back

For each page/component you redesign, give me the **complete TSX file** with Tailwind classes. I'll drop it directly into the codebase. The files are:

| Page | File path |
|------|-----------|
| Login | `apps/sales-dashboard/src/app/login/page.tsx` |
| Signup | `apps/sales-dashboard/src/app/signup/page.tsx` |
| Dashboard | `apps/sales-dashboard/src/app/dashboard/page.tsx` |
| Lead Detail | `apps/sales-dashboard/src/app/lead/[id]/page.tsx` |
| Map | `apps/sales-dashboard/src/app/map/page.tsx` |
| Payouts | `apps/sales-dashboard/src/app/payouts/page.tsx` |
| Settings | `apps/sales-dashboard/src/app/settings/page.tsx` |
| Profile | `apps/sales-dashboard/src/app/profile/page.tsx` |
| Help | `apps/sales-dashboard/src/app/help/page.tsx` |
| Referrals | `apps/sales-dashboard/src/app/referrals/page.tsx` |
| Customer Demo | `apps/sales-dashboard/src/app/demo/[code]/page.tsx` |
| Sidebar | `apps/sales-dashboard/src/components/AppShell.tsx` |

### Constraints
- `'use client'` at top of every page component
- Tailwind CSS only (already configured with all default + extended colours)
- `lucide-react` for icons
- `next/navigation` for `usePathname`, `useParams`, `useRouter`
- All API calls use `fetch('/api/...')` — don't change endpoints
- Keep all existing state management and API logic — just redesign the JSX/styles
- Inter font is loaded globally

### Design direction
- Premium, editorial, restrained
- Think Linear, Stripe, Notion — not Bootstrap or Material
- Monochrome with one accent colour
- Typography-driven hierarchy
- Generous whitespace
- Subtle animations (opacity + translateY, never bounce)
- No gradients on interactive elements
- No decorative icons/badges unless they serve a purpose
