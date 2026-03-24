import Foundation

struct Lead: Codable, Identifiable {
    let id: String
    let leadId: String?
    let businessName: String
    let businessType: String
    let postcode: String
    let address: String?
    let phone: String
    let googleRating: Double
    let googleReviewCount: Int
    let status: LeadStatus
    let hasDemoSite: Bool
    let demoSiteDomain: String?
    let openingHours: [String]
    let services: [String]
    let trustBadges: [String]?
    let avoidTopics: [String]?
    let bestReviews: [Review]?
    let contactName: String?
    let contactRole: String?
    let followUpAt: String?
    let followUpNote: String?

    enum CodingKeys: String, CodingKey {
        case id, status, phone, address, services, postcode
        case leadId = "lead_id"
        case businessName = "business_name"
        case businessType = "business_type"
        case googleRating = "google_rating"
        case googleReviewCount = "google_review_count"
        case hasDemoSite = "has_demo_site"
        case demoSiteDomain = "demo_site_domain"
        case openingHours = "opening_hours"
        case trustBadges = "trust_badges"
        case avoidTopics = "avoid_topics"
        case bestReviews = "best_reviews"
        case contactName = "contact_name"
        case contactRole = "contact_role"
        case followUpAt = "follow_up_at"
        case followUpNote = "follow_up_note"
    }
}

enum LeadStatus: String, Codable {
    case new, visited, pitched, sold, rejected
}

struct Review: Codable {
    let author: String
    let rating: Int
    let text: String
}

struct LeadListResponse: Codable {
    let leads: [Lead]
    let count: Int
}

struct StatsResponse: Codable {
    let total: Int
    let queue: Int
    let visited: Int
    let pitched: Int
    let sold: Int
    let rejected: Int
    let earned: Double
}

struct User: Codable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let areaPostcode: String?
    let commissionRate: Double
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, email, phone
        case areaPostcode = "area_postcode"
        case commissionRate = "commission_rate"
        case createdAt = "created_at"
    }
}

struct AuthResponse: Codable {
    let user: User
    let token: String
}
