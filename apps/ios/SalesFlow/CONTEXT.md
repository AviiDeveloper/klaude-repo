# SalesFlow iOS App — Context for Claude Agent

## What This App Is
A mobile sales tool for independent contractors who walk into local businesses and sell them websites. The contractor earns £50 per sale. The app gives them everything they need: lead assignments, business intelligence, talking points, demo site viewer, GPS visit tracking, and photo capture.

## Backend API
Base URL: `http://localhost:4350` (dev) — will be a real URL in production.

### Auth
- `POST /auth/login` — body: `{"name": "demo", "pin": "1234"}` → response: `{"token": "...", "user": {...}}`
- Token sent as `Authorization: Bearer {token}` on all subsequent requests

### Endpoints
- `GET /leads` → `[{assignment_id, business_name, business_type, address, postcode, phone, google_rating, google_review_count, has_demo_site, demo_site_domain, status, follow_up_at, contact_person, contact_role, opening_hours, services, best_reviews, trust_badges, avoid_topics}]`
- `GET /leads/:id` → full lead detail
- `PATCH /leads/:id/status` → `{status: "visited"|"pitched"|"sold"|"rejected", lat, lng}`
- `POST /leads/:id/visit` → `{action: "start"|"end", lat, lng}`
- `POST /leads/:id/photos` → multipart form with photo + category
- `GET /stats` → `{queue, visited, pitched, sold, earned, ...}`

## Design System (match the web dashboard)
- **Background**: `#000000` (pure black)
- **Surface/Cards**: `#0a0a0a`
- **Borders**: `#333333` (subtle, thin)
- **Muted text**: `#666666`
- **Secondary text**: `#999999`
- **Primary text**: `#FFFFFF`
- **Accent**: `#0070F3` (Vercel blue — used sparingly for active states, links)
- **Status colours**: blue=new, yellow=visited, purple=pitched, green=sold, red=rejected
- **Font**: SF Pro (system default — DO NOT import custom fonts)
- **Mono font**: SF Mono (for numbers, stats, money)
- **Corner radius**: 12pt on cards, 8pt on buttons
- **No decorative gradients. No shadows. No coloured icon backgrounds.**
- **Thin 1pt borders, not thick. #333 not lighter.**
- **Vercel-inspired**: information-dense, professional, not playful

## App Structure (Expo Router equivalent in SwiftUI)

```
SalesFlowApp (entry)
  → LoginView (if not authenticated)
  → MainTabView (if authenticated)
      Tab 1: LeadsView (lead list + stats)
      Tab 2: MapView (leads on map + directions)
      Tab 3: PayoutsView (earnings, commission tracking)
      Tab 4: ProfileView (account, settings, help)

  Navigation destinations:
    → LeadDetailView (tabbed: Overview, Prepare, Pitch, Follow Up)
    → BriefWalkthroughView (full-screen step-by-step briefing)
    → DemoViewerView (WebView showing demo site to client)
    → CameraView (capture business photos)
    → SettingsView
    → HelpView
    → Legal pages
```

## Key Features to Build

### 1. Leads Dashboard
- Stats bar at top: Queue, Visited, Pitched, Sold, Earned
- Tab filters: All, New, Visited, Pitched, Sold
- Lead cards showing: name, type, postcode, rating, status dot, "Open now" indicator
- Pull to refresh
- Tap card → LeadDetailView

### 2. Lead Detail (Tabbed)
- **Overview**: Business info, quick actions (status dropdown), contact, hours, open/closed indicator
- **Prepare**: Talking points, avoid topics, trust badges, business intel
- **Pitch**: Demo site viewer button, objection handlers, price breakdown
- **Follow Up**: Reminder date, notes, conversation log, contact person

### 3. GPS Visit Tracking
- "I'm here" button starts a visit session
- CoreLocation tracks position
- Duration timer shown on screen
- "Leave" button ends session, logs duration + GPS proof
- Verified if within 100m of business postcode

### 4. Camera
- Full-screen camera with category picker (storefront, interior, business card, menu, signage)
- Photos saved to app storage, uploaded to API in background
- GPS tagged automatically

### 5. Demo Site Viewer
- WKWebView showing the demo site URL
- "Show to client" full-screen mode
- Share button generates shareable link
- Customer can tap "Get This Website" within the viewer

### 6. Map
- MapKit with pins for each lead
- Colour-coded by status
- Tap pin → lead detail
- "Get directions" opens Apple Maps
- Shows user's current location

### 7. Offline Support
- Cache all leads locally with SwiftData
- Queue status changes when offline
- Sync when back online
- Show offline indicator in nav bar

## Commission Model
- £50 flat per sale
- Weekly payouts
- Self-employed contractor (not employee)
- No targets, no minimum activity requirements

## What NOT to Do
- No coloured icon backgrounds (the "vibe coded" look)
- No thick borders or card shadows
- No playful/gamified UI elements
- No gradients on buttons
- Don't use Inter font — use system SF Pro
- Don't make it look like a web app in a phone frame
- USE NATIVE iOS PATTERNS: NavigationStack, .sheet, .alert, TabView, List
