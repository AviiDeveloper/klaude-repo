import Foundation

actor APIClient {
    static let shared = APIClient()

    #if DEBUG
    private let baseURL = "http://localhost:4350"
    #else
    private let baseURL = "https://api.salesflow.co.uk"
    #endif

    private var token: String? {
        get { KeychainHelper.get("sf_auth_token") }
    }

    // MARK: - Auth

    func login(name: String, pin: String) async throws -> AuthResponse {
        let body = ["name": name, "pin": pin]
        let response: AuthResponse = try await post("/auth/login", body: body)
        KeychainHelper.set(response.token, forKey: "sf_auth_token")
        return response
    }

    func register(name: String, pin: String, area: String, phone: String?) async throws -> AuthResponse {
        var body = ["name": name, "pin": pin, "area_postcode": area]
        if let phone { body["phone"] = phone }
        let response: AuthResponse = try await post("/auth/register", body: body)
        KeychainHelper.set(response.token, forKey: "sf_auth_token")
        return response
    }

    func me() async throws -> User {
        try await get("/auth/me")
    }

    func logout() {
        KeychainHelper.delete("sf_auth_token")
    }

    // MARK: - Leads

    func getLeads(status: String? = nil) async throws -> LeadListResponse {
        var path = "/leads"
        if let status { path += "?status=\(status)" }
        return try await get(path)
    }

    func getLead(id: String) async throws -> Lead {
        try await get("/leads/\(id)")
    }

    func updateStatus(id: String, status: String, lat: Double? = nil, lng: Double? = nil) async throws {
        var body: [String: Any] = ["status": status]
        if let lat { body["lat"] = lat }
        if let lng { body["lng"] = lng }
        let _: EmptyResponse = try await patch("/leads/\(id)/status", body: body)
    }

    func saveIntel(id: String, intel: [String: Any]) async throws {
        let _: EmptyResponse = try await post("/leads/\(id)/intel", body: intel)
    }

    func getBrief(id: String) async throws -> Lead {
        try await get("/leads/\(id)/brief")
    }

    // MARK: - Stats

    func getStats() async throws -> StatsResponse {
        try await get("/leads/stats/summary")
    }

    // MARK: - Visits

    func startVisit(assignmentId: String, lat: Double, lng: Double) async throws -> VisitStartResponse {
        try await post("/visits/start", body: [
            "assignment_id": assignmentId,
            "lat": lat,
            "lng": lng
        ] as [String: Any])
    }

    func endVisit(sessionId: String, lat: Double, lng: Double) async throws -> VisitEndResponse {
        try await post("/visits/end", body: [
            "session_id": sessionId,
            "lat": lat,
            "lng": lng
        ] as [String: Any])
    }

    // MARK: - Push

    func registerPush(token: String) async throws {
        let _: EmptyResponse = try await post("/push/register", body: [
            "expo_token": token,
            "platform": "ios"
        ])
    }

    // MARK: - HTTP helpers

    private func get<T: Decodable>(_ path: String) async throws -> T {
        try await request(path, method: "GET")
    }

    private func post<T: Decodable>(_ path: String, body: Any) async throws -> T {
        try await request(path, method: "POST", body: body)
    }

    private func patch<T: Decodable>(_ path: String, body: Any) async throws -> T {
        try await request(path, method: "PATCH", body: body)
    }

    private func request<T: Decodable>(_ path: String, method: String, body: Any? = nil) async throws -> T {
        var request = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.unknown
        }

        if http.statusCode == 401 {
            KeychainHelper.delete("sf_auth_token")
            throw APIError.unauthorized
        }

        guard (200...299).contains(http.statusCode) else {
            throw APIError.serverError(http.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }
}

struct EmptyResponse: Codable {
    let ok: Bool?
}

struct VisitStartResponse: Codable {
    let sessionId: String
    let startedAt: String

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case startedAt = "started_at"
    }
}

struct VisitEndResponse: Codable {
    let ok: Bool
    let durationSeconds: Int
    let verified: Bool

    enum CodingKeys: String, CodingKey {
        case ok
        case durationSeconds = "duration_seconds"
        case verified
    }
}

enum APIError: Error, LocalizedError {
    case unauthorized
    case serverError(Int)
    case unknown

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Session expired"
        case .serverError(let code): return "Server error (\(code))"
        case .unknown: return "Something went wrong"
        }
    }
}
