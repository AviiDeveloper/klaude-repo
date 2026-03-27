import Foundation
import SwiftData

// MARK: — Lead (SwiftData persistent model)
@Model
final class Lead {
    @Attribute(.unique) var assignmentId: String   // UUID string from API "id" field
    var leadId: String                              // "lead_id" slug
    var businessName: String
    var businessType: String
    var address: String
    var postcode: String
    var phone: String?
    var googleRating: Double?
    var googleReviewCount: Int?
    var hasDemoSite: Bool
    var demoSiteDomain: String?
    var hasWebsite: Bool
    var status: String            // new | visited | pitched | sold | rejected
    var followUpAt: Date?
    var contactPerson: String?
    var contactRole: String?
    var openingHours: String?     // JSON-encoded [String]
    var services: String?         // JSON-encoded [String]
    var bestReviews: String?      // JSON-encoded [Review]
    var trustBadges: String?      // JSON-encoded [String]
    var avoidTopics: String?      // JSON-encoded [String]
    var lastSyncedAt: Date

    // Offline queue
    var pendingStatusUpdate: String?
    var pendingLat: Double?
    var pendingLng: Double?

    init(
        assignmentId: String,
        leadId: String = "",
        businessName: String,
        businessType: String,
        address: String,
        postcode: String,
        phone: String? = nil,
        googleRating: Double? = nil,
        googleReviewCount: Int? = nil,
        hasDemoSite: Bool = false,
        demoSiteDomain: String? = nil,
        hasWebsite: Bool = false,
        status: String = "new",
        followUpAt: Date? = nil,
        contactPerson: String? = nil,
        contactRole: String? = nil,
        openingHours: String? = nil,
        services: String? = nil,
        bestReviews: String? = nil,
        trustBadges: String? = nil,
        avoidTopics: String? = nil,
        lastSyncedAt: Date = .now
    ) {
        self.assignmentId = assignmentId
        self.leadId = leadId
        self.businessName = businessName
        self.businessType = businessType
        self.address = address
        self.postcode = postcode
        self.phone = phone
        self.googleRating = googleRating
        self.googleReviewCount = googleReviewCount
        self.hasDemoSite = hasDemoSite
        self.demoSiteDomain = demoSiteDomain
        self.hasWebsite = hasWebsite
        self.status = status
        self.followUpAt = followUpAt
        self.contactPerson = contactPerson
        self.contactRole = contactRole
        self.openingHours = openingHours
        self.services = services
        self.bestReviews = bestReviews
        self.trustBadges = trustBadges
        self.avoidTopics = avoidTopics
        self.lastSyncedAt = lastSyncedAt
    }
}

// MARK: — Convenience decoders
extension Lead {
    var servicesArray: [String] {
        decode([String].self, from: services) ?? []
    }
    var trustBadgesArray: [String] {
        decode([String].self, from: trustBadges) ?? []
    }
    var avoidTopicsArray: [String] {
        decode([String].self, from: avoidTopics) ?? []
    }
    var openingHoursArray: [String] {
        decode([String].self, from: openingHours) ?? []
    }
    var bestReviewsArray: [Review] {
        decode([Review].self, from: bestReviews) ?? []
    }

    private func decode<T: Decodable>(_ type: T.Type, from raw: String?) -> T? {
        guard let raw, let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}

// MARK: — API response DTOs

struct LeadsResponse: Decodable {
    let leads: [LeadDTO]
}

struct LeadDTO: Decodable {
    let id: String
    let leadId: String
    let status: String
    let businessName: String
    let businessType: String
    let postcode: String
    let address: String?
    let phone: String?
    let googleRating: Double?
    let googleReviewCount: Int?
    let hasDemoSite: Bool
    let demoSiteDomain: String?
    let hasWebsite: Bool?
    let followUpAt: String?
    let contactPerson: String?
    let contactRole: String?
    let openingHours: [String]?
    let services: [String]?
    let trustBadges: [String]?
    let avoidTopics: [String]?
    let bestReviews: [Review]?

    enum CodingKeys: String, CodingKey {
        case id
        case leadId          = "lead_id"
        case status
        case businessName    = "business_name"
        case businessType    = "business_type"
        case postcode, address, phone
        case googleRating    = "google_rating"
        case googleReviewCount = "google_review_count"
        case hasDemoSite     = "has_demo_site"
        case demoSiteDomain  = "demo_site_domain"
        case hasWebsite      = "has_website"
        case followUpAt      = "follow_up_at"
        case contactPerson   = "contact_person"
        case contactRole     = "contact_role"
        case openingHours    = "opening_hours"
        case services
        case trustBadges     = "trust_badges"
        case avoidTopics     = "avoid_topics"
        case bestReviews     = "best_reviews"
    }

    func toModel() -> Lead {
        let enc = JSONEncoder()
        func encode<T: Encodable>(_ val: T?) -> String? {
            guard let v = val, let d = try? enc.encode(v) else { return nil }
            return String(data: d, encoding: .utf8)
        }
        // Parse ISO8601 follow_up_at string to Date
        var followUpDate: Date?
        if let raw = followUpAt {
            followUpDate = ISO8601DateFormatter().date(from: raw)
        }
        return Lead(
            assignmentId: id,
            leadId: leadId,
            businessName: businessName,
            businessType: businessType,
            address: address ?? "",
            postcode: postcode,
            phone: phone,
            googleRating: googleRating,
            googleReviewCount: googleReviewCount,
            hasDemoSite: hasDemoSite,
            demoSiteDomain: demoSiteDomain,
            hasWebsite: hasWebsite ?? false,
            status: status,
            followUpAt: followUpDate,
            contactPerson: contactPerson,
            contactRole: contactRole,
            openingHours: encode(openingHours),
            services: encode(services),
            bestReviews: encode(bestReviews),
            trustBadges: encode(trustBadges),
            avoidTopics: encode(avoidTopics)
        )
    }
}

// MARK: — Review
struct Review: Codable {
    let author: String
    let rating: Int
    let text: String
}

// MARK: — Stats
struct Stats: Codable {
    let queue: Int
    let visited: Int
    let pitched: Int
    let sold: Int
    let rejected: Int?
    let earned: Double
    let visitsToday: Int?
    let salesToday: Int?
    let visitsThisWeek: Int?
    let salesThisWeek: Int?
    let totalCommission: Double?

    enum CodingKeys: String, CodingKey {
        case queue, visited, pitched, sold, rejected, earned
        case visitsToday     = "visits_today"
        case salesToday      = "sales_today"
        case visitsThisWeek  = "visits_this_week"
        case salesThisWeek   = "sales_this_week"
        case totalCommission = "total_commission"
    }

    static let empty = Stats(queue: 0, visited: 0, pitched: 0, sold: 0, rejected: nil,
                             earned: 0, visitsToday: nil, salesToday: nil,
                             visitsThisWeek: nil, salesThisWeek: nil, totalCommission: nil)
}

// MARK: — Auth
struct User: Codable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let areaPostcode: String?
    let commissionRate: Double?
    let role: String?

    enum CodingKeys: String, CodingKey {
        case id, name, email, phone, role
        case areaPostcode   = "area_postcode"
        case commissionRate = "commission_rate"
    }
}

struct LoginResponse: Codable {
    let token: String
    let user: User?
}

// MARK: — Request bodies
struct StatusUpdateRequest: Encodable {
    let status: String
    let lat: Double?
    let lng: Double?
}

struct VisitRequest: Encodable {
    let action: String
    let lat: Double
    let lng: Double
}

// MARK: — API Error
struct APIError: Codable {
    let error: String
}
