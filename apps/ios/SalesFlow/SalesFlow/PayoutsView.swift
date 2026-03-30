import SwiftUI
import SwiftData

struct PayoutsView: View {
    @Query private var leads: [Lead]
    @State private var stats: Stats = .seeded

    private var soldLeads: [Lead] { leads.filter { $0.status == "sold" } }
    private var pitchedLeads: [Lead] { leads.filter { $0.status == "pitched" } }
    private var totalEarned: Double { Double(soldLeads.count) * 50 }
    private var potentialEarned: Double { Double(pitchedLeads.count) * 50 }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {

                        // ── Hero + breakdown tightly grouped ─────────────────
                        VStack(spacing: 0) {
                            earningsHero
                            quickBreakdown
                        }

                        // ── Next payout ───────────────────────────────────────
                        nextPayoutCard

                        // ── Commission terms ──────────────────────────────────
                        commissionCard

                        // ── Confirmed sales ───────────────────────────────────
                        if !soldLeads.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                sectionLabel("Confirmed Sales", count: soldLeads.count)
                                VStack(spacing: 6) {
                                    ForEach(soldLeads) { lead in
                                        SaleRow(lead: lead, amount: "£50", amountColor: Theme.textPrimary)
                                    }
                                }
                            }
                        }

                        // ── Pipeline ──────────────────────────────────────────
                        if !pitchedLeads.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                sectionLabel("Pipeline", subtitle: "potential £\(Int(potentialEarned))", count: pitchedLeads.count)
                                VStack(spacing: 6) {
                                    ForEach(pitchedLeads) { lead in
                                        SaleRow(lead: lead, amount: "£50", amountColor: Theme.textMuted)
                                    }
                                }
                            }
                        }

                        Spacer().frame(height: 20)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                }
            }
            .navigationTitle("Payouts")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task { await fetchStats() }
    }

    // MARK: — Hero

    private var earningsHero: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Total Earned")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.6)
                .textCase(.uppercase)
                .padding(.bottom, 8)

            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text("£")
                    .font(.system(size: 20, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(hex: "#999999"))
                Text("\(Int(totalEarned))")
                    .font(.system(size: 42, weight: .bold, design: .monospaced))
                    .foregroundStyle(.white)

                Spacer()

                // Pipeline indicator inline
                VStack(alignment: .trailing, spacing: 2) {
                    Text("£\(Int(potentialEarned))")
                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                    Text("potential")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            .padding(.bottom, 12)

            // Progress bar
            let total = soldLeads.count + pitchedLeads.count
            if total > 0 {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Theme.border)
                            .frame(height: 3)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Theme.textSecondary)
                            .frame(width: geo.size.width * CGFloat(soldLeads.count) / CGFloat(total), height: 3)
                    }
                }
                .frame(height: 3)
                .padding(.bottom, 6)

                HStack(spacing: 4) {
                    Text("\(soldLeads.count) sold")
                        .foregroundStyle(Theme.textSecondary)
                    Text("·").foregroundStyle(Theme.textMuted)
                    Text("\(pitchedLeads.count) pitched")
                        .foregroundStyle(Theme.textMuted)
                    Spacer()
                }
                .font(.system(size: 11))
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 14)
        .background(Color(hex: "#0a0a0a"))
        // Top corners rounded, bottom corners sharp (merges with breakdown row below)
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: Theme.radiusCard,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: Theme.radiusCard
            )
        )
        .overlay(
            UnevenRoundedRectangle(
                topLeadingRadius: Theme.radiusCard,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: Theme.radiusCard
            )
            .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    // MARK: — Quick breakdown row (merges with hero above)

    private var quickBreakdown: some View {
        HStack(spacing: 0) {
            BreakdownCell(value: "\(soldLeads.count)", label: "Sold", color: Theme.textPrimary)
            breakdownDivider
            BreakdownCell(value: "\(pitchedLeads.count)", label: "Pitched", color: Theme.textSecondary)
            breakdownDivider
            BreakdownCell(value: "£50", label: "Per sale", color: Theme.textSecondary, mono: true)
            breakdownDivider
            BreakdownCell(value: "Fri", label: "Payout day", color: Theme.textSecondary)
        }
        .padding(.vertical, 11)
        .background(Color(hex: "#111111"))
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: 0,
                bottomLeadingRadius: Theme.radiusCard,
                bottomTrailingRadius: Theme.radiusCard,
                topTrailingRadius: 0
            )
        )
        .overlay(
            UnevenRoundedRectangle(
                topLeadingRadius: 0,
                bottomLeadingRadius: Theme.radiusCard,
                bottomTrailingRadius: Theme.radiusCard,
                topTrailingRadius: 0
            )
            .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    private var breakdownDivider: some View {
        Rectangle().fill(Theme.border).frame(width: Theme.borderWidth, height: 28)
    }

    // MARK: — Next payout

    private var nextPayoutCard: some View {
        let nextFriday = nextFridayDate()
        let daysUntil = Calendar.current.dateComponents([.day], from: .now, to: nextFriday).day ?? 0

        return VStack(alignment: .leading, spacing: 12) {
            Text("Next Payout")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.6)
                .textCase(.uppercase)

            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(nextFriday.formatted(.dateTime.weekday(.wide).day().month()))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text(daysUntil == 0 ? "Today" : "In \(daysUntil) day\(daysUntil == 1 ? "" : "s")")
                        .font(.system(size: 12))
                        .foregroundStyle(daysUntil <= 1 ? Theme.statusSold : Theme.textMuted)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text("£\(Int(totalEarned))")
                        .font(.system(size: 18, weight: .bold, design: .monospaced))
                        .foregroundStyle(soldLeads.isEmpty ? Theme.textMuted : Theme.textPrimary)
                    Text(soldLeads.isEmpty ? "No confirmed sales" : "\(soldLeads.count) sale\(soldLeads.count == 1 ? "" : "s") confirmed")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.textMuted)
                }
            }
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    // MARK: — Commission card

    private var commissionCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Commission Terms")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.6)
                .textCase(.uppercase)

            CommissionRow(icon: "sterlingsign.circle", label: "£50 flat per confirmed sale", highlight: true)
            CommissionRow(icon: "calendar", label: "Weekly payout every Friday")
            CommissionRow(icon: "person.badge.key", label: "Self-employed — no targets, no minimums")
            CommissionRow(icon: "clock", label: "Payment within 3 working days of sale verification")
            CommissionRow(icon: "checkmark.shield", label: "Sale verified by GPS check-in + status update")
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    // MARK: — Helpers

    private func sectionLabel(_ title: String, subtitle: String? = nil, count: Int) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.5)
                .textCase(.uppercase)
            Text("(\(count))")
                .font(.system(size: 11))
                .foregroundStyle(Theme.textMuted)
            Spacer()
            if let sub = subtitle {
                Text(sub)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.textMuted)
            }
        }
    }

    private func nextFridayDate() -> Date {
        var components = DateComponents()
        components.weekday = 6 // Friday
        return Calendar.current.nextDate(after: .now, matching: components, matchingPolicy: .nextTime) ?? .now
    }

    @MainActor
    private func fetchStats() async {
        if let s = try? await APIClient.shared.fetchStats() { stats = s }
    }
}

