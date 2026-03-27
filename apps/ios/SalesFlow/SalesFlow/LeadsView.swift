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

    private let filters = ["all", "new", "visited", "pitched", "sold", "rejected"]

    private var filteredLeads: [Lead] {
        if selectedFilter == "all" { return leads }
        return leads.filter { $0.status.lowercased() == selectedFilter }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {

                // ── Stats header ───────────────────────────────────────────
                statsHeader

                // ── Filter bar ─────────────────────────────────────────────
                filterBar

                Rectangle()
                    .fill(Theme.borderSubtle)
                    .frame(height: Theme.borderWidth)

                // ── Content ────────────────────────────────────────────────
                ZStack {
                    Theme.background.ignoresSafeArea()

                    if filteredLeads.isEmpty && !isRefreshing {
                        EmptyLeadsView(filter: selectedFilter, isOffline: isOffline)
                            .transition(.opacity)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 8) {
                                ForEach(Array(filteredLeads.enumerated()), id: \.element.id) { index, lead in
                                    NavigationLink(destination: LeadDetailView(lead: lead)) {
                                        LeadRowView(lead: lead)
                                    }
                                    .buttonStyle(LeadRowButtonStyle())
                                    // Staggered entry
                                    .opacity(appeared ? 1 : 0)
                                    .offset(y: appeared ? 0 : 16)
                                    .animation(
                                        .spring(response: 0.45, dampingFraction: 0.82)
                                            .delay(Double(index) * 0.04),
                                        value: appeared
                                    )
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                            .padding(.bottom, 24)
                        }
                        .scrollIndicators(.hidden)
                        .refreshable { await loadData() }
                    }
                }
                .animation(.easeInOut(duration: 0.2), value: filteredLeads.count)
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 6) {
                        Text("Leads")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Theme.textPrimary)
                        if isOffline {
                            Text("· Offline")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.textMuted)
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
            StatCell(value: "\(stats.queue)", label: "Queue")
            statDivider
            StatCell(value: "\(stats.visited)", label: "Visited")
            statDivider
            StatCell(value: "\(stats.pitched)", label: "Pitched")
            statDivider
            StatCell(value: "\(stats.sold)", label: "Sold")
            statDivider
            StatCell(
                value: "£\(Int(stats.earned))",
                label: "Earned",
                mono: true,
                highlight: stats.earned > 0
            )
        }
        .padding(.vertical, 12)
        .background(Theme.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.border).frame(height: Theme.borderWidth)
        }
    }

    private var statDivider: some View {
        Rectangle()
            .fill(Theme.border)
            .frame(width: Theme.borderWidth, height: 28)
    }

    // MARK: — Filter bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(filters, id: \.self) { filter in
                    FilterTab(
                        label: filter == "all" ? "All" : Theme.statusLabel(for: filter),
                        count: filter == "all" ? nil : leads.filter { $0.status == filter }.count,
                        isSelected: selectedFilter == filter
                    ) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                            selectedFilter = filter
                            appeared = false
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                            withAnimation { appeared = true }
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .frame(height: 40)
        .background(Theme.surface)
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

// MARK: — Lead row button style (press feedback)

private struct LeadRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .opacity(configuration.isPressed ? 0.85 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

// MARK: — Stat cell

private struct StatCell: View {
    let value: String
    let label: String
    var mono: Bool = false
    var highlight: Bool = false

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 16, weight: .bold, design: mono ? .monospaced : .default))
                .foregroundStyle(highlight ? Theme.accent : Theme.textPrimary)
                .contentTransition(.numericText())
                .animation(.spring(response: 0.4), value: value)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.3)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: — Filter tab

private struct FilterTab: View {
    let label: String
    let count: Int?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack(spacing: 4) {
                    Text(label)
                        .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                        .foregroundStyle(isSelected ? Theme.textPrimary : Theme.textMuted)
                        .animation(.easeInOut(duration: 0.15), value: isSelected)
                    if let count, count > 0 {
                        Text("\(count)")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(isSelected ? Theme.accent : Theme.textMuted)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(isSelected ? Theme.accent.opacity(0.12) : Theme.surfaceElevated)
                            .clipShape(Capsule())
                            .animation(.easeInOut(duration: 0.15), value: isSelected)
                    }
                }
                .padding(.vertical, 10)
                .padding(.horizontal, 10)

                // Active underline
                Rectangle()
                    .fill(isSelected ? Theme.accent : Color.clear)
                    .frame(height: 2)
                    .animation(.spring(response: 0.3, dampingFraction: 0.75), value: isSelected)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: — Lead row card

struct LeadRowView: View {
    let lead: Lead

