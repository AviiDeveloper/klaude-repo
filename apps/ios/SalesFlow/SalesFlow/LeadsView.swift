import SwiftUI
import SwiftData

// MARK: — LeadsView

struct LeadsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var leads: [Lead]

    @State private var stats: Stats = .seeded
    @State private var selectedFilter: String = "all"
    @State private var isRefreshing = false
    @State private var isOffline = false
    @State private var appeared = false
    @State private var searchText = ""
    @State private var showSearch = false

    private let filters = ["all", "new", "visited", "pitched", "rejected"]
    private let pageBg = Color(hex: "#F8F7F5")

    private var filteredLeads: [Lead] {
        var result = leads.filter { $0.status.lowercased() != "sold" }
        if selectedFilter != "all" {
            result = result.filter { $0.status.lowercased() == selectedFilter }
        }
        if !searchText.isEmpty {
            let query = searchText.lowercased()
            result = result.filter {
                $0.businessName.lowercased().contains(query) ||
                $0.businessType.lowercased().contains(query) ||
                $0.postcode.lowercased().contains(query)
            }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            ZStack {
                pageBg.ignoresSafeArea()

                VStack(spacing: 0) {
                    statsHeader
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : -8)
                        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: appeared)

                    filterBar
                        .opacity(appeared ? 1 : 0)
                        .animation(.spring(response: 0.45, dampingFraction: 0.85).delay(0.05), value: appeared)

                    if showSearch {
                        searchBar
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    if filteredLeads.isEmpty && !isRefreshing {
                        EmptyLeadsView(filter: selectedFilter, isOffline: isOffline, hasSearch: !searchText.isEmpty)
                            .transition(.opacity.combined(with: .scale(scale: 0.97)))
                    } else {
                        leadsList
                    }
                }
            }
            .navigationTitle("Leads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        if isOffline {
                            Label("Offline", systemImage: "wifi.slash")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Color(hex: "#6B7280"))
                                .labelStyle(.titleAndIcon)
                                .transition(.opacity)
                        }
                        Button {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                                showSearch.toggle()
                                if !showSearch { searchText = "" }
                            }
                        } label: {
                            Image(systemName: showSearch ? "xmark.circle.fill" : "magnifyingglass")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundStyle(showSearch ? Color(hex: "#0071E3") : Color(hex: "#6B7280"))
                                .contentTransition(.symbolEffect(.replace))
                        }
                    }
                }
            }
        }
        .task { await loadData() }
        .onAppear {
            withAnimation { appeared = true }
        }
    }

    // MARK: — Stats header

    private var statsHeader: some View {
        HStack(alignment: .bottom, spacing: 0) {
            // Hero: Earned
            VStack(alignment: .leading, spacing: 2) {
                Text("£\(Int(stats.earned))")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(hex: "#16A34A"))
                    .contentTransition(.numericText())
                    .animation(.spring(response: 0.4), value: stats.earned)
                Text("EARNED")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Color(hex: "#6B7280"))
                    .tracking(0.8)
            }

            Spacer()

            // Secondary stats — more breathing room
            HStack(spacing: 24) {
                SecondaryStatCell(value: "\(stats.queue)", label: "Queue")
                SecondaryStatCell(value: "\(stats.visited)", label: "Visited")
                SecondaryStatCell(value: "\(stats.pitched)", label: "Pitched")
                SecondaryStatCell(value: "\(stats.sold)", label: "Sold")
            }
        }
        .padding(12)
        .background(Color(hex: "#F0FDF4"))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 4)
    }

    // MARK: — Filter bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(filters, id: \.self) { filter in
                    let count = filter == "all"
                        ? leads.filter { $0.status.lowercased() != "sold" }.count
                        : leads.filter { $0.status.lowercased() == filter }.count
                    FilterTab(
                        label: filter == "all" ? "All" : Theme.statusLabel(for: filter),
                        count: count,
                        isSelected: selectedFilter == filter
                    ) {
                        withAnimation(.spring(response: 0.28, dampingFraction: 0.72)) {
                            selectedFilter = filter
                            appeared = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.82)) {
                                appeared = true
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    // MARK: — Search bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "#9CA3AF"))
            TextField("Search by name, type, or postcode", text: $searchText)
                .font(.system(size: 15))
                .foregroundStyle(Color(hex: "#111111"))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !searchText.isEmpty {
                Button {
                    withAnimation { searchText = "" }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: "#9CA3AF"))
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(hex: "#E5E7EB"), lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: — Leads list

    private var leadsList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(Array(filteredLeads.enumerated()), id: \.element.id) { index, lead in
                    NavigationLink(destination: LeadDetailView(lead: lead)) {
                        LeadCard(lead: lead)
                    }
                    .buttonStyle(CardPressStyle())
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 12)
                    .animation(
                        .spring(response: 0.42, dampingFraction: 0.82)
                            .delay(Double(index) * 0.04),
                        value: appeared
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 24)
        }
        .background(pageBg)
        .refreshable { await loadData() }
    }

    // MARK: — Data

    @MainActor
    private func loadData() async {
        isRefreshing = true
        defer { isRefreshing = false }
        async let statsResult: Stats = APIClient.shared.fetchStats()
        async let leadsResult: [LeadDTO] = APIClient.shared.fetchLeads()
        do {
            let (fetchedStats, fetchedLeads) = try await (statsResult, leadsResult)
            stats = fetchedStats
            isOffline = false
            upsertLeads(fetchedLeads)
            Task.detached(priority: .background) {
                for dto in fetchedLeads {
                    if let domain = dto.demoSiteDomain, dto.hasDemoSite {
                        await DemoSiteCache.shared.cache(domain: domain)
                    }
                }
            }
        } catch {
            isOffline = true
        }
    }

    private func upsertLeads(_ dtos: [LeadDTO]) {
        for dto in dtos {
            let id = dto.id
            let fetchDescriptor = FetchDescriptor<Lead>(
                predicate: #Predicate { $0.assignmentId == id }
            )
            if let existing = try? modelContext.fetch(fetchDescriptor).first {
                if existing.pendingStatusUpdate == nil { existing.status = dto.status }
                existing.contactPerson = dto.contactPerson
                existing.contactRole = dto.contactRole
                existing.lastSyncedAt = Date.now
            } else {
                modelContext.insert(dto.toModel())
            }
        }
        try? modelContext.save()
    }
}

