# Design System — Vercel-Inspired Dark Theme

## Philosophy
This app should feel like a professional tool, not a consumer app. Think Vercel dashboard, Linear, or Raycast. Information-dense, sharp, minimal decoration.

**DO:**
- Use SF Pro (system font) at various weights
- Use SF Mono for numbers, money, timestamps
- Use thin 1pt borders (#333)
- Use #000 backgrounds with #0a0a0a card surfaces
- Keep text sizes small and precise (13-15pt for body)
- Use native iOS patterns (NavigationStack, TabView, List, .sheet)
- Make it feel fast — no unnecessary animations
- Use negative tracking on headlines (-0.03em equivalent)

**DO NOT:**
- Use coloured icon backgrounds (the "vibe coded" look)
- Use thick borders or card shadows
- Use gradients on buttons or cards
- Use playful/gamified UI (no emojis in UI, no confetti)
- Import custom fonts — use system SF Pro / SF Mono
- Make it look like a web app in a phone frame
- Use rounded-full pills on everything

## Colour Palette

### Backgrounds
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | `#000000` | Main background |
| `bg-surface` | `#0A0A0A` | Cards, panels |
| `bg-elevated` | `#111111` | Hover states, expanded sections |
| `bg-input` | `#111111` | Input field backgrounds |

### Borders
| Token | Hex | Usage |
|-------|-----|-------|
| `border-default` | `#333333` | Card borders, dividers |
| `border-subtle` | `#222222` | Section dividers inside cards |
| `border-input` | `#333333` | Input field borders |
| `border-active` | `#FFFFFF` | Focused input, active tab |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#FFFFFF` | Headlines, primary content |
| `text-secondary` | `#999999` | Descriptions, secondary info |
| `text-muted` | `#666666` | Timestamps, labels, placeholders |
| `text-faint` | `#444444` | Disabled text |

### Accent (use sparingly)
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-blue` | `#0070F3` | Active nav tab, links, focus rings |
| `accent-green` | `#00C853` | Sold status, positive |
| `accent-yellow` | `#F5A623` | Visited status, warnings |
| `accent-purple` | `#7928CA` | Pitched status |
| `accent-red` | `#EE0000` | Rejected, errors, destructive |

### Status Dots (small 6pt circles)
| Status | Colour |
|--------|--------|
| New | `#0070F3` (blue) |
| Visited | `#F5A623` (yellow) |
| Pitched | `#7928CA` (purple) |
| Sold | `#00C853` (green) |
| Rejected | `#EE0000` (red) |

## Typography (SF Pro)

### SwiftUI Font Mapping
```swift
// Headlines
.font(.system(size: 28, weight: .semibold, design: .default))
.tracking(-0.5)  // Tight tracking on headlines

// Section titles
.font(.system(size: 17, weight: .semibold))

// Body text
.font(.system(size: 15, weight: .regular))

// Secondary text
.font(.system(size: 13, weight: .regular))

// Labels / uppercase
.font(.system(size: 11, weight: .medium))
.textCase(.uppercase)
.tracking(1.5)

// Monospace (for numbers, money, stats)
.font(.system(size: 15, weight: .semibold, design: .monospaced))

// Monospace small
.font(.system(size: 13, weight: .regular, design: .monospaced))
```

## Component Patterns

### Cards
```swift
// Standard card
RoundedRectangle(cornerRadius: 12)
    .fill(Color(hex: "0A0A0A"))
    .overlay(
        RoundedRectangle(cornerRadius: 12)
            .stroke(Color(hex: "333333"), lineWidth: 1)
    )
```

### Buttons
```swift
// Primary button (white on black)
Button("Action") { }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 12)
    .background(Color.white)
    .foregroundColor(.black)
    .cornerRadius(8)
    .font(.system(size: 13, weight: .medium))

// Secondary button (outline)
Button("Action") { }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 12)
    .background(Color(hex: "333333"))
    .foregroundColor(.white)
    .cornerRadius(8)
    .font(.system(size: 13, weight: .medium))
```

### Tab Bar
Use native TabView with custom styling:
- Background: #000
- Active: white icon + white text + blue accent line
- Inactive: #666 icon + #666 text
- 4 tabs: Leads, Map, Payouts, Profile

### Navigation Bar
- Background: #000 with 1pt bottom border (#222)
- Title: white, semibold
- Back button: system default (blue tint)

### Input Fields
```swift
TextField("Placeholder", text: $value)
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .background(Color(hex: "111111"))
    .cornerRadius(8)
    .overlay(
        RoundedRectangle(cornerRadius: 8)
            .stroke(Color(hex: "333333"), lineWidth: 1)
    )
    .font(.system(size: 15))
    .foregroundColor(.white)
```

### Status Indicators
Small 6pt filled circles, not badges or pills:
```swift
Circle()
    .fill(statusColor)
    .frame(width: 6, height: 6)
```

### Section Headers (inside cards)
```swift
Text("SECTION NAME")
    .font(.system(size: 11, weight: .medium))
    .foregroundColor(Color(hex: "666666"))
    .textCase(.uppercase)
    .tracking(1.5)
```

### Dividers
```swift
Divider()
    .background(Color(hex: "222222"))
```

## Spacing
- Section padding: 20pt
- Card internal padding: 16-20pt
- Between cards: 12pt
- Between sections: 24pt
- Safe area insets: respect them always

## Animations
- Keep minimal. No bouncing, no spring animations.
- Page transitions: use default NavigationStack push/pop
- Status changes: 0.2s ease-out colour transition
- Pull to refresh: use native .refreshable

## Dark Mode ONLY
This app is dark mode only. Do not support light mode. Set:
```swift
.preferredColorScheme(.dark)
```
