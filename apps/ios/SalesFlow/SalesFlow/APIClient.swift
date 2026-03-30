import Foundation

// MARK: — APIClient
final class APIClient {
    static let shared = APIClient()

    private let baseURL: String = "http://localhost:4350"

    var token: String?

    private var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    private func request(
        path: String,
        method: String = "GET",
        body: (any Encodable)? = nil
    ) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let tok = token {
            req.setValue("Bearer \(tok)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        if !(200..<300).contains(http.statusCode) {
            let msg = (try? decoder.decode(APIError.self, from: data))?.error ?? "HTTP \(http.statusCode)"
            throw SalesFlowError.server(msg)
        }
        return data
    }

    // MARK: — Auth
    func login(name: String, pin: String) async throws -> LoginResponse {
        struct Body: Encodable { let name: String; let pin: String }
        let data = try await request(path: "/auth/login", method: "POST", body: Body(name: name, pin: pin))
        return try decoder.decode(LoginResponse.self, from: data)
    }

    func signup(name: String, pin: String, phone: String, area: String) async throws -> LoginResponse {
        struct Body: Encodable { let name: String; let pin: String; let phone: String; let area_postcode: String }
        let data = try await request(path: "/auth/register", method: "POST", body: Body(name: name, pin: pin, phone: phone, area_postcode: area))
        return try decoder.decode(LoginResponse.self, from: data)
    }

    // MARK: — Leads
    func fetchLeads() async throws -> [LeadDTO] {
        let data = try await request(path: "/leads")
        return try decoder.decode(LeadsResponse.self, from: data).leads
    }

    func fetchLead(id: String) async throws -> LeadDTO {
        let data = try await request(path: "/leads/\(id)")
        return try decoder.decode(LeadDTO.self, from: data)
    }

    func updateLeadStatus(id: String, status: String, lat: Double? = nil, lng: Double? = nil) async throws {
        let body = StatusUpdateRequest(status: status, lat: lat, lng: lng)
        _ = try await request(path: "/leads/\(id)/status", method: "PATCH", body: body)
    }

    func postVisit(id: String, action: String, lat: Double, lng: Double) async throws {
        let body = VisitRequest(action: action, lat: lat, lng: lng)
        _ = try await request(path: "/leads/\(id)/visit", method: "POST", body: body)
    }

    func uploadPhoto(leadId: String, imageData: Data, category: String, lat: Double?, lng: Double?) async throws {
        guard let url = URL(string: baseURL + "/leads/\(leadId)/photos") else { throw URLError(.badURL) }
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let tok = token { req.setValue("Bearer \(tok)", forHTTPHeaderField: "Authorization") }

        var body = Data()
        func append(_ string: String) { body.append(Data(string.utf8)) }
        // category field
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"category\"\r\n\r\n")
        append("\(category)\r\n")
        // photo field
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n")
        append("Content-Type: image/jpeg\r\n\r\n")
        body.append(imageData)
        append("\r\n--\(boundary)--\r\n")
        req.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SalesFlowError.server("Photo upload failed")
        }
    }

    // MARK: — Stats
    func fetchStats() async throws -> Stats {
        let data = try await request(path: "/stats")
        return try decoder.decode(Stats.self, from: data)
    }
}

// MARK: — Error type
enum SalesFlowError: LocalizedError {
    case server(String)
    case offline

    var errorDescription: String? {
        switch self {
        case .server(let msg): return msg
        case .offline: return "You are offline. Changes will sync when you reconnect."
        }
    }
}
