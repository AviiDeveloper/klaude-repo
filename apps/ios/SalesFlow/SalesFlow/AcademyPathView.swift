import SwiftUI

// MARK: — AcademyPathView
// Duolingo-style vertical path with connected nodes. Light theme.

struct AcademyPathView: View {
    @State private var units: [TrainingUnit] = []
    @State private var isLoading = true
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    // Light palette (matches onboarding)
    private let bg        = Color.white
    private let textDark  = Color(hex: "#111827")
    private let textGray  = Color(hex: "#6b7280")
    private let textLight = Color(hex: "#9ca3af")
    private let accent    = Color(hex: "#0071E3")
    private let green     = Color(hex: "#059669")
    private let cardBg    = Color(hex: "#f9fafb")
    private let borderClr = Color(hex: "#e5e7eb")

    private var completedCount: Int { units.filter { $0.status == "completed" }.count }
    private var totalLessons: Int { units.reduce(0) { $0 + ($1.lessons?.count ?? 3) } }
    private var currentUnit: TrainingUnit? { units.first { $0.status == "available" || $0.status == "in_progress" } }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            if isLoading {
                ProgressView()
                    .tint(textGray)
            } else if let error {
                VStack(spacing: 12) {
                    Text("Couldn't load training")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(textDark)
                    Text(error)
                        .font(.system(size: 13))
                        .foregroundStyle(textGray)
                    Button("Retry") { Task { await load() } }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(accent)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // ── Header ──────────────────────────────────
                        VStack(spacing: 8) {
                            Text("SalesFlow Academy")
                                .font(.system(size: 28, weight: .bold))
                                .tracking(-0.5)
                                .foregroundStyle(textDark)
                            Text("\(completedCount) of \(units.count) units complete")
                                .font(.system(size: 14))
                                .foregroundStyle(textLight)
                        }
                        .padding(.top, 24)
                        .padding(.bottom, 40)

                        // ── Path ────────────────────────────────────
                        VStack(spacing: 0) {
                            ForEach(Array(units.enumerated()), id: \.element.id) { index, unit in
                                AcademyNodeView(
                                    unit: unit,
                                    isFirst: index == 0,
                                    isLast: index == units.count - 1,
                                    textDark: textDark,
                                    textGray: textGray,
                                    textLight: textLight,
                                    accent: accent,
                                    green: green,
                                    borderClr: borderClr
                                )
                            }
                        }
                        .padding(.horizontal, 40)
                        .padding(.bottom, 100)
                    }
                }

                // ── Continue button ─────────────────────────
                if let current = currentUnit {
                    VStack {
                        Spacer()
                        NavigationLink(destination: AcademyLessonView(unitId: current.unitId)) {
                            HStack(spacing: 8) {
                                Text("Continue")
                                    .font(.system(size: 16, weight: .semibold))
                                Image(systemName: "arrow.right")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            .foregroundStyle(.white)
                            .frame(width: 200, height: 52)
                            .background(accent)
                            .clipShape(Capsule())
                        }
                        .padding(.bottom, 32)
                    }
                }
            }
        }
        .preferredColorScheme(.light)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(textGray)
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        error = nil
        do {
            units = try await APIClient.shared.fetchTrainingUnits()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: — Node View

private struct AcademyNodeView: View {
    let unit: TrainingUnit
    let isFirst: Bool
    let isLast: Bool
    let textDark: Color
    let textGray: Color
    let textLight: Color
    let accent: Color
    let green: Color
    let borderClr: Color

    @State private var pulsing = false

    private var isCompleted: Bool { unit.status == "completed" }
    private var isCurrent: Bool { unit.status == "available" || unit.status == "in_progress" }
    private var isLocked: Bool { unit.status == "locked" }

    var body: some View {
        VStack(spacing: 0) {
            // Connector line (above)
            if !isFirst {
                Rectangle()
                    .fill(isCompleted || isCurrent ? accent.opacity(0.3) : borderClr)
                    .frame(width: 2, height: 24)
            }

            // Node + label
            HStack(spacing: 20) {
                // Circle
                ZStack {
                    if isCurrent {
                        Circle()
                            .fill(accent.opacity(0.1))
                            .frame(width: 56, height: 56)
                            .scaleEffect(pulsing ? 1.15 : 1.0)
                            .opacity(pulsing ? 0.5 : 1.0)
                            .animation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true), value: pulsing)
                    }

                    Circle()
                        .fill(isCompleted ? green : isCurrent ? accent : Color(hex: "#e5e7eb"))
                        .frame(width: 44, height: 44)

                    if isCompleted {
                        Image(systemName: "checkmark")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(.white)
                    } else if isCurrent {
                        Image(systemName: "play.fill")
                            .font(.system(size: 16))
                            .foregroundStyle(.white)
                    } else {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Color(hex: "#9ca3af"))
                    }
                }
                .onAppear { if isCurrent { pulsing = true } }

                // Text
                VStack(alignment: .leading, spacing: 4) {
                    Text(unit.title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(isLocked ? textLight : textDark)
                    if let sub = unit.subtitle {
                        Text(sub)
                            .font(.system(size: 13))
                            .foregroundStyle(isLocked ? borderClr : textGray)
                    }
                    if !isLocked {
                        Text("\(unit.estimatedMinutes) min")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(textLight)
                    }
                }

                Spacer()

                // Chevron for accessible units
                if !isLocked {
                    NavigationLink(destination: AcademyLessonView(unitId: unit.unitId)) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(textLight)
                    }
                }
            }
            .padding(.vertical, 8)

            // Connector line (below)
            if !isLast {
                Rectangle()
                    .fill(isCompleted ? accent.opacity(0.3) : borderClr)
                    .frame(width: 2, height: 24)
            }
        }
    }
}

#Preview {
    NavigationStack {
        AcademyPathView()
    }
}
