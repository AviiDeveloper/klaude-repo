import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authStore: AuthStore

    @State private var name: String = ""
    @State private var pin: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field { case name, pin }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    Spacer(minLength: 80)

                    // ── Logo + Brand ──────────────────────────────
                    VStack(spacing: 10) {
                        // Icon — white square with uptrend chart (matches web)
                        RoundedRectangle(cornerRadius: 14)
                            .fill(.white)
                            .frame(width: 48, height: 48)
                            .overlay(
                                Image(systemName: "chart.line.uptrend.xyaxis")
                                    .font(.system(size: 22, weight: .medium))
                                    .foregroundStyle(Color(hex: "#f59e0b"))
                            )
                            .padding(.bottom, 8)

                        Text("SalesFlow")
                            .font(.system(size: 30, weight: .semibold))
                            .tracking(-0.8)
                            .foregroundStyle(.white)

                        Text("Walk in. Pitch. Sell.")
                            .font(.system(size: 15))
                            .foregroundStyle(Theme.textMuted)
                    }
                    .padding(.bottom, 48)

                    // ── Form Card ─────────────────────────────────
                    VStack(spacing: 0) {
                        VStack(spacing: 24) {
                            // Name field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Username")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(.white)

                                TextField("Enter your username", text: $name)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .focused($focusedField, equals: .name)
                                    .font(.system(size: 15))
                                    .foregroundStyle(.white)
                                    .tint(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .background(Theme.surfaceElevated)
                                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Theme.radiusButton)
                                            .stroke(
                                                focusedField == .name ? Color.white.opacity(0.5) : Theme.border,
                                                lineWidth: focusedField == .name ? 1.5 : 1
                                            )
                                    )
                                    .animation(.easeInOut(duration: 0.15), value: focusedField)
                            }

                            // PIN field
                            VStack(alignment: .leading, spacing: 8) {
                                Text("PIN")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(.white)

                                SecureField("Enter your PIN", text: $pin)
                                    .keyboardType(.numberPad)
                                    .focused($focusedField, equals: .pin)
                                    .font(.system(size: 15))
                                    .foregroundStyle(.white)
                                    .tint(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .background(Theme.surfaceElevated)
                                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Theme.radiusButton)
                                            .stroke(
                                                focusedField == .pin ? Color.white.opacity(0.5) : Theme.border,
                                                lineWidth: focusedField == .pin ? 1.5 : 1
                                            )
                                    )
                                    .animation(.easeInOut(duration: 0.15), value: focusedField)
                            }
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
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .background(Theme.statusRejected.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.radiusButton)
                                    .stroke(Theme.statusRejected.opacity(0.2), lineWidth: 1)
                            )
                            .padding(.top, 16)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        // Sign in button
                        Button(action: signIn) {
                            ZStack {
                                if isLoading {
                                    ProgressView()
                                        .tint(.black)
                                        .scaleEffect(0.9)
                                } else {
                                    HStack(spacing: 8) {
                                        Text("Sign In")
                                            .font(.system(size: 15, weight: .semibold))
                                        Image(systemName: "arrow.right")
                                            .font(.system(size: 13, weight: .semibold))
                                    }
                                    .foregroundStyle(.black)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(canSignIn ? .white : Color.white.opacity(0.15))
                            .foregroundStyle(canSignIn ? .black : Color.white.opacity(0.4))
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                            .animation(.easeInOut(duration: 0.15), value: canSignIn)
                        }
                        .disabled(!canSignIn || isLoading)
                        .padding(.top, 24)

                        // Signup link
                        HStack(spacing: 0) {
                            Rectangle()
                                .fill(Theme.borderSubtle)
                                .frame(height: 1)
                        }
                        .padding(.top, 24)
                        .padding(.bottom, 20)

                        HStack(spacing: 4) {
                            Text("New here?")
                                .foregroundStyle(Theme.textSecondary)
                            Text("Create an account")
                                .foregroundStyle(Theme.accent)
                                .fontWeight(.medium)
                        }
                        .font(.system(size: 13))
                    }
                    .padding(32)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusLarge))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusLarge)
                            .stroke(Theme.border, lineWidth: 1)
                    )
                    .noiseTexture()
                    .padding(.horizontal, 24)

                    Spacer(minLength: 60)

                    // Footer
                    Text("Independent Sales Platform")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.textMuted)
                        .tracking(1.2)
                        .textCase(.uppercase)
                        .padding(.bottom, 32)
                }
                .frame(minHeight: UIScreen.main.bounds.height)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .pageEntrance()
        .onAppear { focusedField = .name }
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
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
