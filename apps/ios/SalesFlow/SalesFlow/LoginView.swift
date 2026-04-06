import SwiftUI

// MARK: — LoginView
// Handles both sign-in (returning user) and sign-up (new user).
// Native iOS feel — no card wrappers, clean vertical layout.

struct LoginView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var mode: AuthMode = .welcome

    enum AuthMode {
        case welcome    // First screen — choose sign in or create account
        case signIn     // Returning user — name + PIN
        case signUp     // New user — onboarding
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            switch mode {
            case .welcome:
                WelcomeScreen(
                    onSignIn: { withAnimation(.easeInOut(duration: 0.25)) { mode = .signIn } },
                    onSignUp: { withAnimation(.easeInOut(duration: 0.25)) { mode = .signUp } }
                )
                .transition(.opacity)

            case .signIn:
                SignInScreen(
                    onBack: { withAnimation(.easeInOut(duration: 0.25)) { mode = .welcome } }
                )
                .environmentObject(authStore)
                .transition(.move(edge: .trailing).combined(with: .opacity))

            case .signUp:
                SignUpScreen(
                    onBack: { withAnimation(.easeInOut(duration: 0.25)) { mode = .welcome } }
                )
                .environmentObject(authStore)
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
    }
}

// MARK: — Welcome screen

private struct WelcomeScreen: View {
    let onSignIn: () -> Void
    let onSignUp: () -> Void

    @State private var appear = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo
            VStack(spacing: 16) {
                RoundedRectangle(cornerRadius: 20)
                    .fill(Theme.accent)
                    .frame(width: 72, height: 72)
                    .overlay(
                        Text("S")
                            .font(.system(size: 32, weight: .bold))
                            .foregroundStyle(.white)
                    )
                    .opacity(appear ? 1 : 0)
                    .offset(y: appear ? 0 : 10)

                VStack(spacing: 6) {
                    Text("SalesFlow")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)

                    Text("Earn commission selling websites\nto local businesses")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(2)
                }
                .opacity(appear ? 1 : 0)
                .offset(y: appear ? 0 : 10)
            }

            Spacer()
            Spacer()

            // Actions
            VStack(spacing: 12) {
                Button(action: onSignUp) {
                    Text("Get Started")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                Button(action: onSignIn) {
                    Text("I already have an account")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 48)
            .opacity(appear ? 1 : 0)
            .offset(y: appear ? 0 : 20)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5).delay(0.1)) { appear = true }
        }
    }
}

// MARK: — Sign in screen (returning user)

private struct SignInScreen: View {
    @EnvironmentObject private var authStore: AuthStore
    let onBack: () -> Void

    @State private var name = ""
    @State private var pin = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var focusedField: Field?

    private enum Field { case name, pin }

    var body: some View {
        VStack(spacing: 0) {
            // Nav bar
            HStack {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Theme.accent)
                }
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Welcome back")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .padding(.top, 24)

                    Text("Sign in with your name and PIN")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.top, 6)

                    // Name
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Name")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.textSecondary)

