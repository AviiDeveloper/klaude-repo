import Foundation
import SwiftData

// MARK: — DebugSeeder
// Seeds the SwiftData store with realistic test data so the simulator
// shows a populated UI even without the API server running.
// Only runs in DEBUG builds, only seeds if the database is empty.

#if DEBUG
enum DebugSeeder {

    @MainActor
    static func seedIfEmpty(context: ModelContext) {
        let descriptor = FetchDescriptor<Lead>()
        let count = (try? context.fetchCount(descriptor)) ?? 0
        guard count == 0 else { return }

        let leads = [
            Lead(
                assignmentId: "seed-1", businessName: "Barber & Co",
                businessType: "Barber Shop", address: "12 High St", postcode: "E1 6RF",
                phone: "020 7946 0123", googleRating: 4.7, googleReviewCount: 83,
                hasDemoSite: true, demoSiteDomain: "barber-co.salesflow.site",
                status: "new",
                contactPerson: "Marcus", contactRole: "Owner",
                openingHours: "[\"Mon-Fri: 09:00-19:00\",\"Sat: 09:00-17:00\",\"Sun: Closed\"]",
                services: "[\"Haircuts\",\"Beard trims\",\"Hot towel shaves\",\"Hair colouring\"]",
                bestReviews: "[{\"author\":\"Jake R\",\"rating\":5,\"text\":\"Best barber in East London, always leave looking sharp.\"},{\"author\":\"Dan M\",\"rating\":5,\"text\":\"Marcus is a legend. Never going anywhere else.\"}]",
                trustBadges: "[\"5★ Google\",\"Walk-ins welcome\",\"Est. 2015\"]",
                avoidTopics: "[\"Competitor on same street\"]"
            ),
            Lead(
                assignmentId: "seed-2", businessName: "Lotus Thai Kitchen",
                businessType: "Restaurant", address: "88 Old St", postcode: "EC1V 9AN",
                phone: "020 7946 0456", googleRating: 4.9, googleReviewCount: 211,
                hasDemoSite: true, demoSiteDomain: "lotus-thai-kitchen.salesflow.site",
                status: "pitched",
                followUpAt: Calendar.current.date(byAdding: .day, value: 1, to: .now),
                contactPerson: "Noi", contactRole: "Manager",
                openingHours: "[\"Mon-Thu: 12:00-22:00\",\"Fri-Sat: 12:00-23:00\",\"Sun: 13:00-21:00\"]",
                services: "[\"Dine-in\",\"Takeaway\",\"Deliveroo partner\",\"Catering\"]",
                bestReviews: "[{\"author\":\"Sarah L\",\"rating\":5,\"text\":\"Authentic Thai food, amazing Pad Thai!\"},{\"author\":\"Chris W\",\"rating\":5,\"text\":\"Hidden gem. The green curry is unreal.\"}]",
                trustBadges: "[\"4.9★ Google\",\"Deliveroo Preferred\",\"Food hygiene 5/5\"]",
                avoidTopics: "[\"Recent price increase complaints\"]"
            ),
            Lead(
                assignmentId: "seed-3", businessName: "The Rusty Spoon",
                businessType: "Cafe", address: "4 Market Lane", postcode: "EC2A 3AB",
                googleRating: 4.2, googleReviewCount: 44,
                hasDemoSite: false,
                status: "visited",
                contactPerson: "Emma", contactRole: "Co-owner",
                services: "[\"Brunch\",\"Specialty coffee\",\"Cakes & pastries\"]",
                bestReviews: "[{\"author\":\"Mia K\",\"rating\":4,\"text\":\"Cosy spot, great brunch menu.\"}]",
                trustBadges: "[\"4.2★ Google\"]",
                avoidTopics: "[]"
            ),
            Lead(
                assignmentId: "seed-4", businessName: "Pixel Print Shop",
                businessType: "Print & Copy", address: "33 Brick Lane", postcode: "E1 6PU",
                phone: "020 7946 0789", googleRating: 4.5, googleReviewCount: 19,
                hasDemoSite: true, demoSiteDomain: "pixel-print-shop.salesflow.site",
                status: "sold",
                contactPerson: "Raj", contactRole: "Owner",
                services: "[\"Business cards\",\"Flyers & posters\",\"Large format printing\",\"Binding\"]",
                bestReviews: "[{\"author\":\"Amy T\",\"rating\":5,\"text\":\"Fast turnaround, great quality prints.\"}]",
                trustBadges: "[\"4.5★ Google\",\"Same-day service\"]",
                avoidTopics: "[]"
            ),
            Lead(
                assignmentId: "seed-5", businessName: "Crunch Gym",
                businessType: "Fitness Centre", address: "1 City Rd", postcode: "EC1Y 1AG",
                phone: "020 7946 0321", googleRating: 3.9, googleReviewCount: 62,
                hasDemoSite: false,
                status: "new",
                openingHours: "[\"Mon-Fri: 06:00-22:00\",\"Sat-Sun: 08:00-20:00\"]",
                services: "[\"Gym floor\",\"Group classes\",\"Personal training\",\"Sauna\"]",
                bestReviews: "[{\"author\":\"Tom H\",\"rating\":4,\"text\":\"Good equipment, decent price.\"}]",
                trustBadges: "[\"3.9★ Google\",\"No contract\"]",
                avoidTopics: "[\"Equipment complaints in reviews\"]"
            ),
            Lead(
                assignmentId: "seed-6", businessName: "Blooms Florist",
                businessType: "Florist", address: "7 Camden Passage", postcode: "N1 8EA",
                phone: "020 7946 0654", googleRating: 4.8, googleReviewCount: 57,
                hasDemoSite: true, demoSiteDomain: "blooms-florist.salesflow.site",
                status: "new",
                contactPerson: "Lily", contactRole: "Owner",
                services: "[\"Bouquets\",\"Wedding flowers\",\"Funeral arrangements\",\"Subscriptions\"]",
                bestReviews: "[{\"author\":\"Helen P\",\"rating\":5,\"text\":\"Stunning arrangements every time. Lily has real talent.\"},{\"author\":\"James C\",\"rating\":5,\"text\":\"Best florist in Islington, hands down.\"}]",
                trustBadges: "[\"4.8★ Google\",\"Free local delivery\",\"Family run\"]",
                avoidTopics: "[]"
            ),
            Lead(
                assignmentId: "seed-7", businessName: "Nova Nails & Beauty",
                businessType: "Beauty Salon", address: "22 Wardour St", postcode: "W1F 8ZT",
                phone: "020 7946 0987", googleRating: 4.4, googleReviewCount: 96,
                hasDemoSite: true, demoSiteDomain: "nova-nails.salesflow.site",
                status: "visited",
                followUpAt: Calendar.current.date(byAdding: .day, value: 0, to: .now),
                contactPerson: "Kim", contactRole: "Manager",
                openingHours: "[\"Mon-Sat: 10:00-20:00\",\"Sun: 11:00-18:00\"]",
                services: "[\"Gel nails\",\"Manicure & pedicure\",\"Lash extensions\",\"Waxing\"]",
                bestReviews: "[{\"author\":\"Lucy F\",\"rating\":5,\"text\":\"Love my nails! Kim is so talented.\"},{\"author\":\"Priya S\",\"rating\":4,\"text\":\"Great service, a bit pricey but worth it.\"}]",
                trustBadges: "[\"4.4★ Google\",\"Walk-ins welcome\"]",
                avoidTopics: "[\"Staff turnover\"]"
            ),
            Lead(
                assignmentId: "seed-8", businessName: "Ironworks Coffee",
                businessType: "Specialty Coffee Bar", address: "14 Bermondsey St", postcode: "SE1 3TQ",
                googleRating: 4.6, googleReviewCount: 128,
                hasDemoSite: false,
                status: "rejected",
                services: "[\"Pour-over\",\"Espresso\",\"Cold brew\",\"Pastries\"]",
                bestReviews: "[{\"author\":\"Mark D\",\"rating\":5,\"text\":\"Best coffee south of the river.\"}]",
                trustBadges: "[\"4.6★ Google\",\"Specialty Coffee Association\"]",
                avoidTopics: "[\"Already has a website they're happy with\"]"
            ),
        ]

        // Real London coordinates for seeded leads
        let coords: [(Double, Double)] = [
            (51.5155, -0.0722),  // seed-1 Barber & Co, E1 6RF
            (51.5265, -0.0878),  // seed-2 Lotus Thai, EC1V 9AN
            (51.5230, -0.0820),  // seed-3 Rusty Spoon, EC2A 3AB
            (51.5220, -0.0716),  // seed-4 Pixel Print, E1 6PU
            (51.5250, -0.0875),  // seed-5 Crunch Gym, EC1Y 1AG
            (51.5350, -0.1050),  // seed-6 Blooms Florist, N1 8EA
            (51.5130, -0.1340),  // seed-7 Nova Nails, W1F 8ZT
            (51.5010, -0.0830),  // seed-8 Ironworks Coffee, SE1 3TQ
        ]
        for (i, lead) in leads.enumerated() {
            lead.cachedLat = coords[i].0
            lead.cachedLng = coords[i].1
            context.insert(lead)
        }
        try? context.save()
    }

    /// Mock stats matching the seeded leads
    static let mockStats = Stats(
        queue: 3, visited: 2, pitched: 1, sold: 1, rejected: 1,
        earned: 50, visitsToday: 1, salesToday: 0,
        visitsThisWeek: 3, salesThisWeek: 1, totalCommission: 50
    )
}
#endif
