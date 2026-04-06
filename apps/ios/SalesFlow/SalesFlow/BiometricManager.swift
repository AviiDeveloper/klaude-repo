import LocalAuthentication

@MainActor
final class BiometricManager {
    static let shared = BiometricManager()

    private let context = LAContext()

    var canUseBiometrics: Bool {
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometricType: LABiometryType {
        _ = canUseBiometrics // triggers evaluation
        return context.biometryType
    }

    var biometricIcon: String {
        switch biometricType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        case .none: return "lock.fill"
        @unknown default: return "lock.fill"
        }
    }

    var biometricLabel: String {
        switch biometricType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        case .none: return "Biometrics"
        @unknown default: return "Biometrics"
        }
    }

    func authenticate(reason: String) async -> Bool {
        let ctx = LAContext()
        ctx.localizedFallbackTitle = "Use PIN"

        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return false
        }

        do {
            return try await ctx.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
        } catch {
            return false
        }
    }
}