                        TextField("Your name", text: $name)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .name)
                            .font(.system(size: 17))
                            .foregroundStyle(Theme.textPrimary)
                            .tint(Theme.accent)
                            .padding(14)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(focusedField == .name ? Theme.accent : Theme.border, lineWidth: 1)
                            )
                    }
                    .padding(.top, 32)

                    // PIN
                    VStack(alignment: .leading, spacing: 8) {
                        Text("PIN")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.textSecondary)

                        SecureField("4-6 digit PIN", text: $pin)
                            .keyboardType(.numberPad)
                            .focused($focusedField, equals: .pin)
                            .font(.system(size: 17))
                            .foregroundStyle(Theme.textPrimary)
                            .tint(Theme.accent)
                            .padding(14)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(focusedField == .pin ? Theme.accent : Theme.border, lineWidth: 1)
                            )
                    }
                    .padding(.top, 16)

                    // Error
                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 13))
                            Text(error)
                                .font(.system(size: 13))
                        }
                        .foregroundStyle(Theme.statusRejected)
                        .padding(.top, 12)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Sign in button
                    Button(action: signIn) {
                        ZStack {
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text("Sign In")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(canSignIn ? Theme.accent : Theme.accent.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!canSignIn || isLoading)
                    .padding(.top, 28)
                }
                .padding(.horizontal, 24)
            }
        }
        .onAppear { focusedField = .name }
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
    }

    private var canSignIn: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && pin.count >= 4
    }

    private func signIn() {
        errorMessage = nil
        isLoading = true
        focusedField = nil
        Task {
            do {
                try await authStore.signIn(name: name.trimmingCharacters(in: .whitespaces), pin: pin)
                // Offer biometrics after first login
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

// MARK: — Sign up screen (onboarding)

private struct SignUpScreen: View {
    @EnvironmentObject private var authStore: AuthStore
    let onBack: () -> Void

    @State private var step = 0
    @State private var name = ""
    @State private var pin = ""
    @State private var pinConfirm = ""
    @State private var phone = ""
    @State private var area = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @FocusState private var focused: Bool

    private let totalSteps = 3

    var body: some View {
        VStack(spacing: 0) {
            // Nav bar + progress
            HStack {
                Button(action: goBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Theme.accent)
                }
                Spacer()
                Text("Step \(step + 1) of \(totalSteps)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Theme.border)
                        .frame(height: 3)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Theme.accent)
                        .frame(width: geo.size.width * (CGFloat(step + 1) / CGFloat(totalSteps)), height: 3)
                        .animation(.easeInOut(duration: 0.3), value: step)
                }
            }
            .frame(height: 3)
            .padding(.horizontal, 20)
            .padding(.top, 16)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    switch step {
                    case 0: stepName
                    case 1: stepPIN
                    case 2: stepDetails
                    default: EmptyView()
                    }

                    // Error
                    if let error = errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.system(size: 13))
                            Text(error)
                                .font(.system(size: 13))
                        }
                        .foregroundStyle(Theme.statusRejected)
                        .padding(.top, 12)
                        .transition(.opacity)
                    }

                    // Continue / Create button
                    Button(action: next) {
                        ZStack {
                            if isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Text(step == totalSteps - 1 ? "Create Account" : "Continue")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(canContinue ? Theme.accent : Theme.accent.opacity(0.3))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(!canContinue || isLoading)
                    .padding(.top, 28)
                }
                .padding(.horizontal, 24)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: step)
        .animation(.easeInOut(duration: 0.2), value: errorMessage)
    }

    // MARK: — Step views

    private var stepName: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("What's your name?")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 24)

            Text("This is how you'll appear to other contractors")
                .font(.system(size: 15))
                .foregroundStyle(Theme.textSecondary)
                .padding(.top, 6)

            TextField("First name", text: $name)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .focused($focused)
                .font(.system(size: 17))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(focused ? Theme.accent : Theme.border, lineWidth: 1)
                )
                .padding(.top, 28)
                .onAppear { focused = true }
        }
    }

    private var stepPIN: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create a PIN")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 24)

            Text("4-6 digits. You'll use this to unlock the app.")
                .font(.system(size: 15))
                .foregroundStyle(Theme.textSecondary)
                .padding(.top, 6)

            SecureField("PIN", text: $pin)
                .keyboardType(.numberPad)
                .font(.system(size: 17))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Theme.border, lineWidth: 1)
                )
                .padding(.top, 28)

            SecureField("Confirm PIN", text: $pinConfirm)
                .keyboardType(.numberPad)
                .font(.system(size: 17))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(14)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(
                            !pinConfirm.isEmpty && pin != pinConfirm
                                ? Theme.statusRejected
                                : Theme.border,
                            lineWidth: 1
                        )
                )
                .padding(.top, 12)

            if !pinConfirm.isEmpty && pin != pinConfirm {
                Text("PINs don't match")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.statusRejected)
                    .padding(.top, 8)
            }
        }
    }

    private var stepDetails: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Almost there")
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 24)

            Text("A few details to set up your area")
                .font(.system(size: 15))
                .foregroundStyle(Theme.textSecondary)
                .padding(.top, 6)

            VStack(alignment: .leading, spacing: 8) {
                Text("Phone number")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)

                TextField("07xxxxxxxxx", text: $phone)
                    .keyboardType(.phonePad)
                    .font(.system(size: 17))
                    .foregroundStyle(Theme.textPrimary)
                    .tint(Theme.accent)
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Theme.border, lineWidth: 1)
                    )
            }
            .padding(.top, 28)

            VStack(alignment: .leading, spacing: 8) {
                Text("Area postcode")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.textSecondary)

                TextField("e.g. M1, SW1, B1", text: $area)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.system(size: 17))
                    .foregroundStyle(Theme.textPrimary)
                    .tint(Theme.accent)
                    .padding(14)
                    .background(Theme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Theme.border, lineWidth: 1)
                    )

                Text("You'll be assigned leads near this postcode")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.textMuted)
                    .padding(.top, 2)
            }
            .padding(.top, 16)
        }
    }

    // MARK: — Logic

    private var canContinue: Bool {
        switch step {
        case 0: return !name.trimmingCharacters(in: .whitespaces).isEmpty
        case 1: return pin.count >= 4 && pin == pinConfirm
        case 2: return true // phone + area are optional
        default: return false
        }
    }

    private func goBack() {
        errorMessage = nil
        if step > 0 {
            step -= 1
        } else {
            onBack()
        }
    }

    private func next() {
        errorMessage = nil

        if step < totalSteps - 1 {
            step += 1
            return
        }

        // Final step — create account
        isLoading = true
        Task {
            do {
                try await authStore.signUp(
                    name: name.trimmingCharacters(in: .whitespaces),
                    pin: pin,
                    phone: phone.trimmingCharacters(in: .whitespaces),
                    area: area.trimmingCharacters(in: .whitespaces)
                )
                // Offer biometrics
                if BiometricManager.shared.canUseBiometrics {
                    authStore.biometricEnabled = true
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
