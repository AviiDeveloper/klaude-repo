import Foundation
import Combine
import Security

// MARK: — AuthStore  (Observable singleton)
final class AuthStore: ObservableObject {
    static let shared = AuthStore()

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?

    private let tokenKey = "salesflow_auth_token"
    private let userKey  = "salesflow_user"

    // Keychain-backed token property
    var token: String? {
        get { KeychainHelper.read(key: tokenKey) }
        set {
            if let value = newValue {
                KeychainHelper.save(key: tokenKey, value: value)
            } else {
                KeychainHelper.delete(key: tokenKey)
            }
        }
    }

    private init() {
        // Restore session if token exists
        if let savedToken = token {
            APIClient.shared.token = savedToken
            isAuthenticated = true
            // Restore user from UserDefaults
            if let data = UserDefaults.standard.data(forKey: userKey),
               let user = try? JSONDecoder().decode(User.self, from: data) {
                currentUser = user
            }
        }
    }

    @MainActor
    func signIn(name: String, pin: String) async throws {
        let response = try await APIClient.shared.login(name: name, pin: pin)
        token = response.token
        APIClient.shared.token = response.token
        currentUser = response.user
        // Persist user for offline restore
        if let user = response.user, let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
        isAuthenticated = true
    }

    @MainActor
    func signOut() {
        token = nil
        APIClient.shared.token = nil
        currentUser = nil
        UserDefaults.standard.removeObject(forKey: userKey)
        isAuthenticated = false
    }
}

// MARK: — KeychainHelper
private enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String:   data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String:  true,
            kSecMatchLimit as String:  kSecMatchLimitOne
        ]
        var result: AnyObject?
        SecItemCopyMatching(query as CFDictionary, &result)
        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String:       kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