// MARK: — Secondary stat cell

private struct SecondaryStatCell: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .semibold, design: .monospaced))
                .foregroundStyle(Color(hex: "#111111"))
                .contentTransition(.numericText())
                .animation(.spring(response: 0.4), value: value)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Color(hex: "#9CA3AF"))
                .textCase(.uppercase)
                .tracking(0.4)
        }
    }
}

// MARK: — Filter tab

private struct FilterTab: View {
    let label: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Text(label)
                    .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(isSelected ? .white.opacity(0.8) : Color(hex: "#9CA3AF"))
                }
            }
            .foregroundStyle(isSelected ? .white : Color(hex: "#6B7280"))
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isSelected ? Color(hex: "#0A0A0A") : .clear)
            .clipShape(Capsule())
            .animation(.spring(response: 0.22, dampingFraction: 0.7), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}

// MARK: — Lead card

struct LeadCard: View {
    let lead: Lead

    private var isRejected: Bool { lead.status.lowercased() == "rejected" }
    private var catColor: Color { categoryColor(for: lead.businessType) }

    var body: some View {
        HStack(spacing: 0) {
            // ── Bold category stripe (14px) ──────────────────────
            UnevenRoundedRectangle(
                topLeadingRadius: 8,
                bottomLeadingRadius: 8,
                bottomTrailingRadius: 0,
                topTrailingRadius: 0
            )
            .fill(isRejected ? Color(hex: "#D1D5DB") : catColor)
            .frame(width: 14)

            // ── Content ──────────────────────────────────────────
            VStack(alignment: .leading, spacing: 4) {
                // Row 1: Name + status
                HStack(alignment: .center) {
                    Text(lead.businessName)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(isRejected ? Color(hex: "#9CA3AF") : Color(hex: "#0A0A0A"))
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    statusIndicator
                }

                // Row 2: Category · Postcode · Demo · Follow-up
                HStack(spacing: 0) {
                    Text(lead.businessType.uppercased())
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color(hex: "#9CA3AF"))
                        .tracking(0.8)

                    Text(" \u{00B7} ")
                        .font(.system(size: 11))
                        .foregroundStyle(Color(hex: "#D1D5DB"))

                    Text(lead.postcode)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color(hex: "#9CA3AF"))

                    if lead.hasDemoSite {
                        Text(" \u{00B7} ")
                            .font(.system(size: 11))
                            .foregroundStyle(Color(hex: "#D1D5DB"))

                        Text("Demo")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color(hex: "#374151"))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Color(hex: "#E5E7EB"), lineWidth: 1)
                            )
                    }

                    if let followUp = lead.followUpAt, followUp > .now {
                        Text(" \u{00B7} ")
                            .font(.system(size: 11))
                            .foregroundStyle(Color(hex: "#D1D5DB"))
                        Circle()
                            .fill(Color(hex: "#F59E0B"))
                            .frame(width: 5, height: 5)
                            .padding(.trailing, 3)
                        Text(followUpLabel(followUp))
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color(hex: "#92400E"))
                    }

                    Spacer()
                }
            }
            .padding(.leading, 12)
            .padding(.trailing, 14)
            .padding(.vertical, 12)
        }
        .background(isRejected ? Color(hex: "#F9F9F9") : .white)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .contentShape(Rectangle())
    }

    // ── Status indicator ────────────────────────────────────
    @ViewBuilder
    private var statusIndicator: some View {
        switch lead.status.lowercased() {
        case "new":
            HStack(spacing: 4) {
                Circle()
                    .fill(Color(hex: "#16A34A"))
                    .frame(width: 6, height: 6)
                Text("NEW")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color(hex: "#16A34A"))
            }
        case "visited":
            Text("VISITED")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color(hex: "#D97706"))
                .clipShape(Capsule())
        case "pitched":
            Text("PITCHED")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color(hex: "#1D4ED8"))
                .clipShape(Capsule())
        case "rejected":
            EmptyView()
        default:
            EmptyView()
        }
    }

    private func followUpLabel(_ date: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "Tomorrow" }
        return "in \(days)d"
    }
}

