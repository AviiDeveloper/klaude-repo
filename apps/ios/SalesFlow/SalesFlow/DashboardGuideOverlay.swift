import SwiftUI

// MARK: — DashboardGuideOverlay
// Coach marks overlay shown once on first dashboard visit.
// Walks the user through stats, filters, leads, and tabs with
// a spotlight cutout + tooltip animation.

struct DashboardGuideOverlay: View {
    @Binding var isShowing: Bool
    @State private var step = 0
    @State private var appeared = false

    private let steps: [GuideStep] = [
        GuideStep(
            title: "Welcome to your dashboard",
            body: "This is where you'll manage all your leads and track your earnings. Let's take a quick look around.",
            icon: "hand.wave",
            spotlight: .top,
            alignment: .center
        ),
        GuideStep(
            title: "Your stats at a glance",
            body: "See how many leads are in your queue, how many you've visited, pitched, sold — and your total earnings.",
            icon: "chart.bar",
            spotlight: .statsBar,
            alignment: .below
        ),
        GuideStep(
            title: "Filter by status",
            body: "Tap a filter to see only new leads, visited, pitched, or sold. Helps you focus on what matters right now.",
            icon: "line.3.horizontal.decrease",
            spotlight: .filterBar,
            alignment: .below
        ),
        GuideStep(
            title: "Your lead list",
            body: "Each card shows the business name, type, rating, and status. Tap any lead to see full details, prep notes, and demo tools.",
            icon: "person.crop.rectangle.stack",
            spotlight: .leadRow,
            alignment: .below
        ),
        GuideStep(
            title: "Navigate with tabs",
            body: "Switch between your leads, map view, payouts, and profile. The map shows leads near you on a real map.",
            icon: "rectangle.split.3x1",
            spotlight: .tabBar,
            alignment: .above
        ),
        GuideStep(
            title: "You're ready!",
            body: "Pick a lead, walk in, show the demo on your phone, and close the deal. £50 per sale, paid weekly.",
            icon: "checkmark.circle",
            spotlight: .top,
            alignment: .center
        ),
    ]

    var body: some View {
        ZStack {
            // ── Dimmed background ────────────────────────
            Color.black.opacity(appeared ? 0.85 : 0)
                .ignoresSafeArea()
                .onTapGesture { advance() }

            // ── Spotlight cutout ─────────────────────────
            spotlightShape
                .ignoresSafeArea()

            // ── Tooltip card ─────────────────────────────
            VStack(spacing: 0) {
                if currentStep.alignment == .below || currentStep.alignment == .center {
                    Spacer()
                    if currentStep.alignment == .center {
                        Spacer()
                    }
                }

                tooltipCard
                    .padding(.horizontal, 24)
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)

                if currentStep.alignment == .above || currentStep.alignment == .center {
                    Spacer()
                    if currentStep.alignment == .center {
                        Spacer()
                    }
                }
            }
        }
        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: step)
        .animation(.easeOut(duration: 0.4), value: appeared)
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) { appeared = true }
        }
    }

    private var currentStep: GuideStep { steps[step] }

    // MARK: — Tooltip

    private var tooltipCard: some View {
        VStack(spacing: 16) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color(hex: "#0071E3").opacity(0.15))
                    .frame(width: 52, height: 52)
                Image(systemName: currentStep.icon)
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(Color(hex: "#0071E3"))
            }

            // Text
            VStack(spacing: 6) {
                Text(currentStep.title)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)

                Text(currentStep.body)
                    .font(.system(size: 14))
                    .foregroundStyle(Color(hex: "#999999"))
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Progress + button
            VStack(spacing: 16) {
                // Dots
                HStack(spacing: 6) {
                    ForEach(0..<steps.count, id: \.self) { i in
                        Circle()
                            .fill(i == step ? Color(hex: "#0071E3") : Color(hex: "#333333"))
                            .frame(width: i == step ? 8 : 6, height: i == step ? 8 : 6)
                            .animation(.spring(response: 0.3), value: step)
                    }
                }

                // Button
                Button(action: advance) {
                    Text(step == steps.count - 1 ? "Let's go" : "Next")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color(hex: "#0071E3"))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Skip
                if step < steps.count - 1 {
                    Button(action: dismiss) {
                        Text("Skip tour")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#666666"))
                    }
                }
            }
        }
        .padding(28)
        .background(Color(hex: "#111111"))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay(
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color(hex: "#222222"), lineWidth: 1)
        )
        .id(step) // force re-render for animation
        .transition(.asymmetric(
            insertion: .opacity.combined(with: .offset(y: 12)),
            removal: .opacity.combined(with: .offset(y: -8))
        ))
    }

    // MARK: — Spotlight shape

    @ViewBuilder
    private var spotlightShape: some View {
        switch currentStep.spotlight {
        case .statsBar:
            SpotlightCutout(rect: CGRect(x: 16, y: 100, width: UIScreen.main.bounds.width - 32, height: 80), cornerRadius: 12)
        case .filterBar:
            SpotlightCutout(rect: CGRect(x: 16, y: 188, width: UIScreen.main.bounds.width - 32, height: 48), cornerRadius: 10)
        case .leadRow:
            SpotlightCutout(rect: CGRect(x: 0, y: 246, width: UIScreen.main.bounds.width, height: 90), cornerRadius: 0)
        case .tabBar:
            SpotlightCutout(rect: CGRect(x: 0, y: UIScreen.main.bounds.height - 90, width: UIScreen.main.bounds.width, height: 90), cornerRadius: 0)
        case .top:
            EmptyView()
        }
    }

    // MARK: — Actions

    private func advance() {
        if step < steps.count - 1 {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                step += 1
            }
        } else {
            dismiss()
        }
    }

    private func dismiss() {
        withAnimation(.easeOut(duration: 0.3)) {
            appeared = false
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            isShowing = false
        }
    }
}

// MARK: — Spotlight cutout shape

private struct SpotlightCutout: View {
    let rect: CGRect
    let cornerRadius: CGFloat

    var body: some View {
        Rectangle()
            .fill(.clear)
            .overlay {
                Canvas { context, size in
                    // Draw nothing — we just need the inverse mask
                }
            }
            .mask {
                ZStack {
                    Rectangle()
                        .fill(.white)

                    RoundedRectangle(cornerRadius: cornerRadius)
                        .frame(width: rect.width, height: rect.height)
                        .position(x: rect.midX, y: rect.midY)
                        .blendMode(.destinationOut)
                }
                .compositingGroup()
            }
    }
}

// MARK: — Guide step model

private struct GuideStep {
    let title: String
    let body: String
    let icon: String
    let spotlight: SpotlightTarget
    let alignment: TooltipAlignment

    enum SpotlightTarget {
        case top, statsBar, filterBar, leadRow, tabBar
    }

    enum TooltipAlignment {
        case above, below, center
    }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        DashboardGuideOverlay(isShowing: .constant(true))
    }
}
