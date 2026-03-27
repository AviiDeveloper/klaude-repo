# Screens & Features — Complete Specification

## App Flow

```
App Launch
  ├── Not authenticated → LoginView
  ├── First time → OnboardingView (3-4 slides)
  └── Authenticated → MainTabView
       ├── Tab 1: LeadsView (dashboard)
       ├── Tab 2: MapView
       ├── Tab 3: PayoutsView
       └── Tab 4: ProfileView

Navigation from LeadsView:
  LeadDetailView (tabbed: Overview | Prepare | Pitch | Follow Up)
    ├── BriefWalkthroughView (full-screen step-by-step cards)
    ├── DemoViewerView (WebView showing demo site)
    ├── CameraView (capture business photos)
    └── ShareDemoView (generate + share link)

Navigation from ProfileView:
  ├── SettingsView
  ├── HelpView
  ├── ReferralsView
  ├── Legal (Terms, Privacy, Contractor Agreement)
  └── PayoutsView (also accessible from tab)
```

---

## Screen 1: Login

**Purpose:** Quick PIN-based authentication.

**Layout:**
- App logo/name centred at top
- Username text field
- PIN entry (4-6 digits, secure field)
- "Sign In" button
- "New here? Create account" link at bottom

**Behaviour:**
- POST /auth/login on submit
- Store token in Keychain via SecureStore
- Navigate to MainTabView on success
- Shake animation on wrong PIN

---

## Screen 2: Leads Dashboard (Tab 1)

**Purpose:** The home screen. What the salesperson sees every morning.

