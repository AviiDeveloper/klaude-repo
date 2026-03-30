import SwiftUI
import SwiftData

// MARK: — ModeSelectView
// First screen after launch. Splits into dashboard (salesman) or client demo mode.

struct ModeSelectView: View {
    @EnvironmentObject private var authStore: AuthStore
    @State private var showClientPicker = false
    @State private var presentationLead: Lead? = nil

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── Wordmark ──────────────────────────────────
                VStack(spacing: 10) {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(.white)
                        .frame(width: 44, height: 44)
                        .overlay(
                            Image(systemName: "chart.line.uptrend.xyaxis")
                                .font(.system(size: 20, weight: .medium))
                                .foregroundStyle(Color(hex: "#f59e0b"))
                        )
                        .padding(.bottom, 6)

                    Text("SalesFlow")
                        .font(.system(size: 24, weight: .semibold))
                        .tracking(-0.6)
                        .foregroundStyle(.white)

                    Text("What are you doing today?")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.textMuted)
                }
                .staggeredEntrance(index: 0, baseDelay: 0.08)
                .padding(.bottom, 48)

                // ── Mode buttons ──────────────────────────────
                VStack(spacing: 12) {

                    // Dashboard
                    NavigationLink(destination: MainTabView().navigationBarHidden(true)) {
                        ModeButton(
                            icon: "list.bullet.rectangle",
                            iconBackground: Theme.surfaceElevated,
                            iconBorder: Theme.border,
                            iconColor: Theme.textSecondary,
                            title: "My Dashboard",
                            subtitle: "Leads, map, payouts, profile",
                            borderColor: Theme.border
                        )
                    }
                    .buttonStyle(PressEffectButtonStyle())
                    .staggeredEntrance(index: 1, baseDelay: 0.08)

                    // Client demo
                    Button(action: { showClientPicker = true }) {
                        ModeButton(
                            icon: "iphone",
                            iconBackground: Theme.accent.opacity(0.12),
                            iconBorder: Theme.accent.opacity(0.3),
                            iconColor: Theme.accent,
                            title: "Show Client Demo",
                            subtitle: "Full-screen site preview for the owner",
                            borderColor: Theme.accent.opacity(0.25)
                        )
                    }
                    .buttonStyle(PressEffectButtonStyle())
                    .staggeredEntrance(index: 2, baseDelay: 0.08)
                }
                .padding(.horizontal, 24)

                Spacer()

                // Sign out
                Button(action: { authStore.signOut() }) {
                    Text("Sign out")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textMuted)
                }
                .staggeredEntrance(index: 3, baseDelay: 0.08)
                .padding(.bottom, 32)
            }
        }
        .sheet(isPresented: $showClientPicker) {
            ClientLeadPickerView(onSelect: { lead in
                showClientPicker = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    presentationLead = lead
                }
            })
        }
        .fullScreenCover(item: $presentationLead) { lead in
            if let domain = lead.demoSiteDomain {
                ClientPresentationView(domain: domain, businessName: lead.businessName)
            }
        }
    }
}

// MARK: — ModeButton (reusable row for mode selection)

private struct ModeButton: View {
    let icon: String
    let iconBackground: Color
    let iconBorder: Color
    let iconColor: Color
    let title: String
    let subtitle: String
    let borderColor: Color

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(iconBackground)
                    .frame(width: 48, height: 48)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(iconBorder, lineWidth: 1)
                    )
                Image(systemName: icon)
                    .font(.system(size: 20))
                    .foregroundStyle(iconColor)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.textMuted)
            }

            Spacer()

            Image(systemName: "arrow.right")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.textMuted.opacity(0.7))
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(borderColor, lineWidth: 1)
        )
    }
}

// MARK: — ClientLeadPickerView

struct ClientLeadPickerView: View {
    let onSelect: (Lead) -> Void
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var allLeads: [Lead]

    private var demoLeads: [Lead] {
        allLeads.filter { $0.hasDemoSite && $0.demoSiteDomain != nil }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if demoLeads.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "globe.slash")
                            .font(.system(size: 32, weight: .light))
                            .foregroundStyle(Theme.textMuted.opacity(0.7))
                        Text("No demo sites available")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.textSecondary)
                        Text("Leads with demo sites will appear here")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.textMuted)
                    }
                } else {
                    List {
                        Section {
                            ForEach(demoLeads) { lead in
                                Button(action: {
                                    onSelect(lead)
                                }) {
                                    HStack(spacing: 12) {
                                        // Initials
                                        ZStack {
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(Theme.surfaceElevated)
                                                .frame(width: 40, height: 40)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(Theme.border, lineWidth: 1)
                                                )
                                            Text(lead.businessName.prefix(2).uppercased())
                                                .font(.system(size: 12, weight: .bold, design: .monospaced))
                                                .foregroundStyle(Theme.textMuted)
                                        }

                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(lead.businessName)
                                                .font(.system(size: 15, weight: .semibold))
                                                .foregroundStyle(.white)
                                            HStack(spacing: 4) {
                                                Text(lead.businessType)
                                                    .font(.system(size: 12))
                                                    .foregroundStyle(Theme.textMuted)
                                                Text("\u{00B7}")
                                                    .foregroundStyle(Theme.textMuted.opacity(0.6))
                                                Text(lead.postcode)
                                                    .font(.system(size: 11, design: .monospaced))
                                                    .foregroundStyle(Theme.textMuted)
                                            }
                                        }

                                        Spacer()

                                        Image(systemName: "play.circle")
                                            .font(.system(size: 20))
                                            .foregroundStyle(Theme.accent)
                                    }
                                    .padding(.vertical, 4)
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Theme.surface)
                                .listRowSeparatorTint(Theme.borderSubtle)
                            }
                        } header: {
                            Text("Select a business to demo")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.textMuted)
                                .tracking(0.5)
                                .textCase(.uppercase)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Client Demo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

#Preview {
    NavigationStack {
        ModeSelectView()
            .environmentObject(AuthStore.shared)
    }
}
