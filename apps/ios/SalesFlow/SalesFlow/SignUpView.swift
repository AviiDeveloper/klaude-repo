import SwiftUI

// MARK: — SignUpView
// 10-step onboarding matching the web sales-dashboard signup.
// Steps: Welcome → Earnings → Walkthrough → Tools → Name → Phone → PIN → Area → Agreement → Done

struct SignUpView: View {
    @EnvironmentObject private var authStore: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var step = 0
    @State private var name = ""
    @State private var phone = ""
    @State private var pin = ""
    @State private var area = ""
    @State private var agreedToTerms = false
    @State private var isLoading = false
    @State private var signupError: String?

    private let totalSteps = 10
    private let accentBlue = Color(hex: "#0071E3")

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress bar (top edge)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Color(hex: "#F3F4F6")).frame(height: 3)
                        Rectangle().fill(accentBlue)
                            .frame(width: geo.size.width * CGFloat(step + 1) / CGFloat(totalSteps), height: 3)
                            .animation(.easeOut(duration: 0.4), value: step)
                    }
                }
                .frame(height: 3)

                // Back button
                HStack {
                    if step == 0 {
                        Button(action: { dismiss() }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color(hex: "#9CA3AF"))
                        }
                    } else if step < totalSteps - 1 {
                        Button(action: { withAnimation(.easeInOut(duration: 0.2)) { step -= 1 } }) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(Color(hex: "#9CA3AF"))
                        }
                    }
                    Spacer()
                    if step > 0 && step < totalSteps - 1 {
                        Text("\(step + 1) / \(totalSteps)")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color(hex: "#9CA3AF"))
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .frame(height: 44)

                // Content + button together in scroll
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        switch step {
                        case 0: welcomeStep
                        case 1: earningsStep
                        case 2: walkthroughStep
                        case 3: toolsStep
                        case 4: inputStep(title: "What should we call you?", subtitle: "Just your first name is fine") { nameInput }
                        case 5: inputStep(title: "Your phone number", subtitle: "So we can reach you about leads and payouts") { phoneInput }
                        case 6: inputStep(title: "Create a quick PIN", subtitle: "4 digits — use this with your name to log back in") { pinInput }
                        case 7: inputStep(title: "What area do you cover?", subtitle: "e.g. Manchester City Centre, Birmingham") { areaInput }
                        case 8: agreementStep
                        case 9: doneStep
                        default: EmptyView()
                        }

                        // Continue button
                        Button(action: handleNext) {
                            ZStack {
                                if isLoading {
                                    ProgressView().tint(.white)
                                } else {
                                    HStack(spacing: 6) {
                                        Text(step == totalSteps - 1 ? "Go to Dashboard" : "Continue")
                                            .font(.system(size: 15, weight: .semibold))
                                        Image(systemName: "arrow.right")
                                            .font(.system(size: 13, weight: .semibold))
                                    }
                                    .foregroundStyle(.white)
                                }
                            }
                            .frame(height: 50)
                            .frame(maxWidth: 280)
                            .background(canContinue ? accentBlue : accentBlue.opacity(0.3))
                            .clipShape(Capsule())
                        }
                        .disabled(!canContinue || isLoading)
                        .padding(.top, 32)

                        // Login link on welcome step
                        if step == 0 {
                            Button("Already have an account? Sign in") { dismiss() }
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "#9CA3AF"))
                                .padding(.top, 12)
                        }

                        // Step dots
                        HStack(spacing: 4) {
                            ForEach(0..<totalSteps, id: \.self) { i in
                                RoundedRectangle(cornerRadius: 1)
                                    .fill(i == step ? accentBlue : Color(hex: "#E5E7EB"))
                                    .frame(width: i == step ? 24 : 5, height: 5)
                                    .animation(.easeInOut(duration: 0.3), value: step)
                            }
                        }
                        .padding(.top, 20)
                        .padding(.bottom, 24)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: step)
        .preferredColorScheme(.light)
    }

    // MARK: — Step 0: Welcome

    private var welcomeStep: some View {
        VStack(spacing: 0) {
            Text("Start earning today")
                .font(.system(size: 34, weight: .semibold))
                .tracking(-1.2)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Walk into businesses. Show them their new website.\nEarn £50 per sale.")
                .font(.system(size: 17))
                .foregroundStyle(Color(hex: "#6B7280"))
                .multilineTextAlignment(.center)
                .lineSpacing(2)
                .padding(.bottom, 40)

            VStack(spacing: 0) {
                benefitRow(num: "1", title: "Flexible hours", body: "Choose your own schedule, no shifts")
                benefitRow(num: "2", title: "Instant earnings", body: "£50 commission per sale, paid weekly")
                benefitRow(num: "3", title: "No experience needed", body: "We give you scripts, demos, and support")
            }
            .padding(.horizontal, 16)
        }
    }

    private func benefitRow(num: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(num)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .frame(width: 32, height: 32)
                .background(Color(hex: "#F9FAFB"))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111827"))
                Text(body)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#6B7280"))
            }
            Spacer()
        }
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color(hex: "#F3F4F6")).frame(height: 1)
        }
    }

    // MARK: — Step 1: Earnings

    private var earningsStep: some View {
        VStack(spacing: 0) {
            Text("Real results, no promises")
                .font(.system(size: 30, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("Here's what our contractors have actually earned")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .padding(.bottom, 28)

            VStack(spacing: 20) {
                VStack(spacing: 4) {
                    Text("Contractor earnings last month")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#9CA3AF"))
                    Text("£50 – £800")
                        .font(.system(size: 38, weight: .semibold))
                        .tracking(-1.5)
                        .foregroundStyle(Color(hex: "#111827"))
                    Text("Results vary by effort, area, and approach")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#9CA3AF"))
                }
                .padding(.bottom, 16)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(Color(hex: "#E5E7EB")).frame(height: 1)
                }

                VStack(alignment: .leading, spacing: 14) {
                    earningsBullet("Every closed sale pays **£50 commission**, within 7 days")
                    earningsBullet("No targets. No minimum hours. No shifts.")
                    earningsBullet("Some contractors close one sale a week. Some close ten. It's entirely up to you.")
                }
            }
            .padding(24)
            .background(Color(hex: "#F9FAFB"))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func earningsBullet(_ text: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("—")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(hex: "#D1D5DB"))
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#4B5563"))
                .lineSpacing(2)
        }
    }

    // MARK: — Step 2: Walkthrough

    private var walkthroughStep: some View {
        VStack(spacing: 0) {
            Text("How a typical day works")
                .font(.system(size: 30, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("Four simple steps to success")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .padding(.bottom, 40)

            VStack(spacing: 28) {
                walkthroughRow("01", "Get your leads", "We send you local businesses that need websites")
                walkthroughRow("02", "Walk in and pitch", "Show them their demo site on your phone")
                walkthroughRow("03", "Handle objections", "Use our proven scripts and talking points")
                walkthroughRow("04", "Close and earn", "£50 in your account, they get their site")
            }
            .padding(.horizontal, 8)
        }
    }

    private func walkthroughRow(_ num: String, _ title: String, _ desc: String) -> some View {
        HStack(alignment: .top, spacing: 18) {
            Text(num)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Color(hex: "#E5E7EB"))
                .tracking(-1)
                .frame(width: 50, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111827"))
                Text(desc)
                    .font(.system(size: 14))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .lineSpacing(2)
            }
            .padding(.top, 4)

            Spacer()
        }
    }

    // MARK: — Step 3: Tools

    private var toolsStep: some View {
        VStack(spacing: 0) {
            Text("Everything you need")
                .font(.system(size: 30, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("We provide all the tools to make sales easy")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .padding(.bottom, 36)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 24) {
                toolCell("AI-generated demos", "Custom previews for each business")
                toolCell("Objection handlers", "Ready answers for common pushback")
                toolCell("Local lead pipeline", "Curated list of businesses in your area")
                toolCell("Real-time dashboard", "Track visits, pitches, and earnings")
            }
            .padding(.horizontal, 8)
        }
    }

    private func toolCell(_ title: String, _ desc: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(hex: "#111827"))
            Text(desc)
                .font(.system(size: 12))
                .foregroundStyle(Color(hex: "#6B7280"))
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: — Steps 4-7: Input fields

    private func inputStep<Content: View>(title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) {
            Text(title)
                .font(.system(size: 28, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text(subtitle)
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 24)

            content()
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
        }
    }

    private var nameInput: some View {
        TextField("Your name", text: $name)
            .font(.system(size: 26, weight: .light))
            .foregroundStyle(Color(hex: "#111827"))
            .multilineTextAlignment(.center)
            .tint(accentBlue)
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled()
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) {
                Rectangle().fill(name.isEmpty ? Color(hex: "#E5E7EB") : accentBlue).frame(height: 2)
            }
    }

    private var phoneInput: some View {
        TextField("07xxx xxx xxx", text: $phone)
            .font(.system(size: 26, weight: .light))
            .foregroundStyle(Color(hex: "#111827"))
            .multilineTextAlignment(.center)
            .tint(accentBlue)
            .keyboardType(.phonePad)
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) {
                Rectangle().fill(phone.isEmpty ? Color(hex: "#E5E7EB") : accentBlue).frame(height: 2)
            }
    }

    private var pinInput: some View {
        SecureField("••••", text: $pin)
            .font(.system(size: 26, weight: .light))
            .foregroundStyle(Color(hex: "#111827"))
            .multilineTextAlignment(.center)
            .tint(accentBlue)
            .keyboardType(.numberPad)
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) {
                Rectangle().fill(pin.isEmpty ? Color(hex: "#E5E7EB") : accentBlue).frame(height: 2)
            }
            .onChange(of: pin) { _, newValue in
                if newValue.count > 4 { pin = String(newValue.prefix(4)) }
            }
    }

    private var areaInput: some View {
        HStack(spacing: 8) {
            Image(systemName: "mappin")
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: "#9CA3AF"))
            TextField("e.g. Manchester City Centre", text: $area)
                .font(.system(size: 18, weight: .light))
                .foregroundStyle(Color(hex: "#111827"))
                .tint(accentBlue)
                .textInputAutocapitalization(.words)
        }
        .padding(14)
        .background(Color(hex: "#F9FAFB"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(area.isEmpty ? Color(hex: "#E5E7EB") : accentBlue, lineWidth: 2)
        )
    }

    // MARK: — Step 8: Agreement

    private var agreementStep: some View {
        VStack(spacing: 0) {
            Text("One last thing")
                .font(.system(size: 30, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("Please read and confirm before we create your account")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 28)

            // Disclaimer
            Text("This is **commission-only work**. There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd. Results depend entirely on your own effort and approach.")
                .font(.system(size: 13))
                .foregroundStyle(Color(hex: "#6B7280"))
                .lineSpacing(3)
                .padding(20)
                .background(Color(hex: "#F9FAFB"))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.bottom, 18)

            // Checkbox
            Button(action: { agreedToTerms.toggle() }) {
                HStack(alignment: .top, spacing: 10) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(agreedToTerms ? accentBlue : Color(hex: "#D1D5DB"), lineWidth: 2)
                            .frame(width: 20, height: 20)
                        if agreedToTerms {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(accentBlue)
                                .frame(width: 20, height: 20)
                                .overlay(
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(.white)
                                )
                        }
                    }
                    .padding(.top, 1)

                    Text("I understand this is commission-only work. There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: "#4B5563"))
                        .lineSpacing(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .buttonStyle(.plain)

            if let error = signupError {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#EF4444"))
                    .padding(.top, 14)
            }
        }
    }

    // MARK: — Step 9: Done

    private var doneStep: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(Color(hex: "#ECFDF5"))
                    .frame(width: 64, height: 64)
                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(Color(hex: "#059669"))
            }
            .padding(.bottom, 20)

            Text("You're in!")
                .font(.system(size: 34, weight: .semibold))
                .tracking(-1.2)
                .foregroundStyle(Color(hex: "#111827"))
                .padding(.bottom, 6)

            Text("Your dashboard is ready")
                .font(.system(size: 17))
                .foregroundStyle(Color(hex: "#6B7280"))
                .padding(.bottom, 24)

            VStack(spacing: 8) {
                Text("Welcome, \(name)!")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111827"))

                Text("Your dashboard is ready with fresh leads in \(area)")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .multilineTextAlignment(.center)

                Rectangle().fill(Color(hex: "#E5E7EB")).frame(height: 1).padding(.vertical, 8)

                Text("To log back in, use:")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(hex: "#9CA3AF"))
                Text("Name: \(name) · PIN: ••••")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(hex: "#4B5563"))
            }
            .padding(20)
            .background(Color(hex: "#F9FAFB"))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .frame(maxWidth: 280)
        }
    }

    // MARK: — Logic

    private var canContinue: Bool {
        switch step {
        case 4: return name.count >= 2
        case 5: return true // phone is optional
        case 6: return pin.count == 4
        case 7: return !area.isEmpty
        case 8: return agreedToTerms
        default: return true
        }
    }

    private func handleNext() {
        signupError = nil

        if step == 8 {
            // Agreement step — create account
            isLoading = true
            Task {
                do {
                    try await authStore.signUp(
                        name: name.trimmingCharacters(in: .whitespaces),
                        pin: pin,
                        phone: phone.trimmingCharacters(in: .whitespaces),
                        area: area.trimmingCharacters(in: .whitespaces).uppercased()
                    )
                    withAnimation { step = 9 }
                    // Enable biometrics automatically
                    if BiometricManager.shared.canUseBiometrics {
                        authStore.biometricEnabled = true
                    }
                } catch {
                    signupError = error.localizedDescription
                }
                isLoading = false
            }
            return
        }

        if step == 9 {
            // Done — go to dashboard
            dismiss()
            return
        }

        withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
    }
}

#Preview {
    SignUpView()
        .environmentObject(AuthStore.shared)
}
