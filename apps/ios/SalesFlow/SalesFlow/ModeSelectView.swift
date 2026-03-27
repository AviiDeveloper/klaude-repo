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

                // Wordmark
                VStack(spacing: 6) {
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(hex: "#0070F3"))
                            .frame(width: 30, height: 30)
                            .overlay(
                                Text("S")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundStyle(.white)
                            )
                        Text("SalesFlow")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    Text("What are you doing today?")
                        .font(.system(size: 14))
                        .foregroundStyle(Color(hex: "#666666"))
                }
                .padding(.bottom, 48)

                // Mode buttons
                VStack(spacing: 12) {

                    // ── Dashboard ──────────────────────────────────────────
                    NavigationLink(destination: MainTabView().navigationBarHidden(true)) {
                        HStack(spacing: 16) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color(hex: "#111111"))
                                    .frame(width: 48, height: 48)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color(hex: "#333333"), lineWidth: 1)
                                    )
                                Image(systemName: "list.bullet.rectangle")
                                    .font(.system(size: 20))
                                    .foregroundStyle(Color(hex: "#999999"))
                            }

                            VStack(alignment: .leading, spacing: 3) {
                                Text("My Dashboard")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.white)
                                Text("Leads, map, payouts, profile")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color(hex: "#666666"))
                            }

                            Spacer()

                            Image(systemName: "arrow.right")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color(hex: "#444444"))
                        }
                        .padding(16)
                        .background(Color(hex: "#0a0a0a"))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color(hex: "#333333"), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    // ── Client demo ────────────────────────────────────────
                    Button(action: { showClientPicker = true }) {
                        HStack(spacing: 16) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(Color(hex: "#0070F3").opacity(0.12))
                                    .frame(width: 48, height: 48)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(Color(hex: "#0070F3").opacity(0.3), lineWidth: 1)
                                    )
                                Image(systemName: "iphone")
                                    .font(.system(size: 20))
                                    .foregroundStyle(Color(hex: "#0070F3"))
                            }

                            VStack(alignment: .leading, spacing: 3) {
                                Text("Show Client Demo")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.white)
                                Text("Full-screen site preview for the owner")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Color(hex: "#666666"))
                            }

                            Spacer()

                            Image(systemName: "arrow.right")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color(hex: "#444444"))
                        }
                        .padding(16)
                        .background(Color(hex: "#0a0a0a"))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color(hex: "#0070F3").opacity(0.25), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 24)

                Spacer()

                // Sign out hint
                Button(action: { authStore.signOut() }) {
                    Text("Sign out")
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: "#444444"))
                }
                .padding(.bottom, 32)
            }
        }
        .sheet(isPresented: $showClientPicker) {
            ClientLeadPickerView(onSelect: { lead in
                showClientPicker = false
                // Small delay so the sheet fully dismisses before fullScreenCover appears
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

// MARK: — ClientLeadPickerView
// Shown when salesman taps "Show Client Demo" from the launch screen.
// Lists leads that have a demo site so salesman picks who they're about to pitch.

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
                            .foregroundStyle(Color(hex: "#444444"))
                        Text("No demo sites available")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color(hex: "#999999"))
                        Text("Leads with demo sites will appear here")
                            .font(.system(size: 13))
                            .foregroundStyle(Color(hex: "#555555"))
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
                                                .fill(Color(hex: "#111111"))
                                                .frame(width: 40, height: 40)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(Color(hex: "#333333"), lineWidth: 1)
                                                )
                                            Text(lead.businessName.prefix(2).uppercased())
                                                .font(.system(size: 12, weight: .bold, design: .monospaced))
                                                .foregroundStyle(Color(hex: "#666666"))
                                        }

                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(lead.businessName)
                                                .font(.system(size: 15, weight: .semibold))
                                                .foregroundStyle(.white)
                                            HStack(spacing: 4) {
                                                Text(lead.businessType)
                                                    .font(.system(size: 12))
                                                    .foregroundStyle(Color(hex: "#666666"))
                                                Text("·")
                                                    .foregroundStyle(Color(hex: "#444444"))
                                                Text(lead.postcode)
                                                    .font(.system(size: 11, design: .monospaced))
                                                    .foregroundStyle(Color(hex: "#555555"))
                                            }
                                        }

                                        Spacer()

                                        Image(systemName: "play.circle")
                                            .font(.system(size: 20))
                                            .foregroundStyle(Color(hex: "#0070F3"))
                                    }
                                    .padding(.vertical, 4)
                                }
                                .buttonStyle(.plain)
                                .listRowBackground(Color(hex: "#0a0a0a"))
                                .listRowSeparatorTint(Color(hex: "#1a1a1a"))
                            }
                        } header: {
                            Text("Select a business to demo")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color(hex: "#555555"))
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
                        .foregroundStyle(Color(hex: "#0070F3"))
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
