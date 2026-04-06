# SalesFlow iOS — Design Notes

Reference for maintaining visual consistency across branches and future changes.

## Color Palette (Muted Professional Tones)

These replace the original neon colors. Use throughout the app for icons, accents, and status indicators.

| Purpose | Hex | Description |
|---------|-----|-------------|
| Slate blue | `#5B7B9D` | Primary icon color, informational |
| Sage green | `#6B8F7B` | Success, earnings, positive |
| Muted lavender | `#7B7B9D` | Secondary/tech, AI features |
| Warm taupe | `#9B8B6B` | Warnings, objections, caution |
| Muted rose | `#B06060` | Errors, validation failures |
| Success green | `#5A8A6E` | Completion checkmarks |
| Success bg | `#E8F0EC` | Light success background |
| Accent blue | `#0071E3` | CTAs, progress bars, active states (unchanged) |

**Rule**: No neon/saturated colors. All accent colors should feel desaturated and professional.

## Grid Background

Reusable `SubtleGridBackground` component in `SignUpView.swift` (should be extracted if used elsewhere).

```swift
SubtleGridBackground()
    .ignoresSafeArea()
```

- **Spacing**: 28pt between lines
- **Line weight**: 0.5pt
- **Opacity**: 6% (dark mode: white at 6%, light mode: black at 6%)
- **Rendering**: Uses `Canvas` for performance
- **Adapts**: Reads `@Environment(\.colorScheme)` automatically

To use on any screen, layer it in a ZStack:
```swift
ZStack {
    Theme.background.ignoresSafeArea()
    SubtleGridBackground().ignoresSafeArea()
    // ... your content
}
```

## Theme System (Theme.swift)

All views should use `Theme.*` constants, never hardcoded hex for structural colors:

| Token | Dark | Light | Use for |
|-------|------|-------|---------|
| `Theme.background` | `#1a1a1a` | `#f2f2f2` | Page backgrounds |
| `Theme.surface` | `#242424` | `#ffffff` | Cards, inputs |
| `Theme.surfaceElevated` | `#2c2c2c` | `#f7f7f7` | Nav bars, modals, pill backgrounds |
| `Theme.border` | `#3a3a3a` | `#e0e0e0` | Card borders, dividers |
| `Theme.borderSubtle` | `#2e2e2e` | `#ebebeb` | Subtle separators |
| `Theme.textPrimary` | `#f0f0f0` | `#111111` | Headings, body text |
| `Theme.textSecondary` | `#9a9a9a` | `#555555` | Descriptions, labels |
| `Theme.textMuted` | `#666666` | `#888888` | Hints, placeholders, meta |
| `Theme.accent` | `#0070F3` | `#0070F3` | Buttons, links, active states |

## Card Pattern

Standard card used across onboarding and dashboard:

```swift
HStack(alignment: .top, spacing: 14) {
    Image(systemName: "icon.name")
        .font(.system(size: 18, weight: .medium))
        .foregroundStyle(Color(hex: "#5B7B9D"))  // muted accent
        .frame(width: 40, height: 40)
        .background(Color(hex: "#5B7B9D").opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))

    VStack(alignment: .leading, spacing: 3) {
        Text("Title")
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Theme.textPrimary)
        Text("Description")
            .font(.system(size: 13))
            .foregroundStyle(Theme.textSecondary)
    }
    Spacer(minLength: 0)
}
.padding(14)
.background(Theme.surface)
.clipShape(RoundedRectangle(cornerRadius: 14))
```

## Geometry Constants

| Token | Value | Use |
|-------|-------|-----|
| `Theme.radiusCard` | 12pt | Cards, panels |
| `Theme.radiusButton` | 8pt | Buttons, inputs |
| `Theme.borderWidth` | 1pt | All strokes |
| Card padding | 14pt | Inside cards |
| Section gap | 10pt | Between cards in a list |
| Page margin | 24pt | Horizontal page padding |

## Theme Picker Pattern

Compact inline picker used on onboarding welcome screen:

```swift
HStack(spacing: 0) {
    Image(systemName: "paintbrush")
    Text("Appearance")
    Spacer()
    HStack(spacing: 2) {
        ForEach(AppearanceStore.Preference.allCases) { pref in
            // circle.lefthalf.filled / sun.max.fill / moon.fill
            // Selected: white icon on accentBlue circle
            // Unselected: muted icon, no background
        }
    }
    .background(Theme.surfaceElevated)
    .clipShape(Capsule())
}
.background(Theme.surface)
.clipShape(RoundedRectangle(cornerRadius: 14))
```

## Status Colors (Unchanged)

These are defined in Theme.swift and stay as-is for lead status badges:

| Status | Hex | Token |
|--------|-----|-------|
| New | `#4C8BF5` | `Theme.statusNew` |
| Visited | `#B8922A` | `Theme.statusVisited` |
| Pitched | `#8B6BB5` | `Theme.statusPitched` |
| Sold | `#3D9E5F` | `Theme.statusSold` |
| Rejected | `#C0392B` | `Theme.statusRejected` |
