import SwiftUI

struct PayoutsView: View {
    var body: some View {
        NavigationStack {
            ZStack {
                SF.bg.ignoresSafeArea()
                Text("Payouts coming soon")
                    .foregroundColor(SF.textMuted)
            }
            .navigationTitle("Payouts")
        }
    }
}
