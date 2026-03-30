import SwiftUI

// MARK: — Theme
// Design system aligned with the web dashboard (globals.css).
// Dark mode: pure black base with #0a0a0a surfaces (premium, high contrast).
// Light mode: off-white / light grey tones.

enum Theme {
    // MARK: — Backgrounds
    /// Primary page background. Dark: #000000  Light: #f2f2f2
    static let background = Color(adaptive: "#000000", light: "#f2f2f2")

    /// Card / surface. Dark: #0a0a0a  Light: #ffffff
    static let surface = Color(adaptive: "#0a0a0a", light: "#ffffff")

    /// Elevated surface (nav bars, modals). Dark: #111111  Light: #f7f7f7
    static let surfaceElevated = Color(adaptive: "#111111", light: "#f7f7f7")

    /// Press state surface. Dark: #1a1a1a  Light: #eeeeee
    static let surfacePressed = Color(adaptive: "#1a1a1a", light: "#eeeeee")

    // MARK: — Borders
    /// Standard border. Dark: #333333  Light: #e0e0e0
    static let border = Color(adaptive: "#333333", light: "#e0e0e0")

    /// Subtle separator. Dark: #222222  Light: #ebebeb
    static let borderSubtle = Color(adaptive: "#222222", light: "#ebebeb")

    // MARK: — Text
    /// Primary text. Dark: #ededed  Light: #111111
    static let textPrimary = Color(adaptive: "#ededed", light: "#111111")

    /// Secondary text. Dark: #999999  Light: #555555
    static let textSecondary = Color(adaptive: "#999999", light: "#555555")

    /// Muted / hint text. Dark: #666666  Light: #888888
    static let textMuted = Color(adaptive: "#666666", light: "#888888")

    // MARK: — Accent
    static let accent = Color(hex: "#0071E3")

    // MARK: — Status colours (aligned with web Tailwind palette)
    static let statusNew      = Color(hex: "#3b82f6")
    static let statusVisited  = Color(hex: "#eab308")
    static let statusPitched  = Color(hex: "#a78bfa")
    static let statusSold     = Color(hex: "#22c55e")
    static let statusRejected = Color(hex: "#ef4444")

    // MARK: — Geometry
    static let radiusCard:   CGFloat = 12
    static let radiusLarge:  CGFloat = 16
    static let radiusButton: CGFloat = 8
    static let borderWidth:  CGFloat = 1
}

// MARK: — Status helpers
extension Theme {
    static func statusColor(for status: String) -> Color {
        switch status.lowercased() {
        case "new":      return statusNew
        case "visited":  return statusVisited
        case "pitched":  return statusPitched
        case "sold":     return statusSold
        case "rejected": return statusRejected
        default:         return textMuted
        }
    }

    static func statusLabel(for status: String) -> String {
        switch status.lowercased() {
        case "new":      return "New"
        case "visited":  return "Visited"
        case "pitched":  return "Pitched"
        case "sold":     return "Sold"
        case "rejected": return "Rejected"
        default:         return status.capitalized
        }
    }
}

// MARK: — View Modifiers

/// Page entrance animation — fade + slide up, matching web's .page-enter
struct PageEntranceModifier: ViewModifier {
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 6)
            .onAppear {
                withAnimation(.easeOut(duration: 0.35)) {
                    appeared = true
                }
            }
    }
}

/// Staggered entrance — each item fades in with a delay
struct StaggeredEntranceModifier: ViewModifier {
    let index: Int
    let baseDelay: Double
    @State private var appeared = false

    func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 8)
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8).delay(Double(index) * baseDelay)) {
                    appeared = true
                }
            }
    }
}

/// Subtle noise texture overlay for dark surfaces
struct NoiseTextureModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.overlay(
            Canvas { context, size in
                for _ in 0..<Int(size.width * size.height * 0.003) {
                    let x = Double.random(in: 0...size.width)
                    let y = Double.random(in: 0...size.height)
                    let gray = Double.random(in: 0.3...0.7)
                    context.fill(
                        Path(ellipseIn: CGRect(x: x, y: y, width: 1, height: 1)),
                        with: .color(.white.opacity(gray * 0.06))
                    )
                }
            }
            .allowsHitTesting(false)
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        )
    }
}

/// Press feedback — scale + opacity on press
struct PressEffectButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

extension View {
    func pageEntrance() -> some View {
        modifier(PageEntranceModifier())
    }

    func staggeredEntrance(index: Int, baseDelay: Double = 0.06) -> some View {
        modifier(StaggeredEntranceModifier(index: index, baseDelay: baseDelay))
    }

    func noiseTexture() -> some View {
        modifier(NoiseTextureModifier())
    }
}

// MARK: — Hex colour initialiser
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    /// Creates an adaptive colour that switches between dark and light appearance.
    init(adaptive darkHex: String, light lightHex: String) {
        let darkColor  = UIColor(Color(hex: darkHex))
        let lightColor = UIColor(Color(hex: lightHex))
        let adaptive = UIColor { traits in
            traits.userInterfaceStyle == .dark ? darkColor : lightColor
        }
        self.init(adaptive)
    }
}
