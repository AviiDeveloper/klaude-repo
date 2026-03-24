import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            LeadsView()
                .tabItem {
                    Label("Leads", systemImage: "list.bullet")
                }

            MapView()
                .tabItem {
                    Label("Map", systemImage: "map")
                }

            PayoutsView()
                .tabItem {
                    Label("Payouts", systemImage: "creditcard")
                }

            ProfileView()
                .tabItem {
                    Label("Account", systemImage: "person")
                }
        }
        .tint(.white)
    }
}
