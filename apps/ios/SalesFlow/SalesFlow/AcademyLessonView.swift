import SwiftUI

// MARK: — AcademyLessonView
// Full-screen lesson player. Renders editorial text, scenarios, roleplay, quickfire.
// Light theme. No tab bar.

struct AcademyLessonView: View {
    let unitId: String

    @State private var unit: TrainingUnit?
    @State private var lessons: [TrainingLesson] = []
    @State private var currentIndex = 0
    @State private var selectedOption: String?
    @State private var showFeedback = false
    @State private var quickfireIndex = 0
    @State private var quickfireAnswer: String?
    @State private var isComplete = false
    @State private var isLoading = true
    @Environment(\.dismiss) private var dismiss

    private let accent    = Color(hex: "#0071E3")
    private let textDark  = Color(hex: "#111827")
    private let textGray  = Color(hex: "#6b7280")
    private let textLight = Color(hex: "#9ca3af")
    private let cardBg    = Color(hex: "#f9fafb")
    private let borderClr = Color(hex: "#e5e7eb")
    private let green     = Color(hex: "#059669")
    private let amber     = Color(hex: "#b8922a")

    private var currentLesson: TrainingLesson? {
        guard currentIndex < lessons.count else { return nil }
        return lessons[currentIndex]
    }

    private var progress: Double {
        guard !lessons.isEmpty else { return 0 }
        return Double(currentIndex + 1) / Double(lessons.count)
    }

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()

            if isLoading {
                ProgressView().tint(textGray)
            } else if isComplete {
                unitCompleteView
            } else if let lesson = currentLesson {
                VStack(spacing: 0) {
                    // ── Progress bar ─────────────────────────
                    GeometryReader { geo in
                        Rectangle()
                            .fill(Color(hex: "#f3f4f6"))
                            .frame(height: 3)
                            .overlay(alignment: .leading) {
                                Rectangle()
                                    .fill(accent)
                                    .frame(width: geo.size.width * progress)
                                    .animation(.easeOut(duration: 0.4), value: progress)
                            }
                    }
                    .frame(height: 3)

                    // ── Top bar ──────────────────────────────
                    HStack {
                        Button(action: {
                            if currentIndex > 0 {
                                resetState()
                                withAnimation { currentIndex -= 1 }
                            } else {
                                dismiss()
                            }
                        }) {
                            Image(systemName: currentIndex > 0 ? "chevron.left" : "xmark")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundStyle(textLight)
                                .padding(12)
                        }
                        Spacer()
                        Text("\(currentIndex + 1) of \(lessons.count)")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(textLight)
                            .padding(.trailing, 16)
                    }
                    .frame(height: 44)

                    // ── Content ──────────────────────────────
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 0) {
                            Spacer(minLength: 24)

                            switch lesson.type {
                            case "editorial":  editorialView(lesson)
                            case "scenario":   scenarioView(lesson)
                            case "roleplay":   roleplayView(lesson)
                            case "quickfire":  quickfireView(lesson)
                            default:           editorialView(lesson)
                            }

                            Spacer(minLength: 100)
                        }
                        .padding(.horizontal, 24)
                    }