// MARK: — Card press style

private struct CardPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.8), value: configuration.isPressed)
    }
}

// MARK: — Category colour mapping

private func categoryColor(for type: String) -> Color {
    let t = type.lowercased()
    if t.contains("restaurant") || t.contains("kitchen") || t.contains("takeaway") || t.contains("food") || t.contains("chinese") || t.contains("thai") || t.contains("indian") { return Color(hex: "#FF6B35") }
    if t.contains("beauty") || t.contains("nail") || t.contains("hair") || t.contains("salon") || t.contains("barber") { return Color(hex: "#C084FC") }
    if t.contains("auto") || t.contains("garage") || t.contains("car") || t.contains("motor") { return Color(hex: "#3B82F6") }
    if t.contains("gym") || t.contains("fitness") || t.contains("sport") { return Color(hex: "#10B981") }
    if t.contains("florist") || t.contains("flower") || t.contains("retail") || t.contains("shop") || t.contains("print") { return Color(hex: "#F59E0B") }
    if t.contains("coffee") || t.contains("cafe") || t.contains("café") { return Color(hex: "#6B4F3A") }
    return Color(hex: "#6B7280")
}

// MARK: — Empty state

private struct EmptyLeadsView: View {
    let filter: String
    let isOffline: Bool
    var hasSearch: Bool = false

    private var icon: String {
        if hasSearch { return "magnifyingglass" }
        if isOffline { return "wifi.slash" }
        return "tray"
    }

    private var title: String {
        if hasSearch { return "No results" }
        if isOffline { return "Can't reach server" }
        if filter == "all" { return "No leads assigned" }
        return "No \(Theme.statusLabel(for: filter).lowercased()) leads"
    }

    private var subtitle: String {
        if hasSearch { return "Try a different search term" }
        if isOffline { return "Showing cached data. Pull to retry." }
        return "Pull down to refresh"
    }

