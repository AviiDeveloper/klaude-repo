import SwiftUI
import SwiftData

// MARK: — LeadsView (Redesigned to DESIGN_NOTES.md)
// Uses Theme tokens throughout. Muted professional palette.
// SubtleGridBackground. Card pattern from design system.

struct LeadsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var leads: [Lead]

    @State private var stats: Stats = .empty
    @State private var selectedFilter: String = "all"
    @State private var isRefreshing = false
    @State private var isOffline = false
    @State private var searchText = ""
    @State private var showSearch = false
    @State private var showLeaderboard = false

    private let filters = ["all", "new", "visited", "pitched", "rejected"]

    private var activeleads: [Lead] {
        leads.filter { $0.status.lowercased() != "sold" }
    }

    private var filteredLeads: [Lead] {
        var result = activeleads
        if selectedFilter != "all" {
            result = result.filter { $0.status.lowercased() == selectedFilter }
        }
        if !searchText.isEmpty {
            let q = searchText.lowercased()
            result = result.filter {
                $0.businessName.lowercased().contains(q) ||
                $0.businessType.lowercased().contains(q) ||
                $0.postcode.lowercased().contains(q)
            }
        }
        return result
    }

    private var followUpLeads: [Lead] {
        filteredLeads.filter { $0.followUpAt != nil && ($0.followUpAt ?? .distantPast) > .now }
    }

    private var regularLeads: [Lead] {
        filteredLeads.filter { $0.followUpAt == nil || ($0.followUpAt ?? .distantPast) <= .now }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                SubtleGridBackground().ignoresSafeArea()

                VStack(spacing: 0) {
                    statsHeader
                    filterBar

                    if showSearch {
                        searchBar
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    if filteredLeads.isEmpty && !isRefreshing {
                        emptyState
                    } else {
                        leadsList
                    }
                }
            }
            .navigationTitle("Leads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showLeaderboard = true } label: {
                        Image(systemName: "trophy.fill")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color(hex: "#B8922A"))
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                            showSearch.toggle()
                            if !showSearch { searchText = "" }
                        }
                    } label: {
                        Image(systemName: showSearch ? "xmark" : "magnifyingglass")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .sheet(isPresented: $showLeaderboard) {
                LeaderboardView()
            }
        }
        .task { await loadData() }
    }

    // ── Stats ────────────────────────────────────────────────────────

    private var statsHeader: some View {
        HStack(alignment: .bottom) {
            // Hero earned — sage green (muted, professional)
            VStack(alignment: .leading, spacing: 1) {
                Text("£\(Int(stats.earned))")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(hex: "#6B8F7B"))
                    .contentTransition(.numericText())
                    .animation(.spring(response: 0.4), value: stats.earned)
                Text("earned this week")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(hex: "#6B8F7B").opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))

            Spacer()

            // Inline secondary stats
            Text("\(stats.queue) queue \u{00B7} \(stats.visited) visited \u{00B7} \(stats.pitched) pitched \u{00B7} \(stats.sold) sold")
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 12)
        .background(Theme.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.borderSubtle).frame(height: Theme.borderWidth)
        }
    }

    // ── Filter tabs (underline style) ────────────────────────────────

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 24) {
                ForEach(filters, id: \.self) { filter in
                    let count = filter == "all" ? activeleads.count : leads.filter { $0.status.lowercased() == filter }.count
                    let label = filter == "all" ? "All" : Theme.statusLabel(for: filter)

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { selectedFilter = filter }
                    } label: {
                        VStack(spacing: 6) {
                            Text("\(label) \(count)")
                                .font(.system(size: 13, weight: selectedFilter == filter ? .semibold : .medium))
                                .foregroundStyle(selectedFilter == filter ? Theme.textPrimary : Theme.textMuted)

                            Rectangle()
                                .fill(selectedFilter == filter ? Theme.accent : .clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.top, 8)
        .background(Theme.surface)
    }

    // ── Search ───────────────────────────────────────────────────────

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textMuted)
            TextField("Search by name, type, or postcode", text: $searchText)
                .font(.system(size: 15))
                .foregroundStyle(Theme.textPrimary)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !searchText.isEmpty {
                Button { withAnimation { searchText = "" } } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
    }

    // ── Lead list (grouped) ──────────────────────────────────────────

    private var leadsList: some View {
        ScrollView {
            LazyVStack(spacing: 6) {

                // Follow-up section
                if !followUpLeads.isEmpty {
                    sectionHeader("Follow up")
                    ForEach(followUpLeads) { lead in
                        NavigationLink(destination: LeadDetailView(lead: lead)) {
                            LeadRow(lead: lead)
                        }
                        .buttonStyle(RowPress())
                    }
                }

                // Regular leads section
                if !regularLeads.isEmpty {
                    sectionHeader(followUpLeads.isEmpty ? "Your leads" : "Other leads")
                    ForEach(regularLeads) { lead in
                        NavigationLink(destination: LeadDetailView(lead: lead)) {
                            LeadRow(lead: lead)
                        }
                        .buttonStyle(RowPress())
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
        }
        .refreshable { await loadData() }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Theme.textMuted)
            .tracking(1.0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 20)
            .padding(.bottom, 6)
            .padding(.leading, 4)
    }

    // ── Empty state ──────────────────────────────────────────────────

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: isOffline ? "wifi.slash" : searchText.isEmpty ? "tray" : "magnifyingglass")
                .font(.system(size: 28))
                .foregroundStyle(Theme.textMuted)
                .padding(.bottom, 4)
            Text(isOffline ? "Can't reach server" : searchText.isEmpty ? "No leads" : "No results")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
            Text(isOffline ? "Pull to retry" : searchText.isEmpty ? "Pull down to refresh" : "Try a different search")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textMuted)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // ── Data ─────────────────────────────────────────────────────────

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

// MARK: — Lead row (editorial)

private struct LeadRow: View {
    let lead: Lead

    private var isRejected: Bool { lead.status.lowercased() == "rejected" }

    /// Icon for business type
    private var businessIcon: String {
        switch lead.businessType.lowercased() {
        case let t where t.contains("barber") || t.contains("hair") || t.contains("salon") || t.contains("beauty"):
            return "scissors"
        case let t where t.contains("restaurant") || t.contains("kitchen") || t.contains("food"):
            return "fork.knife"
        case let t where t.contains("cafe") || t.contains("café") || t.contains("coffee"):
            return "cup.and.saucer.fill"
        case let t where t.contains("gym") || t.contains("fitness"):
            return "figure.run"
        case let t where t.contains("florist") || t.contains("flower"):
            return "leaf.fill"
        case let t where t.contains("print") || t.contains("copy"):
            return "printer.fill"
        default:
            return "building.2"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Business type icon — muted accent per DESIGN_NOTES card pattern
            Image(systemName: businessIcon)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(Color(hex: "#5B7B9D"))
                .frame(width: 40, height: 40)
                .background(Color(hex: "#5B7B9D").opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 3) {
                // Name
                Text(lead.businessName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)

                // Metadata line
                metadataLine
            }
            Spacer(minLength: 0)

            // Status badge
            statusBadge
        }
        .padding(14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
        .opacity(isRejected ? 0.5 : 1.0)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var statusBadge: some View {
        let status = lead.status.lowercased()
        if status != "rejected" {
            Text(Theme.statusLabel(for: status).uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.statusColor(for: status))
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(Theme.statusColor(for: status).opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 5))
        }
    }

    private var metadataLine: some View {
        HStack(spacing: 0) {
            Text(lead.businessType.uppercased())
                .font(.system(size: 11, weight: .medium))
                .tracking(0.6)

            sep

            Text(lead.postcode)
                .font(.system(size: 11, weight: .medium, design: .monospaced))

            if lead.hasDemoSite {
                sep
                Image(systemName: "globe")
                    .font(.system(size: 9))
                Text(" Demo")
                    .font(.system(size: 11, weight: .medium))
            }

            if let followUp = lead.followUpAt, followUp > .now {
                sep
                Text(followUpLabel(followUp))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: "#9B8B6B"))
            }

            Spacer()
        }
        .foregroundStyle(Theme.textSecondary)
    }

    private var sep: some View {
        Text(" \u{00B7} ")
            .font(.system(size: 11))
            .foregroundStyle(Theme.textMuted)
    }

    private func followUpLabel(_ date: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "Tomorrow" }
        return "in \(days)d"
    }
}

// MARK: — Row press style

private struct RowPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: — Preview

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
