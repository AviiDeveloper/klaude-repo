import SwiftUI

// MARK: — Theme
// All colours are adaptive: they switch automatically between light and dark mode.
//
// Dark mode:  dark grey tones (not pure black)
// Light mode: off-white / light grey tones (not pure white)

enum Theme {
    // MARK: — Backgrounds
    /// Primary page background. Dark: #1a1a1a  Light: #f2f2f2
    static let background = Color(adaptive: "#1a1a1a", light: "#f2f2f2")

    /// Card / surface. Dark: #242424  Light: #ffffff
    static let surface = Color(adaptive: "#242424", light: "#ffffff")

    /// Elevated surface (nav bars, modals). Dark: #2c2c2c  Light: #f7f7f7
    static let surfaceElevated = Color(adaptive: "#2c2c2c", light: "#f7f7f7")

    // MARK: — Borders
    /// Standard border. Dark: #3a3a3a  Light: #e0e0e0
    static let border = Color(adaptive: "#3a3a3a", light: "#e0e0e0")

    /// Subtle separator. Dark: #2e2e2e  Light: #ebebeb
    static let borderSubtle = Color(adaptive: "#2e2e2e", light: "#ebebeb")

    // MARK: — Text
    /// Primary text. Dark: #f0f0f0  Light: #111111
    static let textPrimary = Color(adaptive: "#f0f0f0", light: "#111111")

    /// Secondary text. Dark: #9a9a9a  Light: #555555
    static let textSecondary = Color(adaptive: "#9a9a9a", light: "#555555")

    /// Muted / hint text. Dark: #666666  Light: #888888
    static let textMuted = Color(adaptive: "#666666", light: "#888888")

    // MARK: — Accent
    static let accent = Color(hex: "#0070F3")

    // MARK: — Status colours (same in both modes — muted, professional)
    static let statusNew      = Color(hex: "#4C8BF5")
    static let statusVisited  = Color(hex: "#B8922A")
    static let statusPitched  = Color(hex: "#8B6BB5")
    static let statusSold     = Color(hex: "#3D9E5F")
    static let statusRejected = Color(hex: "#C0392B")

    // MARK: — Geometry
    static let radiusCard:   CGFloat = 12
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
