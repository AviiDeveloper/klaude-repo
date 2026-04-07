# SalesFlow iOS — Audit & Handoff

**Date:** 2026-04-07
**Branch:** `claude/elated-easley`
**Status:** App runs on physical device via Tailscale, 8 seeded test leads visible

---

## Branch State

6 commits ahead of main. All committed, clean working tree.

```
2565fd94 fix(ios): add Info.plist with ATS exception for local networking
0006407c fix(ios): point device builds at Mac Tailscale IP for dev testing
5270adf7 feat(ios): add debug seeder and auto-login for simulator testing
34e4a429 fix(ios): force dark mode on dashboard via preferredColorScheme
939bf99a fix(ios): default appearance to dark, add toolbar backgrounds
69bb16e6 fix(ios): redesign leads page to follow DESIGN_NOTES.md
```

### To merge to main
Review these commits — some (34e4a429, 939bf99a) add `.preferredColorScheme` calls that don't fix the dark mode issue. The real dark mode fix was done by Xcode Claude (replacing hardcoded hex with Theme tokens). Those `.preferredColorScheme` calls are harmless but unnecessary — can be cleaned up.

---

## Dev Testing Setup

| Component | Location | How to run |
|-----------|----------|------------|
| **Mobile API** | `apps/mobile-api/` | `cd apps/mobile-api && npm run dev` (port 4350) |
| **Server DB** | Whichever worktree started the server | Check `lsof -i :4350` → `lsof -p PID \| grep cwd` |
| **Xcode project** | `.claude/worktrees/elated-easley/apps/ios/SalesFlow/` | Open `.xcodeproj` from worktree, NOT main |
| **Simulator** | hits `localhost:4350` | Just works when server is running |
| **Physical device** | hits `100.66.206.3:4350` (Mac Tailscale) | Tailscale must be on both Mac and phone |
| **Test account** | name: `test`, PIN: `1111` | 8 seeded leads in database |
| **Debug auto-login** | `AuthStore.swift` `#if DEBUG` | Skips auth when server is unreachable |

### Gotcha: Which database?
The mobile-api resolves its DB path relative to its working directory: `../mission-control/mission-control.db`. If you start it from a worktree, it uses THAT worktree's DB. Check with `lsof -p PID | grep cwd`.

---

## What's Production Ready (✅)

### Authentication & Onboarding
- 10-step signup with PIN creation, area selection, terms agreement
- Login with name + PIN
- Biometric unlock offer (Face ID / Touch ID)
- PIN fallback
- Appearance picker (System / Light / Dark) on first screen

### Lead Management
- Full lead list with filter tabs (All / New / Visited / Pitched / Rejected)
- Search by name, type, postcode
- Lead detail with 4 tabs: Overview, Prepare, Pitch, Follow Up
- Status updates with GPS logging
- Visit tracking (start/end with timer and location)
- Follow-up date scheduling
- Demo site preview (full-screen client presentation mode)

### Design System
- Adaptive Theme tokens for light/dark mode
- Muted professional color palette per DESIGN_NOTES.md
- SubtleGridBackground component
- Card pattern with icon-in-box layout
- Status colors for lead badges

### Sales Academy
- Training path (Duolingo-style vertical progression)
- 4 lesson types: editorial, scenario MCQ, roleplay dialogue, quickfire
- Progress tracking with score
- API-backed completion reporting

### Client Demo Mode
- Full-screen website preview
- Offline-first: bundled HTML → cache → live URL
- Share via QR code, AirDrop, or Email

### Other
- Leaderboard (weekly / monthly / all-time)
- Payouts dashboard with earned amount, breakdown, next payout date
- Profile with performance metrics, help modal, sign out
- Offline support (pending status updates queued locally)

---

## What Needs Work (⚠️)

### API Endpoint Mismatches — Fix Before Production
1. **Visit tracking**: `APIClient.postVisit()` calls `/leads/:id/visit` but server has `/visits/start` and `/visits/end`
2. **Stats endpoint**: `APIClient.fetchStats()` calls `/stats` but server has `/leads/stats/summary`

### Dark Mode — Still Broken in Dashboard
The leads page and dashboard tabs render in light mode despite the app preference being "dark". Root cause: `ModeSelectView` forces `.preferredColorScheme(.dark)` on itself, but when `NavigationLink` pushes `MainTabView`, the nested `NavigationStack` inside `LeadsView` creates a new UIKit hosting context that inherits the system (light) color scheme instead.