                    // ── Continue button ──────────────────────
                    if canContinue(lesson) {
                        Button(action: advance) {
                            Text(currentIndex == lessons.count - 1 ? "Complete Unit" : "Continue")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                                .background(accent)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 24)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                }
            }
        }
        .preferredColorScheme(.light)
        .navigationBarHidden(true)
        .toolbar(.hidden, for: .tabBar)
        .task { await load() }
    }

    // MARK: — Editorial

    private func editorialView(_ lesson: TrainingLesson) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            if let title = lesson.title {
                Text(title)
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.5)
                    .foregroundStyle(textDark)
            }

            if let content = lesson.content {
                Text(LocalizedStringKey(content))
                    .font(.system(size: 17))
                    .foregroundStyle(textDark)
                    .lineSpacing(8)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let highlight = lesson.highlight {
                HStack(spacing: 12) {
                    Rectangle()
                        .fill(accent)
                        .frame(width: 3)
                    Text(highlight)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(accent)
                        .lineSpacing(4)
                }
                .padding(.vertical, 8)
            }
        }
        .frame(maxWidth: 600)
    }

    // MARK: — Scenario

    private func scenarioView(_ lesson: TrainingLesson) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            if let title = lesson.title {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(textDark)
            }

            if let setup = lesson.setup {
                Text(LocalizedStringKey(setup))
                    .font(.system(size: 16))
                    .foregroundStyle(textGray)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let options = lesson.options {
                VStack(spacing: 10) {
                    ForEach(options) { option in
                        Button(action: {
                            guard selectedOption == nil else { return }
                            selectedOption = option.optionId
                            showFeedback = true
                            // Fire-and-forget API call
                            Task {
                                try? await APIClient.shared.respondToScenario(
                                    unitId: unitId, lessonIndex: currentIndex,
                                    scenarioId: lesson.lessonId, option: option.optionId, score: option.score
                                )
                            }
                        }) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(option.text)
                                    .font(.system(size: 15))
                                    .foregroundStyle(textDark)
                                    .multilineTextAlignment(.leading)
                                    .lineSpacing(4)

                                if showFeedback && selectedOption == option.optionId, let feedback = option.feedback {
                                    VStack(alignment: .leading, spacing: 4) {
                                        HStack(spacing: 6) {
                                            Text(option.score == 3 ? "Strong" : option.score == 2 ? "Okay" : "Weak")
                                                .font(.system(size: 12, weight: .bold))
                                                .foregroundStyle(option.score == 3 ? green : option.score == 2 ? amber : textLight)
                                            Spacer()
                                        }
                                        Text(feedback)
                                            .font(.system(size: 13))
                                            .foregroundStyle(textGray)
                                            .lineSpacing(3)
                                    }
                                    .padding(.top, 4)
                                    .transition(.opacity.combined(with: .offset(y: -4)))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(selectedOption == option.optionId ? cardBg : .white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        selectedOption == option.optionId
                                            ? (option.score == 3 ? green : option.score == 2 ? amber : textLight)
                                            : borderClr,
                                        lineWidth: selectedOption == option.optionId ? 2 : 1
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(selectedOption != nil && selectedOption != option.optionId)
                        .opacity(selectedOption != nil && selectedOption != option.optionId ? 0.4 : 1)
                        .animation(.easeInOut(duration: 0.25), value: selectedOption)
                    }
                }
            }
        }
    }

    // MARK: — Roleplay

    private func roleplayView(_ lesson: TrainingLesson) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if let title = lesson.title {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(textDark)
                    .padding(.bottom, 8)
            }

            if let messages = lesson.messages {
                ForEach(Array(messages.enumerated()), id: \.offset) { i, msg in
                    if msg.role == "owner" {
                        // Owner bubble (left)
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Business Owner")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(textLight)
                                    .textCase(.uppercase)
                                    .tracking(0.3)
                                if let text = msg.text {
                                    Text(text)
                                        .font(.system(size: 15))
                                        .foregroundStyle(textDark)
                                        .lineSpacing(4)
                                }
                            }
                            .padding(16)
                            .background(cardBg)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            Spacer(minLength: 48)
                        }
                    } else if let options = msg.options {
                        // Your options (right-aligned)
                        VStack(spacing: 8) {
                            ForEach(options) { opt in
                                Button(action: {
                                    guard selectedOption == nil else { return }
                                    selectedOption = opt.optionId
                                    showFeedback = true
                                    Task {
                                        try? await APIClient.shared.respondToScenario(
                                            unitId: unitId, lessonIndex: currentIndex,
                                            scenarioId: lesson.lessonId, option: opt.optionId, score: opt.score
                                        )
                                    }
                                }) {
                                    HStack {
                                        Spacer(minLength: 32)
                                        Text(opt.text)
                                            .font(.system(size: 14))
                                            .foregroundStyle(selectedOption == opt.optionId ? .white : accent)
                                            .multilineTextAlignment(.trailing)
                                            .lineSpacing(3)
                                            .padding(14)
                                            .background(selectedOption == opt.optionId ? accent : accent.opacity(0.08))
                                            .clipShape(RoundedRectangle(cornerRadius: 16))
                                    }
                                }
                                .buttonStyle(.plain)
                                .disabled(selectedOption != nil)
                                .opacity(selectedOption != nil && selectedOption != opt.optionId ? 0.3 : 1)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: — Quickfire

    private func quickfireView(_ lesson: TrainingLesson) -> some View {
        VStack(spacing: 24) {
            if let title = lesson.title {
                Text(title)
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(textDark)
            }

            if let prompt = lesson.prompt {
                Text(prompt)
                    .font(.system(size: 14))
                    .foregroundStyle(textLight)
            }

            if let items = lesson.items, quickfireIndex < items.count {
                let item = items[quickfireIndex]

                VStack(spacing: 24) {
                    // Counter
                    Text("\(quickfireIndex + 1) of \(items.count)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(textLight)

                    // Situation card
                    Text(item.situation)
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(textDark)
                        .multilineTextAlignment(.center)
                        .lineSpacing(6)
                        .padding(24)
                        .frame(maxWidth: .infinity)
                        .background(cardBg)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(borderClr, lineWidth: 1)
                        )

                    // Answer + feedback
                    if let answer = quickfireAnswer {
                        let correct = answer == item.answer
                        VStack(spacing: 8) {
                            HStack(spacing: 6) {
                                Image(systemName: correct ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundStyle(correct ? green : Color(hex: "#ef4444"))
                                Text(correct ? "Correct" : "Not quite")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(correct ? green : Color(hex: "#ef4444"))
                            }
                            Text(item.reason)
                                .font(.system(size: 13))
                                .foregroundStyle(textGray)
                                .multilineTextAlignment(.center)
                                .lineSpacing(3)
                        }
                        .transition(.opacity)
                    } else {
                        // Stay / Go buttons
                        HStack(spacing: 16) {
                            Button(action: { answerQuickfire("stay") }) {
                                Text("Walk in")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(green)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 48)
                                    .background(green.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(green.opacity(0.3), lineWidth: 1)
                                    )
                            }

                            Button(action: { answerQuickfire("go") }) {
                                Text("Walk past")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Color(hex: "#ef4444"))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 48)
                                    .background(Color(hex: "#ef4444").opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color(hex: "#ef4444").opacity(0.3), lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
                .id(quickfireIndex) // Force view refresh
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .offset(x: 20)),
                    removal: .opacity.combined(with: .offset(x: -20))
                ))
            } else if let items = lesson.items, quickfireIndex >= items.count {
                // All quickfire done
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 32))
                        .foregroundStyle(green)
                    Text("All done!")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(textDark)
                }
            }
        }
    }

    // MARK: — Unit Complete

    private var unitCompleteView: some View {
        VStack(spacing: 0) {
            Spacer()

            Circle()
                .fill(Color(hex: "#ecfdf5"))
                .frame(width: 72, height: 72)
                .overlay(
                    Image(systemName: "checkmark")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundStyle(green)
                )
                .padding(.bottom, 24)

            Text("Unit Complete")
                .font(.system(size: 32, weight: .bold))
                .tracking(-0.5)
                .foregroundStyle(textDark)
                .padding(.bottom, 8)

            if let unit {
                Text(unit.title)
                    .font(.system(size: 17))
                    .foregroundStyle(textGray)
            }

            Spacer()

            Button(action: { dismiss() }) {
                Text("Back to Academy")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(accent)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
    }

    // MARK: — Helpers

    private func canContinue(_ lesson: TrainingLesson) -> Bool {
        switch lesson.type {
        case "editorial": return true
        case "scenario":  return showFeedback
        case "roleplay":  return showFeedback
        case "quickfire":
            if let items = lesson.items { return quickfireIndex >= items.count }
            return true
        default: return true
        }
    }

    private func advance() {
        if currentIndex < lessons.count - 1 {
            resetState()
            withAnimation(.easeInOut(duration: 0.3)) { currentIndex += 1 }
        } else {
            // Complete unit
            Task { try? await APIClient.shared.completeTrainingUnit(id: unitId) }
            withAnimation { isComplete = true }
        }
    }

    private func resetState() {
        selectedOption = nil
        showFeedback = false
        quickfireIndex = 0
        quickfireAnswer = nil
    }

    private func answerQuickfire(_ answer: String) {
        withAnimation(.easeInOut(duration: 0.25)) {
            quickfireAnswer = answer
        }
        // Auto-advance after 1.5s
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if let items = currentLesson?.items, quickfireIndex < items.count - 1 {
                withAnimation(.easeInOut(duration: 0.3)) {
                    quickfireAnswer = nil
                    quickfireIndex += 1
                }
            } else {
                withAnimation { quickfireIndex += 1 } // Triggers "all done"
            }
        }
    }

    private func load() async {
        isLoading = true
        do {
            let detail = try await APIClient.shared.fetchTrainingUnit(id: unitId)
            unit = detail.unit
            lessons = detail.unit.lessons ?? []
            if let prog = detail.progress {
                currentIndex = min(prog.lessonIndex, max(0, lessons.count - 1))
            }
            try? await APIClient.shared.startTrainingUnit(id: unitId)
        } catch {
            // Fallback — show error
        }
        isLoading = false
    }
}

#Preview {
    NavigationStack {
        AcademyLessonView(unitId: "unit-1")
    }
}
