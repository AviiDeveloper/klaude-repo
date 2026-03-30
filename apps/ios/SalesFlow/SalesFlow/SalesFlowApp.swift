import SwiftUI
import SwiftData

@main
struct SalesFlowApp: App {
    @StateObject private var authStore = AuthStore.shared
    @StateObject private var appearanceStore = AppearanceStore.shared

    var sharedModelContainer: ModelContainer = {
        let schema = Schema([Lead.self])
        do {
            return try ModelContainer(for: schema)
        } catch {
            let storeURL = URL.applicationSupportDirectory.appending(path: "default.store")
            try? FileManager.default.removeItem(at: storeURL)
            do {
                return try ModelContainer(for: schema)
            } catch {
                fatalError("Could not create ModelContainer after reset: \(error)")
            }
        }
    }()

    var body: some Scene {
        WindowGroup {
            Group {
                if !authStore.hasCompletedOnboarding && !authStore.isAuthenticated {
                    OnboardingView()
                } else if !authStore.isAuthenticated {
                    LoginView()
                } else {
                    NavigationStack {
                        ModeSelectView()
                    }
                    .preferredColorScheme(appearanceStore.colorScheme)
                }
            }
            .environmentObject(authStore)
            .environmentObject(appearanceStore)
            .onAppear { seedDemoDataIfNeeded() }
        }
        .modelContainer(sharedModelContainer)
    }

    // MARK: — Demo seed (runs once on fresh install)

    private func seedDemoDataIfNeeded() {
        let key = "demo_seeded_v3"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)

        let ctx = sharedModelContainer.mainContext

