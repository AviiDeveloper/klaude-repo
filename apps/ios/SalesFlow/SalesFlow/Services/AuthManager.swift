import Foundation

@MainActor
class AuthManager: ObservableObject {
    @Published var user: User?
    @Published var isAuthenticated = false
    @Published var isLoading = true

    init() {
        Task { await checkAuth() }
    }

    func checkAuth() async {
        guard KeychainHelper.get("sf_auth_token") != nil else {
            isLoading = false
            return
        }
        do {
            user = try await APIClient.shared.me()
            isAuthenticated = true
        } catch {
            isAuthenticated = false
        }
        isLoading = false
    }

    func login(name: String, pin: String) async -> Bool {
        do {
            let response = try await APIClient.shared.login(name: name, pin: pin)
            user = response.user
            isAuthenticated = true
            return true
        } catch {
            return false
        }
    }

    func logout() {
        Task {
            await APIClient.shared.logout()
        }
        user = nil
        isAuthenticated = false
    }
}