    var body: some View {
        VStack(spacing: 14) {
            Spacer()
            ZStack {
                Circle()
                    .fill(Color(hex: "#F3F4F6"))
                    .frame(width: 64, height: 64)
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(Color(hex: "#9CA3AF"))
            }
            VStack(spacing: 5) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color(hex: "#111111"))
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Color(hex: "#9CA3AF"))
                    .multilineTextAlignment(.center)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32)
    }
}

// MARK: — Preview seeding

extension Stats {
    static let seeded = Stats(queue: 8, visited: 3, pitched: 2, sold: 1, rejected: nil,
                              earned: 50, visitsToday: nil, salesToday: nil,
                              visitsThisWeek: nil, salesThisWeek: nil, totalCommission: nil)
}

private func seededLead(
    id: String, name: String, type: String, address: String, postcode: String,
    status: String, rating: Double?, reviewCount: Int?, phone: String?,
    hasDemoSite: Bool, contact: String? = nil, role: String? = nil, followUpDays: Int? = nil
) -> Lead {
    Lead(
        assignmentId: id, businessName: name, businessType: type,
        address: address, postcode: postcode, phone: phone,
        googleRating: rating, googleReviewCount: reviewCount,
        hasDemoSite: hasDemoSite,
        demoSiteDomain: hasDemoSite ? "\(name.lowercased().replacing(" ", with: "-")).salesflow.site" : nil,
        status: status,
        followUpAt: followUpDays.map { Calendar.current.date(byAdding: .day, value: $0, to: .now) } ?? nil,
        contactPerson: contact, contactRole: role, openingHours: nil,
        services: "[\"Example service\"]",
        bestReviews: "[{\"author\":\"A\",\"rating\":5,\"text\":\"Great\"}]",
        trustBadges: "[\"5★ Google\"]", avoidTopics: "[]"
    )
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Lead.self, configurations: config)
    let ctx = container.mainContext
    [
        seededLead(id: "1", name: "Barber & Co", type: "Barber Shop", address: "12 High St", postcode: "E1 6RF", status: "new", rating: 4.7, reviewCount: 83, phone: nil, hasDemoSite: true),
        seededLead(id: "2", name: "Lotus Thai Kitchen", type: "Restaurant", address: "88 Old St", postcode: "EC1V 9AN", status: "pitched", rating: 4.9, reviewCount: 211, phone: nil, hasDemoSite: true, followUpDays: 2),
        seededLead(id: "3", name: "The Rusty Spoon", type: "Cafe", address: "4 Market Lane", postcode: "EC2A 3AB", status: "visited", rating: 4.2, reviewCount: 44, phone: nil, hasDemoSite: false),
        seededLead(id: "4", name: "Pixel Print Shop", type: "Print & Copy", address: "33 Brick Lane", postcode: "E1 6PU", status: "sold", rating: 4.5, reviewCount: 19, phone: nil, hasDemoSite: true),
        seededLead(id: "5", name: "Crunch Gym", type: "Fitness Centre", address: "1 City Rd", postcode: "EC1Y 1AG", status: "new", rating: 3.9, reviewCount: 62, phone: nil, hasDemoSite: false),
        seededLead(id: "6", name: "Blooms Florist", type: "Florist", address: "7 Camden Passage", postcode: "N1 8EA", status: "new", rating: 4.8, reviewCount: 57, phone: nil, hasDemoSite: true),
        seededLead(id: "7", name: "Nova Nails & Beauty", type: "Beauty Salon", address: "22 Wardour St", postcode: "W1F 8ZT", status: "visited", rating: 4.4, reviewCount: 96, phone: nil, hasDemoSite: true, followUpDays: 1),
        seededLead(id: "8", name: "Ironworks Coffee", type: "Specialty Coffee Bar", address: "14 Bermondsey St", postcode: "SE1 3TQ", status: "rejected", rating: 4.6, reviewCount: 128, phone: nil, hasDemoSite: false),
    ].forEach { ctx.insert($0) }
    return LeadsView()
        .modelContainer(container)
        .environmentObject(AuthStore.shared)
        .environmentObject(AppearanceStore.shared)
}
