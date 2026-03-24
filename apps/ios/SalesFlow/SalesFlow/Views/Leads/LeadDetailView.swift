import SwiftUI

struct LeadDetailView: View {
    let leadId: String
    @State private var lead: Lead?
    @State private var loading = true

    var body: some View {
        Group {
            if let lead {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        // Header
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(lead.businessName)
                                    .font(SF.titleFont)
                                    .foregroundColor(SF.text)
                                Spacer()
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(SF.statusColor(lead.status.rawValue))
                                        .frame(width: 6, height: 6)
                                    Text(lead.status.rawValue.capitalized)
                                        .font(SF.captionFont)
                                        .foregroundColor(SF.statusColor(lead.status.rawValue))
                                }
                            }
                            Text("\(lead.businessType) · \(lead.postcode)")
                                .font(SF.captionFont)
                                .foregroundColor(SF.textMuted)
                            if lead.googleRating > 0 {
                                Text("★ \(String(format: "%.1f", lead.googleRating)) (\(lead.googleReviewCount) reviews)")
                                    .font(SF.captionFont)
                                    .foregroundColor(SF.textSecondary)
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 20)

                        // Actions
                        HStack(spacing: 12) {
                            ActionButton(title: "Call", icon: "phone.fill") {
                                if let url = URL(string: "tel:\(lead.phone)") {
                                    UIApplication.shared.open(url)
                                }
                            }
                            ActionButton(title: "Directions", icon: "map.fill") {
                                let query = lead.postcode.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
                                if let url = URL(string: "https://maps.apple.com/?daddr=\(query)") {
                                    UIApplication.shared.open(url)
                                }
                            }
                            if lead.hasDemoSite {
                                ActionButton(title: "Demo", icon: "safari.fill") {
                                    // Open demo site
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 24)

                        // Sections
                        Divider().background(SF.borderSubtle)

                        if !lead.openingHours.isEmpty {
                            InfoSection(title: "Hours") {
                                ForEach(lead.openingHours, id: \.self) { h in
                                    Text(h).font(SF.bodyFont).foregroundColor(SF.text)
                                }
                            }
                        }

                        if !lead.services.isEmpty {
                            InfoSection(title: "Services") {
                                Text(lead.services.joined(separator: " · "))
                                    .font(SF.bodyFont)
                                    .foregroundColor(SF.text)
                            }
                        }

                        if let address = lead.address, !address.isEmpty {
                            InfoSection(title: "Address") {
                                Text(address).font(SF.bodyFont).foregroundColor(SF.text)
                            }
                        }
                    }
                    .padding(.top)
                }
            } else if loading {
                ProgressView()
                    .tint(SF.textMuted)
            } else {
                Text("Lead not found")
                    .foregroundColor(SF.textSecondary)
            }
        }
        .background(SF.bg)
        .navigationBarTitleDisplayMode(.inline)
        .task { await fetchLead() }
    }

    private func fetchLead() async {
        do {
            lead = try await APIClient.shared.getLead(id: leadId)
        } catch {
            print("Failed: \(error)")
        }
        loading = false
    }
}

struct ActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                Text(title)
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundColor(SF.text)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(SF.elevated)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(SF.border, lineWidth: 0.5))
        }
    }
}

struct InfoSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(SF.labelFont)
                .foregroundColor(SF.textMuted)
            content
        }
        .padding(.horizontal)
        .padding(.vertical, 14)

        Divider().background(SF.borderSubtle)
    }
}
