import SwiftUI

struct MapView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                SF.bg.ignoresSafeArea()
                Text("Map coming soon")
                    .foregroundColor(SF.textMuted)
            }
            .navigationTitle("Territory")
        }
    }
}
