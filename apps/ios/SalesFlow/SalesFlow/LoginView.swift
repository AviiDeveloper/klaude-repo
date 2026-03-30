import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authStore: AuthStore

    @State private var name = ""
    @State private var pin = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var appeared = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, pin }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── Brand ────────────────────────────────────
                VStack(spacing: 20) {
                    Text("SalesFlow")
                        .font(.system(size: 28, weight: .semibold))
                        .tracking(-0.5)
                        .foregroundStyle(.white)

                    Text("Sign in to continue")
                        .font(.system(size: 15))
                        .foregroundStyle(Color(hex: "#666666"))
                }
                .padding(.bottom, 56)

                // ── Fields ───────────────────────────────────
                VStack(spacing: 16) {

                    // Username
                    VStack(alignment: .leading, spacing: 6) {
                        Text("USERNAME")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(hex: "#888888"))
                            .tracking(0.5)

                        ZStack(alignment: .leading) {
                            if name.isEmpty {
                                Text("your name")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color(hex: "#333333"))
                            }
                            TextField("", text: $name)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .name)
                                .font(.system(size: 16))
                                .foregroundStyle(.white)
                                .tint(.white)
                        }
                        .padding(.vertical, 14)
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(focusedField == .name ? Color.white : Color(hex: "#222222"))
                                .frame(height: focusedField == .name ? 2 : 1)
                                .animation(.easeInOut(duration: 0.2), value: focusedField)
                        }
                    }

                    // PIN
                    VStack(alignment: .leading, spacing: 6) {
                        Text("PIN")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(hex: "#888888"))
                            .tracking(0.5)

                        ZStack(alignment: .leading) {
                            if pin.isEmpty {
                                Text("\u{2022}\u{2022}\u{2022}\u{2022}")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color(hex: "#333333"))
                            }
                            SecureField("", text: $pin)
                                .keyboardType(.numberPad)
                                .focused($focusedField, equals: .pin)
                                .font(.system(size: 16))
                                .foregroundStyle(.white)
                                .tint(.white)
                        }
                        .padding(.vertical, 14)
                        .overlay(alignment: .bottom) {
                            Rectangle()
                                .fill(focusedField == .pin ? Color.white : Color(hex: "#222222"))
                                .frame(height: focusedField == .pin ? 2 : 1)
                                .animation(.easeInOut(duration: 0.2), value: focusedField)
                        }
                    }
                }
                .padding(.horizontal, 32)

                // ── Error ────────────────────────────────────
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#ef4444"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 32)
                        .padding(.top, 16)
                        .transition(.opacity)
                }

                // ── Button ───────────────────────────────────
                Button(action: signIn) {
                    Group {
                        if isLoading {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Text("Sign In")
                                .font(.system(size: 16, weight: .semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .foregroundStyle(canSignIn ? .black : .white.opacity(0.2))
                    .background(canSignIn ? Color.white : Color(hex: "#111111"))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(!canSignIn || isLoading)
                .padding(.horizontal, 32)
                .padding(.top, 40)
                .animation(.easeInOut(duration: 0.2), value: canSignIn)

                // ── Get started link ─────────────────────
                Button(action: { authStore.hasCompletedOnboarding = false }) {
                    Text("New here? Get started")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#666666"))
                }
                .padding(.top, 24)

                Spacer()
                Spacer()

                // ── Footer ───────────────────────────────────
                Text("Independent contractor platform")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(hex: "#444444"))
                    .padding(.bottom, 24)
            }
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 8)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) { appeared = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                focusedField = .name
            }
        }
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
