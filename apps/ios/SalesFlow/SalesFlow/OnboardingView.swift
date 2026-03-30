import SwiftUI

// MARK: — OnboardingView
// 10-step onboarding: 4 pitch screens → 4 input screens → agreement → done
// Light theme matching the web signup flow.

struct OnboardingView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var step = 0
    @State private var name = ""
    @State private var phone = ""
    @State private var pin = ""
    @State private var area = ""
    @State private var agreedToTerms = false
    @State private var signupError: String?
    @State private var isSubmitting = false
    @FocusState private var inputFocused: Bool

    private let totalSteps = 10
    private let blue = Color(hex: "#0071E3")

    var body: some View {
        ZStack(alignment: .top) {
            Color.white.ignoresSafeArea()

            VStack(spacing: 0) {
                // ── Progress bar ─────────────────────────────
                GeometryReader { geo in
                    Rectangle()
                        .fill(Color(hex: "#f3f4f6"))
                        .frame(height: 3)
                        .overlay(alignment: .leading) {
                            Rectangle()
                                .fill(blue)
                                .frame(width: geo.size.width * CGFloat(step + 1) / CGFloat(totalSteps))
                                .animation(.easeOut(duration: 0.4), value: step)
                        }
                }
                .frame(height: 3)

                // ── Back button ──────────────────────────────
                HStack {
                    if step > 0 && step < totalSteps - 1 {
                        Button(action: { withAnimation(.easeInOut(duration: 0.25)) { step -= 1 } }) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(Color(hex: "#9ca3af"))
                                .padding(12)
                        }
                    }
                    Spacer()
                }
                .frame(height: 44)
                .padding(.horizontal, 8)

                // ── Content ──────────────────────────────────
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        Spacer(minLength: 40)

                        Group {
                            switch step {
                            case 0:  welcomeStep
                            case 1:  earningsStep
                            case 2:  walkthroughStep
                            case 3:  toolsStep
                            case 4:  inputStep(title: "What should we call you?", subtitle: "Just your first name is fine")
                            case 5:  inputStep(title: "Your phone number", subtitle: "So we can reach you about leads and payouts")
                            case 6:  inputStep(title: "Create a quick PIN", subtitle: "4 digits — use this with your name to log back in")
                            case 7:  inputStep(title: "What area do you cover?", subtitle: "e.g. Manchester City Centre, Birmingham")
                            case 8:  agreementStep
                            case 9:  doneStep
                            default: EmptyView()
                            }
                        }
                        .padding(.horizontal, 24)

                        Spacer(minLength: 32)

                        // ── Continue button ──────────────────
                        Button(action: handleNext) {
                            HStack(spacing: 8) {
                                if isSubmitting {
                                    ProgressView().tint(.white)
                                } else {
                                    Text(step == totalSteps - 1 ? "Go to Dashboard" : "Continue")
                                        .font(.system(size: 16, weight: .semibold))
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 14, weight: .semibold))
                                }
                            }
                            .foregroundStyle(.white)
                            .frame(width: 200, height: 52)
                            .background(blue)
                            .clipShape(Capsule())
                            .opacity(canContinue ? 1.0 : 0.3)
                        }
                        .disabled(!canContinue || isSubmitting)
                        .animation(.easeInOut(duration: 0.2), value: canContinue)
                        .padding(.bottom, 8)

                        // ── Sign in link (first screen only) ─
                        if step == 0 {
                            Button(action: { authStore.completeOnboarding() }) {
                                Text("Already have an account? Sign in")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color(hex: "#9ca3af"))
                            }
                            .padding(.top, 12)
                        }

                        Spacer(minLength: 24)
                    }
                    .frame(minHeight: UIScreen.main.bounds.height - 100)
                }
                .scrollDismissesKeyboard(.interactively)
            }

            // ── Step dots (bottom) ───────────────────────
            VStack {
                Spacer()
                HStack(spacing: 6) {
                    ForEach(0..<totalSteps, id: \.self) { i in
                        Capsule()
                            .fill(i == step ? blue : Color(hex: "#e5e7eb"))
                            .frame(width: i == step ? 24 : 6, height: 6)
                            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: step)
                    }
                }
                .padding(.bottom, 20)
            }
        }
        .preferredColorScheme(.light)
    }

    // MARK: — Step Views

    private var welcomeStep: some View {
        VStack(spacing: 0) {
            Text("Start earning today")
                .font(.system(size: 36, weight: .semibold))
                .tracking(-1.0)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 12)

            Text("Walk into businesses. Show them their new website. Earn £50 per sale.")
                .font(.system(size: 17))
                .foregroundStyle(Color(hex: "#9ca3af"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 48)

            VStack(spacing: 0) {
                ForEach(Array([
                    ("Flexible hours", "Choose your own schedule, no shifts"),
                    ("Instant earnings", "£50 commission per sale, paid weekly"),
                    ("No experience needed", "We give you scripts, demos, and support"),
                ].enumerated()), id: \.offset) { i, item in
                    HStack(alignment: .top, spacing: 16) {
                        Text("\(i + 1)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color(hex: "#9ca3af"))
                            .frame(width: 32, height: 32)
                            .background(Color(hex: "#f9fafb"))
                            .clipShape(Circle())

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.0)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color(hex: "#111827"))
                            Text(item.1)
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "#6b7280"))
                        }
                        Spacer()
                    }
                    .padding(.vertical, 16)
                    if i < 2 {
                        Divider().foregroundStyle(Color(hex: "#f3f4f6"))
                    }
                }
            }
            .padding(.horizontal, 8)
        }
    }

    private var earningsStep: some View {
        VStack(spacing: 0) {
            Text("Real results, no promises")
                .font(.system(size: 32, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Here's what our contractors have actually earned")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9ca3af"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 36)

            VStack(spacing: 0) {
                VStack(spacing: 4) {
                    Text("Contractor earnings last month")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#9ca3af"))
                    Text("£50 – £800")
                        .font(.system(size: 40, weight: .semibold))
                        .tracking(-1.2)
                        .foregroundStyle(Color(hex: "#111827"))
                    Text("Results vary by effort, area, and approach")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#9ca3af"))
                }
                .padding(.bottom, 24)

                Divider().foregroundStyle(Color(hex: "#e5e7eb"))
                    .padding(.bottom, 20)

                VStack(alignment: .leading, spacing: 16) {
                    bulletPoint("Every closed sale pays **£50 commission**, within 7 days")
                    bulletPoint("No targets. No minimum hours. No shifts.")
                    bulletPoint("Some contractors close one sale a week. Some close ten. It's entirely up to you.")
                }
            }
            .padding(24)
            .background(Color(hex: "#f9fafb"))
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private var walkthroughStep: some View {
        VStack(spacing: 0) {
            Text("How a typical day works")
                .font(.system(size: 32, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Four simple steps to success")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9ca3af"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 44)

            VStack(spacing: 32) {
                ForEach(Array([
                    ("01", "Get your leads", "We send you local businesses that need websites"),
                    ("02", "Walk in and pitch", "Show them their demo site on your phone"),
                    ("03", "Handle objections", "Use our proven scripts and talking points"),
                    ("04", "Close and earn", "£50 in your account, they get their site"),
                ].enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .top, spacing: 20) {
                        Text(item.0)
                            .font(.system(size: 36, weight: .semibold))
                            .foregroundStyle(Color(hex: "#e5e7eb"))
                            .tracking(-1.0)
                            .frame(width: 56, alignment: .leading)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.1)
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundStyle(Color(hex: "#111827"))
                                .tracking(-0.3)
                            Text(item.2)
                                .font(.system(size: 14))
                                .foregroundStyle(Color(hex: "#6b7280"))
                                .lineSpacing(2)
                        }
                        .padding(.top, 4)
                        Spacer()
                    }
                }
            }
            .padding(.horizontal, 8)
        }
    }

    private var toolsStep: some View {
        VStack(spacing: 0) {
            Text("Everything you need")
                .font(.system(size: 32, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("We provide all the tools to make sales easy")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9ca3af"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 44)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 24) {
                toolCard("AI-generated demos", "Custom previews for each business")
                toolCard("Objection handlers", "Ready answers for common pushback")
                toolCard("Local lead pipeline", "Curated list of businesses in your area")
                toolCard("Real-time dashboard", "Track visits, pitches, and earnings")
            }
            .padding(.horizontal, 8)
        }
    }

    private func inputStep(title: String, subtitle: String) -> some View {
        VStack(spacing: 0) {
            Text(title)
                .font(.system(size: 32, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text(subtitle)
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9ca3af"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 44)

            Group {
                switch step {
                case 4: // Name
                    TextField("Your name", text: $name)
                        .font(.system(size: 28, weight: .light))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Color(hex: "#111827"))
                        .tint(blue)
                        .focused($inputFocused)
                        .onAppear { inputFocused = true }
                case 5: // Phone
                    TextField("07xxx xxx xxx", text: $phone)
                        .font(.system(size: 28, weight: .light))
                        .multilineTextAlignment(.center)
                        .keyboardType(.phonePad)
                        .foregroundStyle(Color(hex: "#111827"))
                        .tint(blue)
                        .focused($inputFocused)
                        .onAppear { inputFocused = true }
                case 6: // PIN
                    SecureField("••••", text: $pin)
                        .font(.system(size: 28, weight: .light))
                        .multilineTextAlignment(.center)
                        .keyboardType(.numberPad)
                        .foregroundStyle(Color(hex: "#111827"))
                        .tint(blue)
                        .focused($inputFocused)
                        .onAppear { inputFocused = true }
                case 7: // Area
                    HStack(spacing: 12) {
                        Image(systemName: "mappin.and.ellipse")
                            .foregroundStyle(Color(hex: "#9ca3af"))
                        TextField("e.g. Manchester City Centre", text: $area)
                            .font(.system(size: 18, weight: .light))
                            .foregroundStyle(Color(hex: "#111827"))
                            .tint(blue)
                            .focused($inputFocused)
                            .onAppear { inputFocused = true }
                    }
                    .padding(16)
                    .background(Color(hex: "#f9fafb"))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(inputFocused ? blue : Color(hex: "#e5e7eb"), lineWidth: 2)
                    )
                default: EmptyView()
                }
            }
            .padding(.horizontal, step == 7 ? 0 : 32)
            .overlay(alignment: .bottom) {
                if step != 7 {
                    Rectangle()
                        .fill(inputFocused ? blue : Color(hex: "#e5e7eb"))
                        .frame(height: 2)
                        .padding(.horizontal, 32)
                        .offset(y: 8)
                }
            }
        }
    }

    private var agreementStep: some View {
        VStack(spacing: 0) {
            Text("One last thing")
                .font(.system(size: 32, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Please read and confirm before we create your account")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9ca3af"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 32)

            // Disclosure card
            VStack(alignment: .leading, spacing: 0) {
                Text("This is ")
                    .foregroundStyle(Color(hex: "#6b7280")) +
                Text("commission-only work")
                    .foregroundStyle(Color(hex: "#111827"))
                    .fontWeight(.semibold) +
                Text(". There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd. Results depend entirely on your own effort and approach.")
                    .foregroundStyle(Color(hex: "#6b7280"))
            }
            .font(.system(size: 13))
            .lineSpacing(3)
            .padding(20)
            .background(Color(hex: "#f9fafb"))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.bottom, 20)

            // Right to work stub
            HStack(spacing: 12) {
                Image(systemName: "doc.badge.plus")
                    .font(.system(size: 20))
                    .foregroundStyle(Color(hex: "#9ca3af"))
                    .frame(width: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Right to work document")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color(hex: "#111827"))
                    Text("You can upload this later from your profile")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#9ca3af"))
                }
                Spacer()
                Text("Later")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(hex: "#9ca3af"))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color(hex: "#f3f4f6"))
                    .clipShape(Capsule())
            }
            .padding(16)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color(hex: "#e5e7eb"), lineWidth: 1)
            )
            .padding(.bottom, 24)

            // Checkbox
            Button(action: { agreedToTerms.toggle() }) {
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(agreedToTerms ? blue : .white)
                            .frame(width: 20, height: 20)
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(agreedToTerms ? blue : Color(hex: "#d1d5db"), lineWidth: 2)
                            )
                        if agreedToTerms {
                            Image(systemName: "checkmark")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .padding(.top, 1)

                    Text("I understand this is commission-only work. There are no guaranteed earnings, no minimum hours, and no employment relationship with SalesFlow Ltd.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: "#4b5563"))
                        .lineSpacing(2)
                        .multilineTextAlignment(.leading)
                }
            }
            .buttonStyle(.plain)

            if let error = signupError {
                Text(error)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#ef4444"))
                    .padding(.top, 16)
            }
        }
    }

    private var doneStep: some View {
        VStack(spacing: 0) {
            Circle()
                .fill(Color(hex: "#ecfdf5"))
                .frame(width: 64, height: 64)
                .overlay(
                    Image(systemName: "checkmark")
                        .font(.system(size: 28, weight: .medium))
                        .foregroundStyle(Color(hex: "#059669"))
                )
                .padding(.bottom, 24)

            Text("You're in!")
                .font(.system(size: 36, weight: .semibold))
                .tracking(-1.0)
                .foregroundStyle(Color(hex: "#111827"))
                .padding(.bottom, 8)

            Text("Your dashboard is ready")
                .font(.system(size: 17))
                .foregroundStyle(Color(hex: "#6b7280"))
                .padding(.bottom, 32)

            // Welcome card
            VStack(spacing: 12) {
                Text("Welcome, \(name)!")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111827"))

                Text("Your dashboard is ready with fresh leads in \(area)")
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#6b7280"))
                    .multilineTextAlignment(.center)

                Divider().padding(.vertical, 4)

                VStack(spacing: 4) {
                    Text("To log back in, use:")
                        .font(.system(size: 11))
                        .foregroundStyle(Color(hex: "#9ca3af"))
                    Text("Name: \(name)  ·  PIN: ••••")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Color(hex: "#4b5563"))
                }
            }
            .padding(24)
            .background(Color(hex: "#f9fafb"))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.bottom, 24)

            // Stripe stub
            HStack(spacing: 12) {
                Image(systemName: "creditcard")
                    .font(.system(size: 20))
                    .foregroundStyle(blue)
                    .frame(width: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Set up payouts")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color(hex: "#111827"))
                    Text("Required before your first payout")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#9ca3af"))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(hex: "#d1d5db"))
            }
            .padding(16)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color(hex: "#e5e7eb"), lineWidth: 1)
            )
        }
    }

    // MARK: — Helpers

    private func toolCard(_ title: String, _ desc: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(hex: "#111827"))
            Text(desc)
                .font(.system(size: 12))
                .foregroundStyle(Color(hex: "#6b7280"))
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func bulletPoint(_ text: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("—")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color(hex: "#d1d5db"))
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#4b5563"))
                .lineSpacing(2)
        }
    }

    private var canContinue: Bool {
        switch step {
        case 4:  return name.count >= 2
        case 5:  return !phone.isEmpty
        case 6:  return pin.count == 4
        case 7:  return !area.isEmpty
        case 8:  return agreedToTerms
        default: return true
        }
    }

    private func handleNext() {
        if step == 8 {
            // Submit signup
            signupError = nil
            isSubmitting = true
            Task {
                do {
                    try await authStore.signUp(
                        name: name.trimmingCharacters(in: .whitespaces),
                        pin: pin,
                        phone: phone.trimmingCharacters(in: .whitespaces),
                        area: area.trimmingCharacters(in: .whitespaces)
                    )
                    withAnimation(.easeInOut(duration: 0.3)) { step = 9 }
                } catch {
                    signupError = error.localizedDescription
                }
                isSubmitting = false
            }
            return
        }

        if step == 9 {
            authStore.completeOnboarding()
            return
        }

        inputFocused = false
        withAnimation(.easeInOut(duration: 0.3)) { step += 1 }
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AuthStore.shared)
}
