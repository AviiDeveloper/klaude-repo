# Build Order — Step by Step

Build in this exact order. Each step should compile and run before moving to the next.

## Step 1: Foundation
1. `Theme/Colors.swift` — all colour hex constants as static Color properties
2. `Theme/Typography.swift` — font helpers matching the design system
3. `Models/User.swift` + `Models/Lead.swift` + `Models/Stats.swift` — Codable structs
4. `Services/APIClient.swift` — generic HTTP client with async/await
5. `Services/AuthService.swift` — login + Keychain token storage

**Test:** Build succeeds, no UI yet.

## Step 2: Auth Flow
1. `Views/Auth/LoginView.swift` — PIN login screen
2. `salesflowApp.swift` — route to login or main tab view based on auth state
3. `Components/StatusDot.swift` + `Components/SectionHeader.swift` — tiny reusable components

**Test:** App launches, shows login, can authenticate (even if mock data for now).

## Step 3: Tab Shell + Leads Dashboard
1. `Views/Leads/LeadsView.swift` — stats bar + lead list
2. `Components/LeadCard.swift` — reusable lead row component
3. `Components/StatCard.swift` — stat number + label
4. `Components/OpenIndicator.swift` — open/closed logic
5. Wire up MainTabView with 4 tabs (Leads, Map, Payouts, Profile as placeholders)
6. `ViewModels/LeadsViewModel.swift` — fetch from API, filter logic

**Test:** App shows dashboard with leads from API. Filters work. Pull to refresh works.

## Step 4: Lead Detail
1. `Views/Leads/LeadDetailView.swift` — tabbed view (Overview, Prepare, Pitch, Follow Up)
2. `ViewModels/LeadDetailViewModel.swift` — single lead data + actions
3. Status update functionality (PATCH /leads/:id/status)
4. Talking points generation (local logic)
5. Follow-up date picker + notes save

**Test:** Tap a lead → see detail. Change status works. Follow-up saves.

## Step 5: Map
1. `Views/Map/MapView.swift` — MapKit with lead pins
2. `ViewModels/MapViewModel.swift` — pin data from leads + user location
3. CLLocationManager permission request
4. Pin tap → lead card overlay
5. "Get Directions" → Apple Maps

**Test:** Map shows pins. Tap pin shows info. Directions open Apple Maps.

## Step 6: Demo Viewer
1. `Views/Shared/DemoViewerView.swift` — WKWebView full screen
2. Share button → generate demo link via API + share sheet

**Test:** Tap "Show Demo" on a lead with demo_site → see website in WebView.

## Step 7: Camera
1. `Views/Shared/CameraView.swift` — AVCaptureSession camera
2. Category picker (storefront, interior, card, menu, signage)
3. Photo saved locally
4. Upload to API in background

**Test:** Take a photo from lead detail. Photo appears in gallery.

## Step 8: GPS Visit Tracking
1. `Services/LocationService.swift` — start/end visit sessions
2. Timer showing visit duration
3. Background GPS pings
4. Verification (within 100m of business)

**Test:** Tap "I'm here" on a lead. Timer counts up. Tap "Leave" → session saved with duration.

## Step 9: Payouts + Profile
1. `Views/Payouts/PayoutsView.swift` — earnings dashboard
2. `Views/Profile/ProfileView.swift` — account info + navigation
3. `Views/Profile/SettingsView.swift` — PIN change, area, notifications
4. `Views/Profile/HelpView.swift` — FAQ accordion
5. `Views/Profile/ReferralsView.swift` — invite link + stats

**Test:** All tabs have content. Settings expand/collapse. FAQ works.

## Step 10: Brief Walkthrough
1. `Views/Leads/BriefWalkthroughView.swift` — full-screen swipeable cards
2. PageTabView or custom carousel
3. "Start Visit" button on last card

**Test:** Tap "Quick Briefing" → step through cards → "Start Visit" starts GPS tracking.

## Step 11: Polish
1. Pull-to-refresh on all list views
2. Loading states (skeleton/spinner)
3. Error states (no connection, API error)
4. Empty states (no leads, no sales)
5. Animations (subtle, 0.2s transitions)
6. Haptic feedback on status changes

## Step 12: Offline + Push (last)
1. SwiftData models for offline cache
2. Sync journal for offline changes
3. Push notification registration
4. Background refresh
