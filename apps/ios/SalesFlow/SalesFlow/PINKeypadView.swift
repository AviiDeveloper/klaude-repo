import SwiftUI

struct PINKeypadView: View {
    let title: String
    let pinLength: Int
    let onComplete: (String) -> Void

    @State private var pin: String = ""
    @State private var shake = false
    @State private var errorMessage: String?

    init(title: String = "Enter PIN", pinLength: Int = 4, onComplete: @escaping (String) -> Void) {
        self.title = title
        self.pinLength = pinLength
        self.onComplete = onComplete
    }

    private let keys: [[String]] = [
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["", "0", "delete"]
    ]

    var body: some View {
        VStack(spacing: 24) {
            // Title
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)

            // PIN dots
            HStack(spacing: 14) {
                ForEach(0..<pinLength, id: \.self) { index in
                    Circle()
                        .fill(index < pin.count ? Theme.accent : Theme.border)
                        .frame(width: 14, height: 14)
                        .scaleEffect(index < pin.count ? 1.1 : 1.0)
                        .animation(.spring(response: 0.2, dampingFraction: 0.6), value: pin.count)
                }
            }
            .offset(x: shake ? -10 : 0)
            .animation(
                shake
                    ? .default.repeatCount(3, autoreverses: true).speed(6)
                    : .default,
                value: shake
            )

            // Error
            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.statusRejected)
                    .transition(.opacity)
            }

            // Keypad grid
            VStack(spacing: 12) {
                ForEach(keys, id: \.self) { row in
                    HStack(spacing: 20) {
                        ForEach(row, id: \.self) { key in
                            if key.isEmpty {
                                Color.clear.frame(width: 72, height: 72)
                            } else if key == "delete" {
                                Button(action: deleteLast) {
                                    Image(systemName: "delete.left")
                                        .font(.system(size: 20))
                                        .foregroundStyle(Theme.textSecondary)
                                        .frame(width: 72, height: 72)
                                }
                            } else {
                                Button(action: { appendDigit(key) }) {
                                    Text(key)
                                        .font(.system(size: 28, weight: .regular))
                                        .foregroundStyle(Theme.textPrimary)
                                        .frame(width: 72, height: 72)
                                        .background(Theme.surface)
                                        .clipShape(Circle())
                                        .overlay(
                                            Circle()
                                                .stroke(Theme.border, lineWidth: Theme.borderWidth)
                                        )
                                }
                                .buttonStyle(KeypadButtonStyle())
                            }
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 24)
    }

    private func appendDigit(_ digit: String) {
        guard pin.count < pinLength else { return }
        pin += digit
        errorMessage = nil

        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()

        if pin.count == pinLength {
            let entered = pin
            // Small delay so the last dot fills visually
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                onComplete(entered)
            }
        }
    }

    private func deleteLast() {
        guard !pin.isEmpty else { return }
        pin.removeLast()
        errorMessage = nil

        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    func triggerShake(message: String? = "Wrong PIN") {
        errorMessage = message
        shake = true
        pin = ""

        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            shake = false
        }
    }
}

// MARK: — Keypad button style
private struct KeypadButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1.0)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

#Preview {
    ZStack {
        Theme.background.ignoresSafeArea()
        PINKeypadView { pin in
            print("PIN entered: \(pin)")
        }
    }
}
