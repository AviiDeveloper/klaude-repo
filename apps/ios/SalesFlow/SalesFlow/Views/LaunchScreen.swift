import SwiftUI

struct LaunchScreen: View {
    var body: some View {
        ZStack {
            SF.bg.ignoresSafeArea()
            VStack(spacing: 8) {
                Text("▲")
                    .font(.system(size: 32))
                    .foregroundColor(.white)
                Text("SalesFlow")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
            }
        }
    }
}