**Layout:**
```
┌─────────────────────────────────┐
│ Good morning, Ahmed             │
│ Your first £50 is one visit away│  ← dynamic motivational text
├─────────────────────────────────┤
│ ┌──────┐┌──────┐┌──────┐┌─────┐│
│ │Queue ││Visit.││Pitch ││Sold ││  ← stats row
│ │  5   ││  0   ││  0   ││  0  ││
│ └──────┘└──────┘└──────┘└─────┘│
├─────────────────────────────────┤
│ All │ New │ Visited │ Pitched   │  ← filter tabs
├─────────────────────────────────┤
│ Follow-ups due:                 │  ← if any exist
│ ┌─Greggs · call back Thu──────┐│
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│ ┌─Mannys Barbers──────────────┐│
│ │ Barber · M4 1HN · ★4.7     ││  ← lead card
│ │ ● Open now · Demo ready     ││
│ │ 📞 Call                     ││
│ └─────────────────────────────┘│
│ ┌─Greggs────────────────────┐  │
│ │ Bakery · M1 2PF · ★4.2   │  │
│ │ ● Open · Demo ready       │  │
│ └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Motivational header** changes based on state:
- No visits yet: "Your first £50 is one visit away."
- Some visits: "3 leads waiting for you."
- Sales today: "£100 earned today. Keep going."
- After hours: "Nice work today. 3 visits, 1 sale."

**Lead cards show:**
- Business name (bold)
- Type · Postcode · Star rating (review count)
- Status dot (colour-coded)
- "Open now" / "Closes at 5:30" / "Closed" (calculated from opening_hours)
- "Demo ready" badge if has_demo_site
- Quick call button (tel: link)

**Pull to refresh:** Calls GET /leads

---

## Screen 3: Lead Detail (Tabbed)

**Purpose:** Everything a salesperson needs before, during, and after a visit.

**Header (always visible):**
- Back button
- Business name + type
- Status indicator (dot + text)
- "Open until 5:30pm" live indicator
- Call button (tel: link)

**Tab: Overview**
- Quick Actions dropdown: Mark Visited, Pitched, Sold, Rejected
- Business info: address, phone, rating, review count
- Opening hours
- Services list
- "Show Briefing" button → opens BriefWalkthroughView

**Tab: Prepare**
- Talking points (from intel engine):
  - "No website detected — perfect candidate"
  - "Rated 4.7★ with 89 reviews — they care about reputation"
  - "Don't mention: free quotes, emergency, installation"
  - "Mention: Walk-Ins Welcome, Experienced Barbers"
- Business-specific intel:
  - Why this business needs a website (personalised)
  - Competitor analysis
  - Top customer review to quote

**Tab: Pitch**
- "Show Demo Site" button → opens DemoViewerView (WebView)
- Price breakdown card: £350 setup, £25/month
- Objection handler expandable list:
  - "I don't need a website" → suggested response
  - "Too expensive" → break down the value
  - "I need to think about it" → share demo link
- "Share Demo Link" button → generates shareable URL
- "Take Photo" button → opens CameraView

**Tab: Follow Up**
- Set reminder date picker (inline, not full-screen)
- Notes text area (saves on blur)
- Contact person fields (name + role)
- Conversation log (timestamped entries)
- Interest level selector: Hot / Warm / Cold
- Objections heard (multi-select dropdown)
- Business contact: phone, address (with "Get Directions" → Apple Maps)

---

## Screen 4: Brief Walkthrough (Full-screen modal)

**Purpose:** Step-by-step guided briefing before entering the business. One card at a time.

**Steps:**
1. "Who is [Business Name]?" — type, location, rating, services
2. "Why they need a website" — personalised reasons based on scraped data
3. "What to say" — opening line, key talking points
4. "What NOT to say" — avoid topics
5. "The pitch" — show demo, price, CTA
6. "Close or follow up" — if yes: mark sold. If maybe: share link + set reminder

**Navigation:** Swipe or next/back buttons. "Start Visit" button on last card.

---

## Screen 5: Map (Tab 2)

**Purpose:** See all leads geographically. Plan the day's route.

**Layout:**
- Full-screen Apple MapKit map
- Pins for each lead, colour-coded by status
- User's current location shown
- Bottom sheet (half-height) listing nearby leads sorted by distance
- Tap pin → shows lead card overlay
- "Get Directions" button → opens Apple Maps with the business postcode

**Lead pins:**
- Blue: new
- Yellow: visited
- Purple: pitched
- Green: sold
- Red: rejected
- Different pin sizes? Or all same with colour only.

---

## Screen 6: Demo Viewer

**Purpose:** Show the AI-generated demo website to the business owner on your phone.

**Layout:**
- Full-screen WKWebView
- Thin top bar: "Mannys Barbers · Demo" + Close button
- URL loaded: the customer demo page URL
- Landscape rotation supported
- "Share" button → generates shareable link + share sheet

---

## Screen 7: Camera

**Purpose:** Capture photos of the business (storefront, interior, business card, menu).

**Layout:**
- Full-screen camera preview
- Category selector at bottom: Storefront | Interior | Card | Menu | Signage
- Capture button
- GPS coordinates captured automatically
- Preview captured photo with Save/Retake options
- Photos saved locally, uploaded to API in background

---

## Screen 8: Payouts (Tab 3)

**Purpose:** Track earnings and commissions.

**Layout:**
- Available balance (large, prominent)
- Projected monthly earnings
- Total earned (all time)
- Performance metrics: close rate, visit-to-sale rate
- Weekly activity chart (simple bar chart: visits + sales per day)
- Conversion funnel: Assigned → Visited → Pitched → Sold
- Payment history table
- Tax export button (HMRC)

---

## Screen 9: Profile (Tab 4)

**Purpose:** Account management and navigation to secondary pages.

**Layout:**
- User avatar (initial letter circle) + name
- Area: "M1 · Manchester"
- Member since date
- Quick stats: total visits, sales, earned
- Links to:
  - Settings (PIN change, area change, notifications)
  - Help (FAQ, pitch scripts, contact support)
  - Referrals (invite friends, earn bonus)
  - Legal (Terms, Privacy, Contractor Agreement)
  - Sign Out

---

## Screen 10: Referrals

**Purpose:** Invite friends to earn referral bonus.

**Layout:**
- "Earn £25 per referral" hero card
- Unique referral link with copy button
- Share buttons (WhatsApp, SMS, Email)
- Stats: invited, joined, earned
- List of referrals with their sales count

---

## Screen 11: Settings

**Purpose:** Account preferences.

**Expandable sections:**
- Security: Change PIN
- Coverage Area: Update postcode
- Notifications: Email toggle, push toggle
- Legal: Terms, Privacy, Download Data, Delete Account

---

## Screen 12: Help

**Purpose:** Self-service support.

**Layout:**
- Quick link cards: Getting Started Guide, Pitch Scripts, Best Practices
- FAQ accordion grouped by category (Getting Started, Pricing, Pitching, Technical)
- Contact support: email + phone
