import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var authStore: AuthStore

    @State private var name: String = ""
    @State private var pin: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var logoAppeared = false
    @State private var formAppeared = false
    @State private var footerAppeared = false
    @FocusState private var focusedField: Field?

    private enum Field { case name, pin }

    // Hard-coded dark palette — login is ALWAYS dark, never follows system
    private let bg         = Color(hex: "#000000")
    private let cardBg     = Color(hex: "#0a0a0a")
    private let inputBg    = Color(hex: "#111111")
    private let borderClr  = Color(hex: "#333333")
    private let borderDim  = Color(hex: "#222222")
    private let txtPrimary = Color(hex: "#ededed")
    private let txtSecond  = Color(hex: "#999999")
    private let txtMuted   = Color(hex: "#666666")
    private let accentClr  = Color(hex: "#0071E3")

    var body: some View {
        ZStack {
            // ── Background: pure black with subtle radial glow ──
            bg.ignoresSafeArea()

            // Subtle blue radial glow behind logo area
            RadialGradient(
                colors: [accentClr.opacity(0.08), .clear],
                center: .top,
                startRadius: 20,
                endRadius: 400
            )
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {

                    Spacer(minLength: 100)

                    // ── Logo Block ────────────────────────────────
                    VStack(spacing: 14) {
                        // Glowing icon
                        ZStack {
                            // Glow ring
                            RoundedRectangle(cornerRadius: 16)
                                .fill(.white.opacity(0.05))
                                .frame(width: 64, height: 64)

                            RoundedRectangle(cornerRadius: 14)
                                .fill(.white)
                                .frame(width: 52, height: 52)
                                .shadow(color: .white.opacity(0.15), radius: 20, y: 4)
                                .overlay(
                                    Image(systemName: "chart.line.uptrend.xyaxis")
                                        .font(.system(size: 24, weight: .medium))
                                        .foregroundStyle(Color(hex: "#f59e0b"))
                                )
                        }
                        .padding(.bottom, 4)

                        Text("SalesFlow")
                            .font(.system(size: 32, weight: .bold, design: .default))
                            .tracking(-1.0)
                            .foregroundStyle(.white)

                        Text("Walk in. Pitch. Sell.")
                            .font(.system(size: 16, weight: .regular))
                            .foregroundStyle(txtMuted)
                    }
                    .opacity(logoAppeared ? 1 : 0)
                    .offset(y: logoAppeared ? 0 : 12)
                    .padding(.bottom, 52)

                    // ── Form Card ─────────────────────────────────
                    VStack(spacing: 0) {

                        // ── Fields ───────────────────
                        VStack(spacing: 20) {
                            // Name
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Username")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(txtPrimary)

                                TextField("", text: $name, prompt: Text("Enter your username").foregroundStyle(txtMuted))
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .focused($focusedField, equals: .name)
                                    .font(.system(size: 15))
                                    .foregroundStyle(.white)
                                    .tint(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 15)
                                    .background(inputBg)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(
                                                focusedField == .name ? Color.white.opacity(0.4) : borderClr,
                                                lineWidth: focusedField == .name ? 1.5 : 1
                                            )
                                    )
                                    .animation(.easeInOut(duration: 0.2), value: focusedField)
                            }

                            // PIN
                            VStack(alignment: .leading, spacing: 8) {
                                Text("PIN")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(txtPrimary)

                                SecureField("", text: $pin, prompt: Text("Enter your PIN").foregroundStyle(txtMuted))
                                    .keyboardType(.numberPad)
                                    .focused($focusedField, equals: .pin)
                                    .font(.system(size: 15))
                                    .foregroundStyle(.white)
                                    .tint(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 15)
                                    .background(inputBg)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(
                                                focusedField == .pin ? Color.white.opacity(0.4) : borderClr,
                                                lineWidth: focusedField == .pin ? 1.5 : 1
                                            )
                                    )
                                    .animation(.easeInOut(duration: 0.2), value: focusedField)
                            }
                        }

                        // ── Error ────────────────────
                        if let error = errorMessage {
                            HStack(spacing: 6) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .font(.system(size: 13))
                                Text(error)
                                    .font(.system(size: 13))
                            }
                            .foregroundStyle(Color(hex: "#ef4444"))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(Color(hex: "#ef4444").opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color(hex: "#ef4444").opacity(0.15), lineWidth: 1)
                            )
                            .padding(.top, 16)
                            .transition(.asymmetric(
                                insertion: .opacity.combined(with: .scale(scale: 0.95)).combined(with: .offset(y: -4)),
                                removal: .opacity
                            ))
                        }

                        // ── Sign In Button ───────────
                        Button(action: signIn) {
                            ZStack {
                                if isLoading {
                                    ProgressView()
                                        .tint(.black)
                                        .scaleEffect(0.85)
                                } else {
                                    HStack(spacing: 8) {
                                        Text("Sign In")
                                            .font(.system(size: 16, weight: .semibold))
                                        Image(systemName: "arrow.right")
                                            .font(.system(size: 14, weight: .semibold))
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .foregroundStyle(canSignIn ? .black : .white.opacity(0.3))
                            .background(canSignIn ? Color.white : Color.white.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: canSignIn ? .white.opacity(0.08) : .clear, radius: 16, y: 4)
                        }
                        .disabled(!canSignIn || isLoading)
                        .padding(.top, 28)
                        .animation(.easeInOut(duration: 0.2), value: canSignIn)

                        // ── Divider + Signup ─────────
                        Rectangle()
                            .fill(borderDim)
                            .frame(height: 1)
                            .padding(.top, 28)
                            .padding(.bottom, 24)

                        HStack(spacing: 4) {
                            Text("New here?")
                                .foregroundStyle(txtSecond)
                            Button(action: {}) {
                                Text("Create an account")
                                    .foregroundStyle(accentClr)
                                    .fontWeight(.medium)
                            }
                        }
                        .font(.system(size: 13))
                    }
                    .padding(32)
                    .background(cardBg)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(
                                LinearGradient(
                                    colors: [borderClr.opacity(0.8), borderClr.opacity(0.3)],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                lineWidth: 1
                            )
                    )
                    .padding(.horizontal, 24)
                    .opacity(formAppeared ? 1 : 0)
                    .offset(y: formAppeared ? 0 : 16)

                    Spacer(minLength: 80)

                    // ── Footer ────────────────────────────────────
                    Text("Independent Sales Platform")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(txtMuted)
                        .tracking(1.5)
                        .textCase(.uppercase)
                        .opacity(footerAppeared ? 1 : 0)
                        .padding(.bottom, 36)
                }
                .frame(minHeight: UIScreen.main.bounds.height)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                logoAppeared = true
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.15)) {
                formAppeared = true
            }
            withAnimation(.easeOut(duration: 0.4).delay(0.35)) {
                footerAppeared = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                focusedField = .name
            }
        }
        .animation(.easeInOut(duration: 0.25), value: errorMessage)
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
                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                    errorMessage = error.localizedDescription
                }
            }
            isLoading = false
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthStore.shared)
}
