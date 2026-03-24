import SwiftUI

// SalesFlow Design Tokens — matches web Vercel dark theme
enum SF {
    // Colours
    static let bg = Color(hex: "000000")
    static let surface = Color(hex: "0a0a0a")
    static let elevated = Color(hex: "111111")
    static let hover = Color(hex: "1a1a1a")

    static let border = Color(hex: "333333")
    static let borderSubtle = Color(hex: "222222")

    static let text = Color(hex: "ededed")
    static let textSecondary = Color(hex: "999999")
    static let textMuted = Color(hex: "666666")
    static let textFaint = Color(hex: "444444")

    static let blue = Color(hex: "60a5fa")
    static let yellow = Color(hex: "eab308")
    static let purple = Color(hex: "c084fc")
    static let green = Color(hex: "4ade80")
    static let red = Color(hex: "f87171")

    // Status colours
    static func statusColor(_ status: String) -> Color {
        switch status {
        case "new": return blue
        case "visited": return yellow
        case "pitched": return purple
        case "sold": return green
        case "rejected": return red
        default: return textMuted
        }
    }

    // Typography
    static let titleFont = Font.system(size: 24, weight: .semibold, design: .default)
    static let headlineFont = Font.system(size: 17, weight: .semibold, design: .default)
    static let bodyFont = Font.system(size: 15, weight: .regular, design: .default)
    static let captionFont = Font.system(size: 13, weight: .regular, design: .default)
    static let monoFont = Font.system(size: 13, weight: .medium, design: .monospaced)
    static let labelFont = Font.system(size: 11, weight: .medium, design: .default)
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
