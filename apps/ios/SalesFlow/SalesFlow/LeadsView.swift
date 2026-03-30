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

    private let filters = ["all", "new", "visited", "pitched", "sold", "rejected"]

    private var filteredLeads: [Lead] {
        var result = leads
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
                Theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // ── Stats header ────────────────────────────────────────
                    statsHeader
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : -8)
                        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: appeared)

                    // ── Filter bar ──────────────────────────────────────────
                    filterBar
                        .opacity(appeared ? 1 : 0)
                        .animation(.spring(response: 0.45, dampingFraction: 0.85).delay(0.05), value: appeared)

                    // ── Search bar (conditional) ────────────────────────────
                    if showSearch {
                        searchBar
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    // ── Lead list ───────────────────────────────────────────
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
                                .foregroundStyle(Theme.textMuted)
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
                                .foregroundStyle(showSearch ? Theme.accent : Theme.textSecondary)
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
        HStack(spacing: 0) {
            StatCell(value: "\(stats.queue)",      label: "Queue")
            statDivider
            StatCell(value: "\(stats.visited)",    label: "Visited")
            statDivider
            StatCell(value: "\(stats.pitched)",    label: "Pitched")
            statDivider
            StatCell(value: "\(stats.sold)",       label: "Sold")
            statDivider
            StatCell(value: "£\(Int(stats.earned))", label: "Earned", highlight: stats.earned > 0)
        }
        .padding(.vertical, 14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.border, lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Theme.border)
            .frame(width: 0.5, height: 28)
    }

    // MARK: — Filter bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                ForEach(filters, id: \.self) { filter in
                    let count = filter == "all" ? leads.count : leads.filter { $0.status == filter }.count
                    FilterChip(
                        label: filter == "all" ? "All" : Theme.statusLabel(for: filter),
                        count: count,
                        isSelected: selectedFilter == filter,
                        color: filter == "all" ? nil : Theme.statusColor(for: filter)
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
            .padding(4)
            .background(Theme.surfacePressed)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    // MARK: — Search bar

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
                Button {
                    withAnimation { searchText = "" }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.border, lineWidth: 1)
        )
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: — Leads list

    private var leadsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(filteredLeads.enumerated()), id: \.element.id) { index, lead in
                    NavigationLink(destination: LeadDetailView(lead: lead)) {
                        LeadCardRow(lead: lead)
                    }
                    .buttonStyle(LeadRowButtonStyle())
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 16)
                    .animation(
                        .spring(response: 0.42, dampingFraction: 0.82)
                            .delay(Double(index) * 0.04),
                        value: appeared
                    )

                    if index < filteredLeads.count - 1 {
                        Rectangle()
                            .fill(Theme.borderSubtle)
                            .frame(height: 0.5)
                            .padding(.leading, 76)
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .background(Theme.background)
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

// MARK: — Stat cell

private struct StatCell: View {
    let value: String
    let label: String
    var highlight: Bool = false

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundStyle(highlight ? Theme.statusSold : Theme.textPrimary)
                .contentTransition(.numericText())
                .animation(.spring(response: 0.4), value: value)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.textMuted)
                .textCase(.uppercase)
                .tracking(0.4)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: — Filter chip

private struct FilterChip: View {
    let label: String
    let count: Int
    let isSelected: Bool
    var color: Color?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let color, !isSelected {
                    Circle()
                        .fill(color)
                        .frame(width: 5, height: 5)
                }
                Text(label)
                    .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(isSelected ? .white.opacity(0.7) : Theme.textMuted)
                }
            }
            .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textMuted)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(isSelected ? Theme.border : .clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .animation(.spring(response: 0.22, dampingFraction: 0.7), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}

// MARK: — Lead card row

struct LeadCardRow: View {
    let lead: Lead

    private var statusColor: Color { Theme.statusColor(for: lead.status) }
    private var initials: String { String(lead.businessName.prefix(2)).uppercased() }

    var body: some View {
        HStack(alignment: .top, spacing: 14) {

            // ── Avatar ──────────────────────────────────────────────────────
            ZStack(alignment: .bottomTrailing) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Theme.surfaceElevated)
                        .frame(width: 48, height: 48)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Theme.border, lineWidth: 0.5)
                        )
                    Text(initials)
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                }
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(Color.black, lineWidth: 1.5))
                    .offset(x: 2, y: 2)
            }
            .padding(.top, 2)

            // ── Content ─────────────────────────────────────────────────────
            VStack(alignment: .leading, spacing: 5) {

                // Row 1: Name + badges
                HStack(alignment: .center, spacing: 6) {
                    Text(lead.businessName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    badgeRow
                }

                // Row 2: Type + rating
                HStack(spacing: 6) {
                    Text(lead.businessType)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)

                    if let rating = lead.googleRating {
                        Text("·")
                            .foregroundStyle(Theme.borderSubtle)
                            .font(.system(size: 12))
                        HStack(spacing: 3) {
                            Image(systemName: "star.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(.yellow)
                            Text(String(format: "%.1f", rating))
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundStyle(Theme.textSecondary)
                            if let count = lead.googleReviewCount {
                                Text("(\(count))")
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.textMuted)
                            }
                        }
                    }
                    Spacer()
                }

                // Row 3: Postcode + follow-up
                HStack(spacing: 6) {
                    Image(systemName: "mappin")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.textMuted)
                    Text(lead.postcode)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)

                    if let followUp = lead.followUpAt, followUp > .now {
                        Text("·")
                            .foregroundStyle(Theme.borderSubtle)
                        HStack(spacing: 3) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(Theme.statusVisited)
                            Text(followUpLabel(followUp))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.statusVisited)
                        }
                    }

                    Spacer()

                    // Status label
                    Text(Theme.statusLabel(for: lead.status).uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(statusColor)
                        .kerning(0.5)
                }
            }

            // ── Chevron ─────────────────────────────────────────────────────
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.borderSubtle)
                .padding(.top, 18)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private var badgeRow: some View {
        HStack(spacing: 5) {
            if lead.hasDemoSite {
                Label("Demo", systemImage: "globe")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .labelStyle(.titleAndIcon)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Theme.accent.opacity(0.1))
                    .clipShape(Capsule())
            }
        }
    }

    private func followUpLabel(_ date: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "Tomorrow" }
        return "in \(days)d"
    }
}

