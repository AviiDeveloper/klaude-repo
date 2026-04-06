import SwiftUI

// MARK: — SignUpView
// 10-step onboarding matching the web sales-dashboard signup.
// Steps: Welcome → Earnings → Walkthrough → Tools → Name → Phone → PIN → Area → Agreement → Done

struct SignUpView: View {
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var appearanceStore: AppearanceStore
    @Environment(\.dismiss) private var dismiss

    @State private var step = 0
    @State private var name = ""
    @State private var phone = ""
    @State private var pin = ""
    @State private var pinConfirm = ""
    @State private var pinStage: PINStage = .create
    @State private var pinError: String?
    @State private var showBiometricSetup = false

    private enum PINStage { case create, confirm }
    @State private var area = ""
    @State private var agreedToTerms = false
    @State private var isLoading = false
    @State private var signupError: String?
    @State private var nameAvailable: Bool? = nil
    @State private var checkingName = false

    private let totalSteps = 10
    private let accentBlue = Color(hex: "#0071E3")

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            SubtleGridBackground()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Rectangle().fill(Color(hex: "#F3F4F6")).frame(height: 3)
                        Rectangle().fill(accentBlue)
                            .frame(width: geo.size.width * CGFloat(step + 1) / CGFloat(totalSteps), height: 3)
                            .animation(.easeOut(duration: 0.4), value: step)
                    }
                }
                .frame(height: 3)

                // Back / step counter
                HStack {
                    if step == 0 {
                        Button(action: { dismiss() }) {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Color(hex: "#9CA3AF"))
                        }
                    } else if step < totalSteps - 1 {
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                step -= 1
                                // Reset PIN state if going back to PIN step
                                if step == 6 { pinStage = .create; pin = ""; pinError = nil }
                            }
                        }) {
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
                .padding(.top, 12)
                .frame(height: 40)

                // Content fills the middle — centers vertically, scrolls if needed
                GeometryReader { geo in
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 0) {
                            Spacer(minLength: 0)
                            stepContent
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 24)
                        .frame(minHeight: geo.size.height)
                    }
                }

                // Fixed bottom: button + dots (hidden on PIN step — keypad handles it)
                VStack(spacing: 0) {
                    if step != 6 {
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
                    }

                    if step == 0 {
                        Button("Already have an account? Sign in") { dismiss() }
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#9CA3AF"))
                            .padding(.top, 10)
                    }

                    HStack(spacing: 4) {
                        ForEach(0..<totalSteps, id: \.self) { i in
                            RoundedRectangle(cornerRadius: 1)
                                .fill(i == step ? accentBlue : Color(hex: "#E5E7EB"))
                                .frame(width: i == step ? 24 : 5, height: 5)
                                .animation(.easeInOut(duration: 0.3), value: step)
                        }
                    }
                    .padding(.top, 14)
                }
                .padding(.bottom, 20)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: step)
        .preferredColorScheme(appearanceStore.preference.colorScheme)
        .alert(
            "Enable \(BiometricManager.shared.biometricLabel)?",
            isPresented: $showBiometricSetup
        ) {
            Button("Enable") {
                authStore.biometricEnabled = true
                withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
            }
            Button("Skip", role: .cancel) {
                withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
            }
        } message: {
            Text("Unlock SalesFlow quickly with \(BiometricManager.shared.biometricLabel) instead of entering your PIN each time.")
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: welcomeStep
        case 1: earningsStep
        case 2: walkthroughStep
        case 3: toolsStep
        case 4: inputStep(title: "What should we call you?", subtitle: "Just your first name is fine") { nameInput }
        case 5: inputStep(title: "Your phone number", subtitle: "So we can reach you about leads and payouts") { phoneInput }
        case 6: pinStep
        case 7: inputStep(title: "What area do you cover?", subtitle: "e.g. Manchester City Centre, Birmingham") { areaInput }
        case 8: agreementStep
        case 9: doneStep
        default: EmptyView()
        }
    }

    // MARK: — Step 0: Welcome

    private var welcomeStep: some View {
        VStack(spacing: 0) {
            Text("Start earning today")
                .font(.system(size: 32, weight: .bold))
                .tracking(-1)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 8)

            Text("Walk into businesses. Show them their new website. Earn £50 per sale.")
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: "#6B7280"))
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .padding(.bottom, 28)

            VStack(spacing: 10) {
                benefitCard(icon: "clock", color: "#3B82F6", title: "Flexible hours", body: "Choose your own schedule. No shifts, no boss, no rota.")
                benefitCard(icon: "sterlingsign.circle", color: "#10B981", title: "Instant earnings", body: "£50 commission per sale. Paid every Friday to your account.")
                benefitCard(icon: "sparkles", color: "#8B5CF6", title: "No experience needed", body: "We give you scripts, demo websites, and full support.")
            }

            // Theme toggle
            .padding(.bottom, 16)

            HStack(spacing: 6) {
                ForEach(AppearanceStore.Preference.allCases, id: \.self) { pref in
                    Button(action: { appearanceStore.preference = pref }) {
                        HStack(spacing: 5) {
                            Image(systemName: pref == .system ? "circle.lefthalf.filled" : pref == .light ? "sun.max" : "moon.fill")
                                .font(.system(size: 11))
                            Text(pref.label)
                                .font(.system(size: 12, weight: .medium))
                        }
                        .foregroundStyle(appearanceStore.preference == pref ? Color.white : Color(hex: "#6B7280"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(appearanceStore.preference == pref ? accentBlue : Color(hex: "#F3F4F6"))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func benefitCard(icon: String, color: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color(hex: color))
                .frame(width: 40, height: 40)
                .background(Color(hex: color).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111827"))
                Text(body)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color(hex: "#F9FAFB"))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: — Step 1: Earnings

    private var earningsStep: some View {
        VStack(spacing: 0) {
            Text("Real results, no promises")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("Here's what our contractors have actually earned")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .padding(.bottom, 20)

            // Hero earnings card
            VStack(spacing: 6) {
                Text("Contractor earnings last month")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color(hex: "#9CA3AF"))
                Text("£50 – £800")
                    .font(.system(size: 42, weight: .bold))
                    .tracking(-2)
                    .foregroundStyle(Color(hex: "#111827"))
                Text("Results vary by effort, area, and approach")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "#9CA3AF"))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 24)
            .background(Color(hex: "#F9FAFB"))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.bottom, 16)

            // Bullet cards
            VStack(spacing: 8) {
                earningsBulletCard("sterlingsign", "Every closed sale pays **£50 commission**, within 7 days")
                earningsBulletCard("xmark.circle", "No targets. No minimum hours. No shifts.")
                earningsBulletCard("person.2", "Some close one sale a week. Some close ten. It's entirely up to you.")
            }
        }
    }

    private func earningsBulletCard(_ icon: String, _ text: LocalizedStringKey) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color(hex: "#6B7280"))
                .frame(width: 28, height: 28)
                .background(Color(hex: "#F3F4F6"))
                .clipShape(Circle())

            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#4B5563"))
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(hex: "#FAFAFA"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: — Step 2: Walkthrough

    private var walkthroughStep: some View {
        VStack(spacing: 0) {
            Text("How a typical day works")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("Four simple steps to success")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .padding(.bottom, 20)

            VStack(spacing: 10) {
                walkthroughCard("1", "tray.and.arrow.down", "#3B82F6", "Get your leads", "We send you local businesses that don't have websites yet")
                walkthroughCard("2", "iphone", "#8B5CF6", "Walk in and pitch", "Show them their custom demo site right on your phone")
                walkthroughCard("3", "text.bubble", "#F59E0B", "Handle objections", "Use our proven scripts and ready-made talking points")
                walkthroughCard("4", "checkmark.seal", "#10B981", "Close and earn", "£50 lands in your account. They get their website.")
            }
        }
    }

    private func walkthroughCard(_ num: String, _ icon: String, _ color: String, _ title: String, _ desc: String) -> some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(hex: color).opacity(0.1))
                    .frame(width: 48, height: 48)
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(Color(hex: color))
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(num)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(Color(hex: color))
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color(hex: "#111827"))
                }
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color(hex: "#F9FAFB"))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    // MARK: — Step 3: Tools

    private var toolsStep: some View {
        VStack(spacing: 0) {
            Text("Everything you need")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 6)

            Text("We provide all the tools to make sales easy")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .padding(.bottom, 20)

            VStack(spacing: 10) {
                toolCard("wand.and.stars", "#8B5CF6", "AI-generated demos", "Custom website previews built for each business automatically")
                toolCard("shield.checkered", "#F59E0B", "Objection handlers", "Ready answers for every pushback — pricing, timing, trust")
                toolCard("mappin.and.ellipse", "#3B82F6", "Local lead pipeline", "Curated list of businesses in your area that need websites")
                toolCard("chart.bar", "#10B981", "Real-time dashboard", "Track your visits, pitches, sales, and earnings live")
            }
        }
    }

    private func toolCard(_ icon: String, _ color: String, _ title: String, _ desc: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color(hex: color))
                .frame(width: 40, height: 40)
                .background(Color(hex: color).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111827"))
                Text(desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color(hex: "#F9FAFB"))
        .clipShape(RoundedRectangle(cornerRadius: 14))
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
        VStack(spacing: 8) {
            TextField("Your name", text: $name)
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)
                .tint(accentBlue)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(.bottom, 12)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(name.isEmpty ? Color(hex: "#E5E7EB") : (nameAvailable == false ? Color(hex: "#EF4444") : accentBlue)).frame(height: 2)
                }
                .onChange(of: name) { _, _ in
                    nameAvailable = nil // reset on edit
                }

            if checkingName {
                HStack(spacing: 6) {
                    ProgressView().scaleEffect(0.7)
                    Text("Checking availability...")
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "#9CA3AF"))
                }
            } else if let available = nameAvailable {
                HStack(spacing: 4) {
                    Image(systemName: available ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .font(.system(size: 13))
                    Text(available ? "Name available" : "Name already taken")
                        .font(.system(size: 12))
                }
                .foregroundStyle(Color(hex: available ? "#10B981" : "#EF4444"))
            }
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

    private var pinStep: some View {
        VStack(spacing: 8) {
            Text(pinStage == .create ? "Create a PIN" : "Confirm your PIN")
                .font(.system(size: 28, weight: .semibold))
                .tracking(-0.8)
                .foregroundStyle(Color(hex: "#111827"))
                .multilineTextAlignment(.center)

            Text(pinStage == .create ? "4 digits — you'll use this to unlock the app" : "Enter the same PIN again")
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .multilineTextAlignment(.center)
                .padding(.bottom, 4)

            if let error = pinError {
                Text(error)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(hex: "#EF4444"))
                    .transition(.opacity)
            }

            PINKeypadView(
                title: "",
                pinLength: 4,
                onComplete: { entered in
                    if pinStage == .create {
                        pin = entered
                        withAnimation(.easeInOut(duration: 0.2)) {
                            pinStage = .confirm
                            pinError = nil
                        }
                        return true
                    } else {
                        if entered == pin {
                            pinError = nil
                            if BiometricManager.shared.canUseBiometrics {
                                showBiometricSetup = true
                            } else {
                                withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
                            }
                            return true
                        } else {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                pinError = "PINs didn't match — try again"
                                pinStage = .create
                                pin = ""
                            }
                            return false
                        }
                    }
                }
            )
            .id(pinStage) // Force fresh keypad when switching create → confirm
        }
    }

    private var areaInput: some View {
        VStack(spacing: 16) {
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

            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(accentBlue.opacity(0.6))
                    .padding(.top, 1)
                Text("This is just your starting area. You're not limited to leads here — you can pick up and sell to businesses anywhere.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .lineSpacing(2)
            }
            .padding(12)
            .background(accentBlue.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
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
        case 4: return name.count >= 2 && nameAvailable != false && !checkingName
        case 5: return true // phone is optional
        case 6: return false // PIN step handles its own navigation via keypad
        case 7: return !area.isEmpty
        case 8: return agreedToTerms
        default: return true
        }
    }

    private func handleNext() {
        signupError = nil

        // Check name availability before advancing past step 4
        if step == 4 {
            checkingName = true
            Task {
                do {
                    let available = try await APIClient.shared.checkNameAvailable(
                        name: name.trimmingCharacters(in: .whitespaces).lowercased()
                    )
                    nameAvailable = available
                    if available {
                        withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
                    }
                } catch {
                    // Network error — let them continue, backend will catch duplicates
                    withAnimation(.easeInOut(duration: 0.25)) { step += 1 }
                }
                checkingName = false
            }
            return
        }

        if step == 8 {
            // Agreement step — create account
            isLoading = true
            Task {
                do {
                    try await authStore.signUp(
                        name: name.trimmingCharacters(in: .whitespaces).lowercased(),
                        pin: pin,
                        phone: phone.trimmingCharacters(in: .whitespaces),
                        area: area.trimmingCharacters(in: .whitespaces).uppercased()
                    )
                    withAnimation { step = 9 }
                    // Offer biometrics via prompt (not auto-enabled)
                    if BiometricManager.shared.canUseBiometrics {
                        authStore.pendingBiometricPrompt = true
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

// MARK: — Subtle grid background

struct SubtleGridBackground: View {
    @Environment(\.colorScheme) private var colorScheme

    private var lineColor: Color {
        colorScheme == .dark
            ? Color.white.opacity(0.03)
            : Color.black.opacity(0.03)
    }

    private let spacing: CGFloat = 28

    var body: some View {
        Canvas { context, size in
            let color = colorScheme == .dark
                ? UIColor.white.withAlphaComponent(0.03)
                : UIColor.black.withAlphaComponent(0.03)
            let shading = GraphicsContext.Shading.color(Color(color))

            // Vertical lines
            var x: CGFloat = 0
            while x <= size.width {
                var path = Path()
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                context.stroke(path, with: shading, lineWidth: 0.5)
                x += spacing
            }

            // Horizontal lines
            var y: CGFloat = 0
            while y <= size.height {
                var path = Path()
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                context.stroke(path, with: shading, lineWidth: 0.5)
                y += spacing
            }
        }
    }
}

#Preview {
    SignUpView()
        .environmentObject(AuthStore.shared)
}
