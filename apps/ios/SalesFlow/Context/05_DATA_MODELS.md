# Swift Data Models

These models should be created as Swift structs conforming to `Codable` and `Identifiable`.

## Models

```swift
// MARK: - Auth

struct LoginRequest: Codable {
    let name: String
    let pin: String
}

struct LoginResponse: Codable {
    let user: User
    let token: String
}

struct User: Codable, Identifiable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let area_postcode: String?
    let commission_rate: Double
    let created_at: String
}

// MARK: - Leads

struct LeadsResponse: Codable {
    let leads: [Lead]
}

struct Lead: Codable, Identifiable {
    let id: String               // assignment_id
    let lead_id: String
    let status: LeadStatus
    let business_name: String
    let business_type: String
    let postcode: String
    let address: String?
    let phone: String?
    let google_rating: Double?
    let google_review_count: Int?
    let has_demo_site: Bool
    let demo_site_domain: String?
    let has_website: Bool?
    let follow_up_at: String?
    let contact_person: String?
    let contact_role: String?
    let opening_hours: [String]?
    let services: [String]?
    let trust_badges: [String]?
    let avoid_topics: [String]?
    let best_reviews: [Review]?
}

enum LeadStatus: String, Codable, CaseIterable {
    case new
    case visited
    case pitched
    case sold
    case rejected

    var color: String {  // hex colour
        switch self {
        case .new: return "0070F3"
        case .visited: return "F5A623"
        case .pitched: return "7928CA"
        case .sold: return "00C853"
        case .rejected: return "EE0000"
        }
    }

    var label: String {
        rawValue.capitalized
    }
}

struct Review: Codable {
    let author: String
    let rating: Int
    let text: String
}

// MARK: - Stats

struct Stats: Codable {
    let queue: Int
    let visited: Int
    let pitched: Int
    let sold: Int
    let rejected: Int?
    let earned: Int
    let visits_today: Int?
    let sales_today: Int?
    let visits_this_week: Int?
    let sales_this_week: Int?
    let total_commission: Int?
}

// MARK: - Status Update

struct StatusUpdateRequest: Codable {
    let status: String
    let lat: Double?
    let lng: Double?
}

// MARK: - Visit Session

struct VisitRequest: Codable {
    let action: String  // "start" or "end"
    let lat: Double
    let lng: Double
}

struct VisitResponse: Codable {
    let session_id: String
    let duration_seconds: Int?
    let verified: Bool?
}

// MARK: - Intel (Follow-up data)

struct IntelRequest: Codable {
    let contact_person: String?
    let contact_role: String?
    let interest_level: String?      // "hot", "warm", "cold"
    let objections: [String]?        // ["too_expensive", "need_to_think", ...]
    let competitor_mentioned: String?
    let best_time_to_return: String?  // "morning", "afternoon", "evening"
    let price_discussed: Double?
    let owner_sentiment: String?      // "friendly", "neutral", "hostile"
    let notes: String?
}

// MARK: - Demo Link

struct DemoLinkResponse: Codable {
    let code: String
    let url: String
    let expires_at: String
}

// MARK: - Referral

struct ReferralData: Codable {
    let referral_code: String
    let referral_link: String
    let total_referrals: Int
    let active_referrals: Int
    let total_earned: Double
    let referrals: [Referral]
}

struct Referral: Codable, Identifiable {
    let id: String
    let name: String
    let status: String
    let joined_date: String
    let sales_count: Int
    let earned_from: Double
}
```

## Opening Hours Parsing

The `opening_hours` array contains strings like `"Mon-Fri: 9:00-17:30"`.
To determine if the business is currently open:

```swift
func isOpenNow(hours: [String]) -> (isOpen: Bool, closesAt: String?) {
    let now = Date()
    let calendar = Calendar.current
    let weekday = calendar.component(.weekday, from: now)  // 1=Sun, 2=Mon...
    let currentMinutes = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)

    // Map weekday to day names
    let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    let todayName = dayNames[weekday - 1]

    for entry in hours {
        // Parse "Mon-Fri: 9:00-17:30" or "Sat: 9:00-16:00" or "Sun: Closed"
        let parts = entry.split(separator: ":")
        guard parts.count >= 2 else { continue }

        let dayPart = String(parts[0]).trimmingCharacters(in: .whitespaces)
        let timePart = parts.dropFirst().joined(separator: ":").trimmingCharacters(in: .whitespaces)

        if timePart.lowercased() == "closed" {
            if dayPart.contains(todayName) { return (false, nil) }
            continue
        }

        // Check if today matches this entry
        // ... (implement day range matching + time parsing)
    }

    return (false, nil)  // Default to closed if can't parse
}
```