// MARK: — Button style for lead rows

private struct LeadRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Theme.surfaceElevated : .clear)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
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
                    .fill(Theme.surfaceElevated)
                    .frame(width: 64, height: 64)
                Image(systemName: icon)
                    .font(.system(size: 26, weight: .light))
                    .foregroundStyle(Theme.textMuted)
            }
            VStack(spacing: 5) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                Text(subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textMuted)
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
        seededLead(id: "3", name: "The Rusty Spoon", type: "Café", address: "4 Market Lane", postcode: "EC2A 3AB", status: "visited", rating: 4.2, reviewCount: 44, phone: nil, hasDemoSite: false),
        seededLead(id: "4", name: "Pixel Print Shop", type: "Print & Copy", address: "33 Brick Lane", postcode: "E1 6PU", status: "sold", rating: 4.5, reviewCount: 19, phone: nil, hasDemoSite: true),
        seededLead(id: "5", name: "Crunch Gym", type: "Fitness Centre", address: "1 City Rd", postcode: "EC1Y 1AG", status: "new", rating: 3.9, reviewCount: 62, phone: nil, hasDemoSite: false),
        seededLead(id: "6", name: "Blooms Florist", type: "Florist", address: "7 Camden Passage", postcode: "N1 8EA", status: "new", rating: 4.8, reviewCount: 57, phone: nil, hasDemoSite: true),
        seededLead(id: "7", name: "Nova Nails & Beauty", type: "Beauty Salon", address: "22 Wardour St", postcode: "W1F 8ZT", status: "visited", rating: 4.4, reviewCount: 96, phone: nil, hasDemoSite: true, followUpDays: 1),
    ].forEach { ctx.insert($0) }
    return LeadsView()
        .modelContainer(container)
        .environmentObject(AuthStore.shared)
        .environmentObject(AppearanceStore.shared)
}
