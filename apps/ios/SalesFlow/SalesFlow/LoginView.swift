import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authStore: AuthStore

    @State private var name: String = ""
    @State private var pin: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSignUp = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, pin }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Wordmark block
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Theme.accent)
                            .frame(width: 32, height: 32)
                            .overlay(
                                Text("S")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(.white)
                            )
                        Text("SalesFlow")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(Theme.textPrimary)
                    }
                    Text("Sales tool for independent contractors")
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Theme.textMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 28)
                .padding(.bottom, 40)

                // Form
                VStack(spacing: 0) {
                    // Name field
                    VStack(alignment: .leading, spacing: 7) {
                        Text("Name")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.textMuted)
                            .tracking(0.6)
                            .textCase(.uppercase)
                        TextField("your name", text: $name)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .name)
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.textPrimary)
                            .tint(Theme.accent)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 13)
                            .background(focusedField == .name ? Theme.surfaceElevated : Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.radiusButton)
                                    .stroke(
                                        focusedField == .name ? Theme.accent.opacity(0.6) : Theme.border,
                                        lineWidth: Theme.borderWidth
                                    )
                            )
                            .animation(.easeInOut(duration: 0.15), value: focusedField)
                    }

                    Spacer().frame(height: 16)

                    // PIN field
                    VStack(alignment: .leading, spacing: 7) {
                        Text("PIN")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Theme.textMuted)
                            .tracking(0.6)
                            .textCase(.uppercase)
                        SecureField("••••", text: $pin)
                            .keyboardType(.numberPad)
                            .focused($focusedField, equals: .pin)
                            .font(.system(size: 16))
                            .foregroundStyle(Theme.textPrimary)
                            .tint(Theme.accent)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 13)
                            .background(focusedField == .pin ? Theme.surfaceElevated : Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.radiusButton)
                                    .stroke(
                                        focusedField == .pin ? Theme.accent.opacity(0.6) : Theme.border,
                                        lineWidth: Theme.borderWidth
                                    )
                            )
                            .animation(.easeInOut(duration: 0.15), value: focusedField)
                    }

                    // Error message
                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle")
                                .font(.system(size: 12))
                            Text(error)
                                .font(.system(size: 13))
                        }
                        .foregroundStyle(Theme.statusRejected)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 12)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    Spacer().frame(height: 24)

                    // Sign in button
                    Button(action: signIn) {
                        ZStack {
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.9)
                            } else {
                                HStack(spacing: 8) {
                                    Text("Sign In")
                                        .font(.system(size: 15, weight: .semibold))
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 13, weight: .semibold))
                                }
                                .foregroundStyle(.white)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .background(
                            canSignIn
                            ? Theme.accent
                            : Theme.accent.opacity(0.3)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                        .animation(.easeInOut(duration: 0.15), value: canSignIn)
                    }
                    .disabled(!canSignIn || isLoading)
                }
                .padding(24)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusCard)
                        .stroke(Theme.border, lineWidth: Theme.borderWidth)
                )
                .padding(.horizontal, 24)
                .animation(.easeInOut(duration: 0.2), value: errorMessage)

                // Create account link (NEW — added below the original form)
                Button(action: { showSignUp = true }) {
                    Text("Don't have an account? ")
                        .foregroundStyle(Theme.textMuted) +
                    Text("Create one")
                        .foregroundStyle(Theme.accent)
                        .bold()
                }
                .font(.system(size: 13))
                .padding(.top, 16)

                Spacer()
                Spacer()

                // Footer
                Text("Independent contractor platform · Not monitored")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.bottom, 28)
            }
        }
        .onAppear { focusedField = .name }
        .sheet(isPresented: $showSignUp) {
            SignUpView()
                .environmentObject(authStore)
        }
    }

    private var canSignIn: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && !pin.isEmpty
    }

    private func signIn() {
        errorMessage = nil
        isLoading = true
        focusedField = nil
        Task {
            do {
                try await authStore.signIn(name: name.trimmingCharacters(in: .whitespaces), pin: pin)
                // Offer biometrics after first successful login
                if BiometricManager.shared.canUseBiometrics && !authStore.biometricEnabled {
                    authStore.pendingBiometricPrompt = true
                }
            } catch {
                withAnimation { errorMessage = error.localizedDescription }
            }
            isLoading = false
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthStore.shared)
}