    var body: some View {
        HStack(alignment: .center, spacing: 14) {

            // Status colour bar + initials stacked together
            ZStack(alignment: .bottomTrailing) {
                // Initials block
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Theme.surfaceElevated)
                        .frame(width: 44, height: 44)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Theme.border, lineWidth: Theme.borderWidth)
                        )
                    Text(lead.businessName.prefix(2).uppercased())
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.textSecondary)
                }

                // Status dot — bottom-right of avatar
                Circle()
                    .fill(Theme.statusColor(for: lead.status))
                    .frame(width: 9, height: 9)
                    .overlay(Circle().stroke(Theme.surface, lineWidth: 1.5))
                    .offset(x: 2, y: 2)
            }

            // Main info
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline) {
                    Text(lead.businessName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    Text(lead.postcode)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                }

                HStack(spacing: 6) {
                    Text(lead.businessType)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)

                    if let rating = lead.googleRating {
                        Text("·")
                            .foregroundStyle(Theme.borderSubtle)
                        HStack(spacing: 2) {
                            Image(systemName: "star.fill")
                                .font(.system(size: 8))
                                .foregroundStyle(Theme.textMuted.opacity(0.7))
                            Text(String(format: "%.1f", rating))
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }

                    Spacer()

                    // Trailing badges
                    HStack(spacing: 6) {
                        if lead.hasDemoSite {
                            Text("Demo")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Theme.accent)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Theme.accent.opacity(0.1))
                                .clipShape(Capsule())
                                .overlay(Capsule().stroke(Theme.accent.opacity(0.2), lineWidth: 1))
                        }
                        if let followUp = lead.followUpAt, followUp > .now {
                            HStack(spacing: 3) {
                                Image(systemName: "clock")
                                    .font(.system(size: 9))
                                Text(followUpLabel(followUp))
                                    .font(.system(size: 10, design: .monospaced))
                            }
                            .foregroundStyle(Theme.statusVisited)
                        }
                    }
                }
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Theme.border)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    private func followUpLabel(_ date: Date) -> String {
        let days = Calendar.current.dateComponents([.day], from: .now, to: date).day ?? 0
        if days == 0 { return "Today" }
        if days == 1 { return "+1d" }
        return "+\(days)d"
    }
}

// MARK: — Empty state

private struct EmptyLeadsView: View {
    let filter: String
    let isOffline: Bool

    var body: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: isOffline ? "wifi.slash" : "tray")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Theme.textMuted)
            VStack(spacing: 5) {
                Text(isOffline ? "Can't reach server" : (filter == "all" ? "No leads assigned" : "No \(Theme.statusLabel(for: filter).lowercased()) leads"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.textSecondary)
                Text(isOffline ? "Showing cached data. Pull down to retry." : "Pull down to refresh")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: — Preview seeding

extension Stats {
    static let seeded = Stats(queue: 8, visited: 3, pitched: 2, sold: 1, rejected: nil,
                              earned: 50, visitsToday: nil, salesToday: nil,
                              visitsThisWeek: nil, salesThisWeek: nil, totalCommission: nil)
}

private func seededLead(
    id: String,
    name: String,
    type: String,
    address: String,
    postcode: String,
    status: String,
    rating: Double?,
    reviewCount: Int?,
    phone: String?,
    hasDemoSite: Bool,
    contact: String? = nil,
    role: String? = nil,
    followUpDays: Int? = nil
) -> Lead {
    let l = Lead(
        assignmentId: id,
        businessName: name,
        businessType: type,
        address: address,
        postcode: postcode,
        phone: phone,
        googleRating: rating,
        googleReviewCount: reviewCount,
        hasDemoSite: hasDemoSite,
        demoSiteDomain: hasDemoSite ? "\(name.lowercased().replacing(" ", with: "-")).salesflow.site" : nil,
        status: status,
        followUpAt: followUpDays.map { Calendar.current.date(byAdding: .day, value: $0, to: .now) } ?? nil,
        contactPerson: contact,
        contactRole: role,
        openingHours: nil,
        services: "[\"Haircuts\",\"Colouring\",\"Styling\"]",
        bestReviews: "[{\"author\":\"Sarah M\",\"rating\":5,\"text\":\"Best salon in town\"}]",
        trustBadges: "[\"5★ Google\",\"Family run\"]",
        avoidTopics: "[\"Previous agency experience\"]"
    )
    return l
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Lead.self, configurations: config)
    let ctx = container.mainContext

    let leads: [Lead] = [
        seededLead(id: "p-1", name: "Barber & Co", type: "Barber Shop", address: "12 High St", postcode: "E1 6RF", status: "new", rating: 4.7, reviewCount: 83, phone: "020 7123 4567", hasDemoSite: true),
        seededLead(id: "p-2", name: "The Rusty Spoon", type: "Café", address: "4 Market Lane", postcode: "EC2A 3AB", status: "visited", rating: 4.2, reviewCount: 44, phone: nil, hasDemoSite: false),
        seededLead(id: "p-3", name: "Lotus Thai Kitchen", type: "Restaurant", address: "88 Old Street", postcode: "EC1V 9AN", status: "pitched", rating: 4.9, reviewCount: 211, phone: "020 7456 7890", hasDemoSite: true, contact: "Mai", role: "Owner", followUpDays: 2),
        seededLead(id: "p-4", name: "Pixel Print Shop", type: "Print & Copy", address: "33 Brick Lane", postcode: "E1 6PU", status: "sold", rating: 4.5, reviewCount: 19, phone: "020 7345 6789", hasDemoSite: true),
        seededLead(id: "p-5", name: "Crunch Gym", type: "Fitness Centre", address: "1 City Rd", postcode: "EC1Y 1AG", status: "new", rating: 3.9, reviewCount: 62, phone: nil, hasDemoSite: false),
    ]
    leads.forEach { ctx.insert($0) }

    return LeadsView()
        .modelContainer(container)
        .environmentObject(AuthStore.shared)
}
