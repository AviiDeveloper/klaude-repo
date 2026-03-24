import SwiftUI

struct LeadsView: View {
    @State private var leads: [Lead] = []
    @State private var stats: StatsResponse?
    @State private var loading = true

    var body: some View {
        NavigationStack {
            List {
                // Stats
                if let stats {
                    Section {
                        HStack(spacing: 0) {
                            StatCell(value: "\(stats.queue)", label: "Queue")
                            Divider().frame(height: 40)
                            StatCell(value: "\(stats.visited)", label: "Visited")
                            Divider().frame(height: 40)
                            StatCell(value: "\(stats.pitched)", label: "Pitched")
                            Divider().frame(height: 40)
                            StatCell(value: "\(stats.sold)", label: "Sold", color: SF.green)
                        }
                    }
                    .listRowBackground(SF.surface)
                }

                // Lead list
                Section {
                    ForEach(leads) { lead in
                        NavigationLink(destination: LeadDetailView(leadId: lead.id)) {
                            LeadRow(lead: lead)
                        }
                    }
                }
                .listRowBackground(SF.surface)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(SF.bg)
            .navigationTitle("Leads")
            .refreshable { await fetchData() }
            .task { await fetchData() }
        }
    }

    private func fetchData() async {
        do {
            async let leadsReq = APIClient.shared.getLeads()
            async let statsReq = APIClient.shared.getStats()
            let (l, s) = try await (leadsReq, statsReq)
            leads = l.leads
            stats = s
        } catch {
            print("Failed to fetch: \(error)")
        }
        loading = false
    }
}

struct LeadRow: View {
    let lead: Lead

    var body: some View {
        HStack(spacing: 12) {
            // Initial
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(SF.hover)
                    .frame(width: 36, height: 36)
                Text(String(lead.businessName.prefix(1)))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(SF.textSecondary)
            }

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(lead.businessName)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(SF.text)
                Text("\(lead.businessType) · \(lead.postcode)")
                    .font(SF.captionFont)
                    .foregroundColor(SF.textMuted)
            }

            Spacer()

            // Rating + status
            VStack(alignment: .trailing, spacing: 3) {
                if lead.googleRating > 0 {
                    Text(String(format: "%.1f", lead.googleRating))
                        .font(SF.monoFont)
                        .foregroundColor(SF.textSecondary)
                }
                HStack(spacing: 4) {
                    Circle()
                        .fill(SF.statusColor(lead.status.rawValue))
                        .frame(width: 5, height: 5)
                    Text(lead.status.rawValue)
                        .font(.system(size: 11))
                        .foregroundColor(SF.textMuted)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

struct StatCell: View {
    let value: String
    let label: String
    var color: Color = SF.text

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 18, weight: .semibold, design: .monospaced))
                .foregroundColor(color)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(SF.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}