        let leads: [Lead] = [
            Lead(
                assignmentId: "demo-001",
                leadId: "barber-co-e1",
                businessName: "Barber & Co",
                businessType: "Barber Shop",
                address: "12 High Street",
                postcode: "E1 6RF",
                phone: "020 7123 4567",
                googleRating: 4.7,
                googleReviewCount: 83,
                hasDemoSite: true,
                demoSiteDomain: "barber-co.salesflow.site",
                status: "new",
                contactPerson: "Marcus",
                contactRole: "Owner",
                openingHours: "[\"Mon–Sat: 09:00–19:00\",\"Sun: 10:00–16:00\"]",
                services: "[\"Men's cuts\",\"Fades & tapers\",\"Beard trims\",\"Hot towel shave\",\"Kids cuts\"]",
                bestReviews: "[{\"author\":\"James R\",\"rating\":5,\"text\":\"Best barber in the East End — Marcus knows exactly what he's doing.\"},{\"author\":\"Theo W\",\"rating\":5,\"text\":\"Been coming here for 3 years. Consistent, quick, and genuinely great value.\"}]",
                trustBadges: "[\"5★ Google · 83 reviews\",\"Family run since 2014\",\"Walk-ins welcome\"]",
                avoidTopics: "[\"Previous web agency\"]"
            ),
            Lead(
                assignmentId: "demo-002",
                leadId: "rusty-spoon-ec2",
                businessName: "The Rusty Spoon",
                businessType: "Café",
                address: "4 Market Lane",
                postcode: "EC2A 3AB",
                phone: nil,
                googleRating: 4.2,
                googleReviewCount: 44,
                hasDemoSite: false,
                demoSiteDomain: nil,
                status: "visited",
                contactPerson: "Priya",
                contactRole: "Manager",
                openingHours: "[\"Mon–Fri: 07:30–16:00\",\"Sat: 09:00–14:00\",\"Sun: Closed\"]",
                services: "[\"Breakfast & brunch\",\"Specialty coffee\",\"Homemade cakes\",\"Catering trays\",\"Loyalty card\"]",
                bestReviews: "[{\"author\":\"Hannah B\",\"rating\":5,\"text\":\"The flat white is genuinely the best I've had outside of Melbourne.\"},{\"author\":\"Ollie T\",\"rating\":4,\"text\":\"Lovely little spot, gets busy at lunch but worth the wait.\"}]",
                trustBadges: "[\"Independent since 2019\",\"Sourced locally\",\"Featured in TimeOut London\"]",
                avoidTopics: "[\"Online ordering platforms\",\"Previous negative review\"]"
            ),
            Lead(
                assignmentId: "demo-003",
                leadId: "lotus-thai-ec1",
                businessName: "Lotus Thai Kitchen",
                businessType: "Restaurant",
                address: "88 Old Street",
                postcode: "EC1V 9AN",
                phone: "020 7456 7890",
                googleRating: 4.9,
                googleReviewCount: 211,
                hasDemoSite: true,
                demoSiteDomain: "lotus-thai.salesflow.site",
                status: "pitched",
                followUpAt: Calendar.current.date(byAdding: .day, value: 3, to: .now),
                contactPerson: "Mai",
                contactRole: "Owner",
                openingHours: "[\"Tue–Fri: 12:00–15:00, 17:30–22:30\",\"Sat–Sun: 12:00–23:00\",\"Mon: Closed\"]",
                services: "[\"Authentic Thai cuisine\",\"Set lunch menu\",\"Private dining room\",\"Takeaway & delivery\",\"Vegan options\"]",
                bestReviews: "[{\"author\":\"Sophie L\",\"rating\":5,\"text\":\"The pad thai here ruined every other version for me. Outstanding.\"},{\"author\":\"Dan F\",\"rating\":5,\"text\":\"Mai runs an incredible place — warm atmosphere, exceptional food.\"}]",
                trustBadges: "[\"4.9★ · 211 reviews\",\"Michelin recommended\",\"Open 6 years\"]",
                avoidTopics: "[\"Deliveroo commission rates\",\"Previous website developer\"]"
            ),
            Lead(
                assignmentId: "demo-004",
                leadId: "pixel-print-e1",
                businessName: "Pixel Print Shop",
                businessType: "Print & Copy",
                address: "33 Brick Lane",
                postcode: "E1 6PU",
                phone: "020 7345 6789",
                googleRating: 4.5,
                googleReviewCount: 19,
                hasDemoSite: true,
                demoSiteDomain: "pixel-print.salesflow.site",
                status: "sold",
                contactPerson: "Dev",
                contactRole: "Director",
                openingHours: "[\"Mon–Fri: 08:00–18:30\",\"Sat: 09:00–15:00\",\"Sun: Closed\"]",
                services: "[\"Digital & offset printing\",\"Business cards & stationery\",\"Banners & signage\",\"Same-day service\",\"Design support\"]",
                bestReviews: "[{\"author\":\"Clare M\",\"rating\":5,\"text\":\"Saved our product launch — same-day turnaround on 500 flyers. Brilliant.\"},{\"author\":\"Raj P\",\"rating\":4,\"text\":\"Good quality, competitive pricing, Dev is very helpful.\"}]",
                trustBadges: "[\"Same-day printing available\",\"Trade accounts welcome\",\"ISO certified\"]",
                avoidTopics: "[]"
            ),
            Lead(
                assignmentId: "demo-005",
                leadId: "crunch-gym-ec1",
                businessName: "Crunch Gym",
                businessType: "Fitness Centre",
                address: "1 City Road",
                postcode: "EC1Y 1AG",
                phone: nil,
                googleRating: 3.9,
                googleReviewCount: 62,
                hasDemoSite: false,
                demoSiteDomain: nil,
                status: "new",
                openingHours: "[\"Mon–Fri: 06:00–22:00\",\"Sat–Sun: 08:00–20:00\"]",
                services: "[\"Gym floor & free weights\",\"Group classes\",\"Personal training\",\"Sauna\",\"Nutrition advice\"]",
                bestReviews: "[{\"author\":\"Mike O\",\"rating\":4,\"text\":\"Great equipment, never too crowded in the mornings.\"},{\"author\":\"Lena S\",\"rating\":4,\"text\":\"The HIIT classes are intense but worth it.\"}]",
                trustBadges: "[\"No contract membership\",\"Open 7 days\"]",
                avoidTopics: "[\"Recent equipment complaints\"]"
            ),
            Lead(
                assignmentId: "demo-006",
                leadId: "blooms-florist-n1",
                businessName: "Blooms Florist",
                businessType: "Florist",
                address: "7 Camden Passage",
                postcode: "N1 8EA",
                phone: "020 7288 3312",
                googleRating: 4.8,
                googleReviewCount: 57,
                hasDemoSite: true,
                demoSiteDomain: "blooms-florist.salesflow.site",
                status: "new",
                contactPerson: "Claire",
                contactRole: "Owner",
                openingHours: "[\"Mon–Sat: 08:00–18:00\",\"Sun: 09:00–14:00\"]",
                services: "[\"Fresh bouquets & arrangements\",\"Wedding floristry\",\"Corporate accounts\",\"Same-day delivery\",\"Dried flower range\"]",
                bestReviews: "[{\"author\":\"Anna K\",\"rating\":5,\"text\":\"Claire created the most beautiful arrangements for our wedding. Magical.\"},{\"author\":\"Peter G\",\"rating\":5,\"text\":\"I order from here every week — quality never drops.\"}]",
                trustBadges: "[\"RHS award winner 2023\",\"Family business · 12 years\",\"Free local delivery\"]",
                avoidTopics: "[]"
            ),
            Lead(
                assignmentId: "demo-007",
                leadId: "ironworks-se1",
                businessName: "Ironworks Coffee",
                businessType: "Specialty Coffee Bar",
                address: "14 Bermondsey Street",
                postcode: "SE1 3TQ",
                phone: "020 7407 1234",
                googleRating: 4.6,
                googleReviewCount: 128,
                hasDemoSite: false,
                demoSiteDomain: nil,
                status: "rejected",
                contactPerson: "Tom",
                contactRole: "Co-founder",
                openingHours: "[\"Mon–Fri: 07:00–17:00\",\"Sat: 08:00–16:00\",\"Sun: Closed\"]",
                services: "[\"Specialty espresso\",\"Single origin filter\",\"Cold brew\",\"Pastries from Beigel Bake\",\"Beans retail\"]",
                bestReviews: "[{\"author\":\"Fiona H\",\"rating\":5,\"text\":\"The gesha filter is worth every penny. Proper coffee people.\"},{\"author\":\"Alistair D\",\"rating\":5,\"text\":\"Comes all the way from Shoreditch just for this place. Says it all.\"}]",
                trustBadges: "[\"SCA certified baristas\",\"Direct trade beans\",\"Featured in Guardian Food\"]",
                avoidTopics: "[\"Instagram marketing\",\"Previous brand agency\"]"
            ),
            Lead(
                assignmentId: "demo-008",
                leadId: "nova-nails-w1",
                businessName: "Nova Nails & Beauty",
                businessType: "Beauty Salon",
                address: "22 Wardour Street",
                postcode: "W1F 8ZT",
                phone: "020 7439 5678",
                googleRating: 4.4,
                googleReviewCount: 96,
                hasDemoSite: true,
                demoSiteDomain: "nova-nails.salesflow.site",
                status: "visited",
                followUpAt: Calendar.current.date(byAdding: .day, value: 1, to: .now),
                contactPerson: "Nina",
                contactRole: "Owner",
                openingHours: "[\"Mon–Sat: 10:00–20:00\",\"Sun: 11:00–18:00\"]",
                services: "[\"Gel & acrylic nails\",\"Nail art\",\"Lash extensions\",\"Brow threading & tinting\",\"Facials\"]",
                bestReviews: "[{\"author\":\"Becky R\",\"rating\":5,\"text\":\"Nina is an artist — my nails always get compliments.\"},{\"author\":\"Zara M\",\"rating\":5,\"text\":\"Cleanest salon I've been to. Incredibly welcoming.\"}]",
                trustBadges: "[\"4.4★ · 96 reviews\",\"Award-winning nail art\",\"Vegan products only\"]",
                avoidTopics: "[\"Competitor salon on Carnaby Street\"]"
            ),
            Lead(
                assignmentId: "demo-009",
                leadId: "archway-auto-n19",
                businessName: "Archway Autos",
                businessType: "Car Garage",
                address: "54 Junction Road",
                postcode: "N19 5QX",
                phone: "020 7272 8800",
                googleRating: 4.3,
                googleReviewCount: 34,
                hasDemoSite: false,
                demoSiteDomain: nil,
                status: "new",
                contactPerson: "Yusuf",
                contactRole: "Owner & Lead Mechanic",
                openingHours: "[\"Mon–Fri: 08:00–18:00\",\"Sat: 09:00–13:00\",\"Sun: Closed\"]",
                services: "[\"MOT testing\",\"Full & interim service\",\"Brake & tyre fitting\",\"Air conditioning regas\",\"Diagnostics\"]",
                bestReviews: "[{\"author\":\"Ray M\",\"rating\":5,\"text\":\"Yusuf is honest and charges fair prices. Rare for a garage.\"},{\"author\":\"Kate S\",\"rating\":4,\"text\":\"Fixed an issue three other garages missed. Won't go anywhere else.\"}]",
                trustBadges: "[\"DVSA approved MOT station\",\"25 years experience\",\"Free collection & drop-off\"]",
                avoidTopics: "[\"Negative review about wait times\"]"
            ),
            Lead(
                assignmentId: "demo-010",
                leadId: "golden-dragon-e2",
                businessName: "Golden Dragon",
                businessType: "Chinese Restaurant",
                address: "89 Bethnal Green Road",
                postcode: "E2 6HT",
                phone: "020 7739 4455",
                googleRating: 4.1,
                googleReviewCount: 178,
                hasDemoSite: true,
                demoSiteDomain: "golden-dragon.salesflow.site",
                status: "new",
                contactPerson: "David Chen",
                contactRole: "Owner",
                openingHours: "[\"Mon–Thu: 12:00–22:30\",\"Fri–Sat: 12:00–23:30\",\"Sun: 12:00–22:00\"]",
                services: "[\"Dim sum lunch\",\"À la carte dinner\",\"Set banquet menus\",\"Private hire\",\"Takeaway\"]",
                bestReviews: "[{\"author\":\"Linda T\",\"rating\":5,\"text\":\"The roast duck is the real deal — I've been coming for 15 years.\"},{\"author\":\"Marcus H\",\"rating\":4,\"text\":\"Huge portions, great value, always busy for a reason.\"}]",
                trustBadges: "[\"Est. 1987\",\"4.1★ · 178 reviews\",\"Private dining for up to 40\"]",
                avoidTopics: "[\"Hygiene rating history\"]"
            ),
        ]

        for lead in leads {
            ctx.insert(lead)
        }
        try? ctx.save()
    }
}