// MARK: — Sale row
private struct SaleRow: View {
    let lead: Lead
    let amount: String
    let amountColor: Color

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(lead.businessName)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.textPrimary)
                HStack(spacing: 6) {
                    Text(lead.businessType)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.textMuted)
                    Text("·")
                        .foregroundStyle(Theme.textMuted)
                        .font(.system(size: 12))
                    Text(lead.postcode)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                }
            }
            Spacer()
            Text(amount)
                .font(.system(size: 15, weight: .bold, design: .monospaced))
                .foregroundStyle(amountColor)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }
}

// MARK: — Breakdown cell
private struct BreakdownCell: View {
    let value: String
    let label: String
    let color: Color
    var mono: Bool = false

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 16, weight: .bold, design: mono ? .monospaced : .default))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.textMuted)
                .tracking(0.2)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: — Commission row
private struct CommissionRow: View {
    let icon: String
    let label: String
    var highlight: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(Theme.textMuted)
                .frame(width: 18)
            Text(label)
                .font(.system(size: 13, weight: highlight ? .semibold : .regular))
                .foregroundStyle(highlight ? Theme.textPrimary : Theme.textSecondary)
        }
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: Lead.self, configurations: config)
    let ctx = container.mainContext

    let sold1 = Lead(assignmentId: "p-101", businessName: "Barber & Co", businessType: "Barber Shop",
                     address: "12 High St", postcode: "E1 6RF", status: "sold")
    let sold2 = Lead(assignmentId: "p-102", businessName: "Pixel Print Shop", businessType: "Print & Copy",
                     address: "33 Brick Lane", postcode: "E1 6PU", status: "sold")
    let pitched = Lead(assignmentId: "p-103", businessName: "Lotus Thai Kitchen", businessType: "Restaurant",
                       address: "88 Old Street", postcode: "EC1V 9AN",
                       status: "pitched",
                       followUpAt: Calendar.current.date(byAdding: .day, value: 2, to: .now),
                       contactPerson: "Mai", contactRole: "Owner")
    ctx.insert(sold1); ctx.insert(sold2); ctx.insert(pitched)

    return PayoutsView()
        .modelContainer(container)
        .environmentObject(AuthStore.shared)
}

