import SwiftUI

// MARK: — SignUpView (presented as sheet from LoginView)
// 3-step onboarding for new contractors.

struct SignUpView: View {
    @EnvironmentObject private var authStore: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var step = 0
    @State private var name = ""
    @State private var pin = ""
    @State private var pinConfirm = ""
    @State private var phone = ""
    @State private var area = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let totalSteps = 3

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
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
                    .padding(.horizontal, 24)
                    .padding(.top, 8)

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
                                    Image(systemName: "exclamationmark.circle")
                                        .font(.system(size: 12))
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
                                        ProgressView().tint(.white).scaleEffect(0.9)
                                    } else {
                                        HStack(spacing: 8) {
                                            Text(step == totalSteps - 1 ? "Create Account" : "Continue")
                                                .font(.system(size: 15, weight: .semibold))
                                            Image(systemName: "arrow.right")
                                                .font(.system(size: 13, weight: .semibold))
                                        }
                                        .foregroundStyle(.white)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 46)
                                .background(canContinue ? Theme.accent : Theme.accent.opacity(0.3))
                                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                            }
                            .disabled(!canContinue || isLoading)
                            .padding(.top, 28)
                        }
                        .padding(.horizontal, 24)
                    }
                }
            }
            .navigationTitle("Create Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button(step > 0 ? "Back" : "Cancel") {
                        if step > 0 {
                            withAnimation { step -= 1 }
                            errorMessage = nil
                        } else {
                            dismiss()
                        }
                    }
                    .foregroundStyle(Theme.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Text("Step \(step + 1)/\(totalSteps)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: step)
            .animation(.easeInOut(duration: 0.2), value: errorMessage)
        }
    }

    // MARK: — Step views

    private var stepName: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("What's your name?")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 24)

            Text("This is how you'll appear to other contractors")
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
                .padding(.bottom, 8)

            TextField("First name", text: $name)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .font(.system(size: 16))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusButton)
                        .stroke(Theme.border, lineWidth: Theme.borderWidth)
                )
        }
    }

    private var stepPIN: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Create a PIN")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 24)

            Text("4-6 digits. You'll use this to unlock the app.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
                .padding(.bottom, 8)

            SecureField("PIN", text: $pin)
                .keyboardType(.numberPad)
                .font(.system(size: 16))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusButton)
                        .stroke(Theme.border, lineWidth: Theme.borderWidth)
                )

            SecureField("Confirm PIN", text: $pinConfirm)
                .keyboardType(.numberPad)
                .font(.system(size: 16))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusButton)
                        .stroke(
                            !pinConfirm.isEmpty && pin != pinConfirm
                                ? Theme.statusRejected : Theme.border,
                            lineWidth: Theme.borderWidth
                        )
                )
                .padding(.top, 4)

            if !pinConfirm.isEmpty && pin != pinConfirm {
                Text("PINs don't match")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.statusRejected)
            }
        }
    }

    private var stepDetails: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("Almost there")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .padding(.top, 24)

            Text("A few optional details to set up your area")
                .font(.system(size: 13))
                .foregroundStyle(Theme.textSecondary)
                .padding(.bottom, 8)

            Text("PHONE NUMBER")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.6)

            TextField("07xxxxxxxxx", text: $phone)
                .keyboardType(.phonePad)
                .font(.system(size: 16))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusButton)
                        .stroke(Theme.border, lineWidth: Theme.borderWidth)
                )

            Spacer().frame(height: 16)

            Text("AREA POSTCODE")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.6)

            TextField("e.g. M1, SW1, B1", text: $area)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .font(.system(size: 16))
                .foregroundStyle(Theme.textPrimary)
                .tint(Theme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 13)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.radiusButton)
                        .stroke(Theme.border, lineWidth: Theme.borderWidth)
                )

            Text("You'll be assigned leads near this postcode")
                .font(.system(size: 11))
                .foregroundStyle(Theme.textMuted)
                .padding(.top, 4)
        }
    }

    // MARK: — Logic

    private var canContinue: Bool {
        switch step {
        case 0: return !name.trimmingCharacters(in: .whitespaces).isEmpty
        case 1: return pin.count >= 4 && pin == pinConfirm
        case 2: return true
        default: return false
        }
    }

    private func next() {
        errorMessage = nil

        if step < totalSteps - 1 {
            withAnimation { step += 1 }
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
                dismiss()
            } catch {
                withAnimation { errorMessage = error.localizedDescription }
            }
            isLoading = false
        }
    }
}

#Preview {
    SignUpView()
        .environmentObject(AuthStore.shared)
}
