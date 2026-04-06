import SwiftUI
import Combine

// MARK: — AppearanceStore
// Persists the user's appearance preference and exposes it as an ObservableObject
// so the root view can apply .preferredColorScheme() and ProfileView can show a picker.

final class AppearanceStore: ObservableObject {
    static let shared = AppearanceStore()

    enum Preference: String, CaseIterable {
        case system = "system"
        case light  = "light"
        case dark   = "dark"

        var label: String {
            switch self {
            case .system: return "System"
            case .light:  return "Light"
            case .dark:   return "Dark"
            }
        }

        /// Maps to SwiftUI's ColorScheme? — nil means follow system
        var colorScheme: ColorScheme? {
            switch self {
            case .system: return nil
            case .light:  return .light
            case .dark:   return .dark
            }
        }
    }

    @Published var preference: Preference {
        didSet { UserDefaults.standard.set(preference.rawValue, forKey: "appearance_preference") }
    }

    private init() {
        let raw = UserDefaults.standard.string(forKey: "appearance_preference") ?? "dark"
        preference = Preference(rawValue: raw) ?? .dark
    }
}
