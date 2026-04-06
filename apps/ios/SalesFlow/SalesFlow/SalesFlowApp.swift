import SwiftUI
import SwiftData

@main
struct SalesFlowApp: App {
    @StateObject private var authStore = AuthStore.shared
    @StateObject private var appearanceStore = AppearanceStore.shared

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Lead.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            Group {
                if authStore.isAuthenticated {
                    if authStore.isUnlocked {
                        ModeSelectView()
                    } else {
                        UnlockView()
                    }
                } else {
                    LoginView()
                }
            }
            .environmentObject(authStore)
            .environmentObject(appearanceStore)
            .preferredColorScheme(appearanceStore.colorScheme)
        }
        .modelContainer(sharedModelContainer)
    }
}

// MARK: — Unlock gate (biometric / PIN fallback)
struct UnlockView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var showPINFallback = false
    @State private var biometricFailed = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()

                // Logo
                RoundedRectangle(cornerRadius: 16)
                    .fill(Theme.accent)
                    .frame(width: 64, height: 64)
                    .overlay(
                        Text("S")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                    )

                Text("SalesFlow")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)

                if showPINFallback {
                    PINKeypadView(
                        title: "Enter your PIN",
                        onComplete: { pin in
                            authStore.unlockWithPIN(pin)
                        }
                    )
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                } else {
                    VStack(spacing: 16) {
                        if biometricFailed {
                            Text("Authentication failed")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.statusRejected)
                        }

                        Button(action: attemptBiometric) {
                            HStack(spacing: 8) {
                                Image(systemName: BiometricManager.shared.biometricIcon)
                                    .font(.system(size: 16))
                                Text("Unlock")
                                    .font(.system(size: 15, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 46)
                            .background(Theme.accent)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                        }
                        .padding(.horizontal, 48)

                        Button("Use PIN instead") {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showPINFallback = true
                            }
                        }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.textSecondary)
                    }
                }

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            if BiometricManager.shared.canUseBiometrics && authStore.biometricEnabled {
                attemptBiometric()
            } else {
                showPINFallback = true
            }
        }
        .animation(.easeInOut(duration: 0.2), value: biometricFailed)
    }

    private func attemptBiometric() {
        biometricFailed = false
        Task {
            let success = await BiometricManager.shared.authenticate(
                reason: "Unlock SalesFlow"
            )
            await MainActor.run {
                if success {
                    authStore.unlock()
                } else {
                    biometricFailed = true
                }
            }
        }
    }
}