**What was tried and didn't work:**
- `.preferredColorScheme(.dark)` at every level (Group, MainTabView, LeadsView)
- `window.overrideUserInterfaceStyle` via UIViewRepresentable
- `applyToAllWindows()` from AppearanceStore

**What actually fixed it (done by Xcode Claude, not this session):**
- Replacing all hardcoded hex colors (`#F8F7F5`, `.white`, `#9CA3AF`, etc.) with Theme tokens (`Theme.background`, `Theme.surface`, `Theme.textMuted`)
- This means the views render correctly in BOTH modes — the `.preferredColorScheme` propagation issue becomes irrelevant because the colors adapt automatically

**Remaining:** Some views still have hardcoded colors that need the same treatment (check Xcode Claude's changes vs what was done here)

### Missing Features
1. **Photo upload UI** — APIClient endpoint exists, server route exists, no UI form to capture/upload storefront photos
2. **Lead intel capture** — POST `/leads/:id/intel` server endpoint exists, no UI form in Follow Up tab (shows placeholder text)
3. **Conversation notes** — Follow Up tab says "Conversation history and notes will appear here after visits are logged" — no implementation
4. **Notification setup** — ProfileView has the row, no push notification registration flow

### Stubs / Legal Links
- "Contractor Agreement" link in Profile — no handler
- "Privacy Policy" / "Terms of Service" — no handlers
- These need real URLs or in-app content before App Store submission

---

## What's Next — Priority Order

### P0: Fix before testing further
1. **Fix API endpoint mismatches** (visit tracking + stats) — 30min
2. **Verify dark mode** — confirm Xcode Claude's hardcoded color fix covers all views

### P1: Complete for MVP
3. **Photo upload UI** — add camera button to lead detail, upload to server
4. **Lead intel form** — add fields to Follow Up tab (interest level, objections, contact info, notes)
5. **Conversation history** — show activity log entries in Follow Up tab

### P2: Before App Store
6. **Legal content** — privacy policy, terms of service, contractor agreement URLs
7. **Push notifications** — register token, handle incoming
8. **App Store assets** — screenshots, description, app icon review
9. **Production API URL** — swap from Tailscale dev IP to Pi production (`100.93.24.14:4350`)
10. **HTTPS** — add TLS to the mobile API (required for App Store, ATS will block HTTP in production)

### P3: Nice to have
11. **Offline sync queue** — surface pending status updates to user, auto-retry
12. **Lead map clustering** — group nearby pins at zoom levels
13. **Training analytics** — show completion stats in Profile

---

## File Inventory (26 Swift files)

| File | Purpose | Theme Compliant |
|------|---------|----------------|
| SalesFlowApp.swift | App entry, auth gate, model container | ✅ |
| LoginView.swift | Name + PIN login | ✅ |
| SignUpView.swift | 10-step onboarding | ✅ |
| ModeSelectView.swift | Dashboard / Demo / Academy hub | ⚠️ Intentionally dark-only |
| MainTabView.swift | Tab container | ✅ |
| LeadsView.swift | Lead list + filters + search | ✅ |
| LeadDetailView.swift | 4-tab lead detail | ✅ |
| LeadsMapView.swift | Map with lead pins | ✅ |
| PayoutsView.swift | Earnings dashboard | ✅ |
| ProfileView.swift | User profile + settings | ✅ |
| LeaderboardView.swift | Rankings | ✅ |
| AcademyPathView.swift | Training path | ⚠️ Intentionally light-only |
| AcademyLessonView.swift | Lesson player | ⚠️ Intentionally light-only |
| ClientPresentationView.swift | Full-screen demo | ⚠️ Black shell |
| QRCodeView.swift | QR display | ✅ |
| DemoShareSheet.swift | Share options | ✅ |
| PINKeypadView.swift | PIN entry keypad | ✅ |
| WebViewContainer.swift | WKWebView wrapper | N/A |
| Theme.swift | Color tokens + helpers | ✅ Core |
| Models.swift | Lead, Stats, DTOs | N/A |
| APIClient.swift | Network layer | N/A |
| AuthStore.swift | Auth state singleton | N/A |
| AppearanceStore.swift | Theme preference | N/A |
| DemoSiteCache.swift | Offline demo caching | N/A |
| BiometricManager.swift | Face ID / Touch ID | N/A |
| DebugSeeder.swift | Test data for simulator | N/A (DEBUG only) |
