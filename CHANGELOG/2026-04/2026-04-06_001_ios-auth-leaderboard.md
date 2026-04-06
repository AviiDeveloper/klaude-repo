# iOS App: Biometric Auth, Contractor ID, Leaderboard

## What changed
### Phase 1: Foundation + Auth + Identity
- **Fixed broken app entry point** (`SalesFlowApp.swift`) — was rendering Xcode boilerplate `ContentView` with `Item.self` schema. Now properly gates on `AuthStore.isAuthenticated` and `isUnlocked`, renders `LoginView` → `UnlockView` → `ModeSelectView` flow
- **Deleted boilerplate** — removed `ContentView.swift` and `Item.swift` (unused Xcode templates)
- **Added Face ID / Touch ID authentication** (`BiometricManager.swift`) — `LocalAuthentication` framework wrapper with `canUseBiometrics`, `authenticate()`, adaptive icon/label for Face ID, Touch ID, and Optic ID
- **Added custom PIN keypad** (`PINKeypadView.swift`) — 3x4 numeric grid with haptic feedback, shake animation on wrong PIN, visual dot indicators
- **Updated AuthStore** — added `isUnlocked` state gate, `storedPIN` in Keychain, `biometricEnabled` preference, `unlockWithPIN()` and `unlock()` methods
- **Updated LoginView** — after first successful login, prompts user to enable biometrics via alert
- **Added contractor ID** — backend generates `SF-NNNNN` format on registration, returned in login/register/me responses. iOS `User` model extended with `contractorNumber`. ProfileView displays it with monospace font and copy-to-clipboard button

### Phase 2: Leaderboard
- **New backend endpoint** (`routes/leaderboard.ts`) — `GET /leaderboard?period=weekly|monthly|alltime` aggregates `lead_assignments` (status=sold) by user with ranking
- **New LeaderboardView** — period filter tabs (weekly/monthly/all-time), top 3 podium with gold/silver/bronze medals, full ranked list with initials avatars, contractor IDs, sales counts, earnings. Current user highlighted with accent border/background
- **Dashboard integration** — trophy icon in LeadsView toolbar (top-left) opens leaderboard as a sheet

### Bug fixes
- Fixed `Stats.seeded` reference (undefined) → `Stats.empty` in LeadsView and PayoutsView

## Why
User requested iOS app refinement: biometric auth with PIN fallback, contractor identity numbers, and sales leaderboard.

## Stack
- SwiftUI, LocalAuthentication, SwiftData
- Express.js, SQLite (better-sqlite3)
- Theme.swift design system

## Files
### New
- `apps/ios/salesflow/SalesFlow/BiometricManager.swift`
- `apps/ios/salesflow/SalesFlow/PINKeypadView.swift`
- `apps/ios/salesflow/SalesFlow/LeaderboardView.swift`
- `apps/mobile-api/src/routes/leaderboard.ts`

### Modified
- `apps/ios/salesflow/SalesFlow/SalesFlowApp.swift` — fixed entry point
- `apps/ios/salesflow/SalesFlow/AuthStore.swift` — biometric unlock flow
- `apps/ios/salesflow/SalesFlow/LoginView.swift` — biometric enable prompt
- `apps/ios/salesflow/SalesFlow/Models.swift` — User.contractorNumber, LeaderboardEntry
- `apps/ios/salesflow/SalesFlow/APIClient.swift` — fetchLeaderboard endpoint
- `apps/ios/salesflow/SalesFlow/ProfileView.swift` — contractor ID badge
- `apps/ios/salesflow/SalesFlow/LeadsView.swift` — trophy button + leaderboard sheet
- `apps/ios/salesflow/SalesFlow/PayoutsView.swift` — Stats.seeded → Stats.empty
- `apps/mobile-api/src/db.ts` — contractor_number column migration
- `apps/mobile-api/src/routes/auth.ts` — return contractor_number
- `apps/mobile-api/src/index.ts` — mount /leaderboard route

### Deleted
- `apps/ios/salesflow/SalesFlow/ContentView.swift`
- `apps/ios/salesflow/SalesFlow/Item.swift`

## How to verify
1. Open `apps/ios/salesflow/` in Xcode — should build without errors
2. Launch app → should show LoginView (not boilerplate)
3. After login → biometric enable prompt appears (on supported devices)
4. Subsequent launches → Face ID/Touch ID unlock, PIN fallback
5. Profile tab → contractor ID visible (e.g. SF-00001) with copy button
6. Leads dashboard → trophy icon top-left → opens leaderboard sheet
7. Backend: `curl -H "Authorization: Bearer <token>" http://localhost:4350/leaderboard?period=weekly`

## Known issues
- Leaderboard shows all users including those with 0 sales (intentional — shows community size)
- PIN verification is local-only (compares against stored PIN, doesn't hit API) — suitable for app unlock gate
