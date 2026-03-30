import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var selectedTab = 0
    @State private var showGuide: Bool

    init() {
        let key = "salesflow_guide_completed"
        _showGuide = State(initialValue: !UserDefaults.standard.bool(forKey: key))
    }

    var body: some View {
        ZStack {
            TabView(selection: $selectedTab) {
                LeadsView()
                    .tabItem {
                        Label("Leads", systemImage: "list.bullet.rectangle")
                    }
                    .tag(0)

                LeadsMapView()
                    .tabItem {
                        Label("Map", systemImage: "map")
                    }
                    .tag(1)

                PayoutsView()
                    .tabItem {
                        Label("Payouts", systemImage: "sterlingsign.circle")
                    }
                    .tag(2)

                ProfileView()
                    .tabItem {
                        Label("Profile", systemImage: "person.circle")
                    }
                    .tag(3)
            }
            .tint(Theme.accent)
            .toolbarBackground(Color.black, for: .tabBar)
            .toolbarBackground(.visible, for: .tabBar)

            // Guide overlay (shown once)
            if showGuide {
                DashboardGuideOverlay(isShowing: $showGuide)
                    .transition(.opacity)
                    .zIndex(100)
                    .onDisappear {
                        UserDefaults.standard.set(true, forKey: "salesflow_guide_completed")
                    }
            }
        }
        .preferredColorScheme(.dark)
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthStore.shared)
}
