import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var selectedTab = 0

    var body: some View {
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
        .preferredColorScheme(.dark)
        .toolbarBackground(Color.black, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthStore.shared)
}
