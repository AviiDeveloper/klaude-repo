import SwiftUI
import SwiftData

@main
struct SalesFlowApp: App {
    @StateObject private var authStore = AuthStore.shared
    @StateObject private var appearance = AppearanceStore.shared

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Lead.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            Group {
                if authStore.isAuthenticated {
                    NavigationStack {
                        ModeSelectView()
                    }
                } else {
                    LoginView()
                }
            }
            .preferredColorScheme(appearance.colorScheme)
            .environmentObject(authStore)
            .environmentObject(appearance)
        }
        .modelContainer(sharedModelContainer)
    }
}
