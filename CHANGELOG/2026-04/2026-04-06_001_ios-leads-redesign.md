# iOS Leads Page Redesign — DESIGN_NOTES Compliance

**Date:** 2026-04-06

## What changed
- `apps/ios/SalesFlow/SalesFlow/LeadsView.swift` — replaced all hardcoded hex colors with Theme tokens, added SubtleGridBackground, redesigned LeadRow to use DESIGN_NOTES card pattern with icon-in-box layout
- `apps/ios/SalesFlow/SalesFlow/LeadDetailView.swift` — added SubtleGridBackground, updated business header to use slate blue accent, bullet cards now use muted palette colors (lavender, sage, rose), objection rows have icon badges, review stars use warm taupe

## Why
The leads page used hardcoded light-mode colors (`.white`, `#F8F7F5`, `#9CA3AF` etc.) that broke dark mode and didn't follow the established design system documented in DESIGN_NOTES.md. The redesign brings both LeadsView and LeadDetailView into compliance with the muted professional palette and Theme token system.

## Stack
- SwiftUI, SwiftData, iOS

## Key design changes
- **LeadRow**: Changed from flat white card with shadow to icon-in-box card pattern (slate blue `#5B7B9D` icon backgrounds, 14pt padding, 14pt corner radius, Theme.surface + border)
- **Stats header**: Earnings now use sage green `#6B8F7B` instead of saturated `#16A34A`
- **Filter bar**: Uses Theme.textPrimary/textMuted instead of hardcoded grays, accent underline instead of black
- **Search bar**: Uses Theme.surfaceElevated background, Theme.textMuted icons
- **BulletCard**: Now accepts accentColor param — services=lavender, trust=sage, avoid=rose
- **ObjectionRow**: Added warm taupe icon badges
- **Business header**: Initials avatar uses slate blue tint instead of gray
- **Grid background**: Both views now show SubtleGridBackground

## How to verify
- Open Xcode, run the `salesflow` scheme on simulator
- Check LeadsView in both light and dark mode — all colors should adapt
- Navigate to a lead detail — grid background should be visible, header uses blue tint
- Check Prepare tab — bullet items should have colored icon badges

## Known issues
- None
