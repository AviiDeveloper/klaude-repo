import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var authStore: AuthStore
    @EnvironmentObject private var appearanceStore: AppearanceStore
    @State private var showSignOutAlert = false
    @State private var showHelp = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                List {
                    // ── User card ─────────────────────────────────────────────
                    Section {
                        userCard
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowSeparator(.hidden)

                    // ── Performance ───────────────────────────────────────────
                    Section {
                        performanceCard
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 16, trailing: 16))
                    .listRowSeparator(.hidden)

                    // ── Appearance ────────────────────────────────────────────
                    Section(header: sectionHeader("Appearance")) {
                        HStack(spacing: 10) {
                            Image(systemName: "circle.lefthalf.filled")
                                .font(.system(size: 14))
                                .foregroundStyle(Theme.textSecondary)
                                .frame(width: 22)
                            Text("Theme")
                                .font(.system(size: 15))
                                .foregroundStyle(Theme.textPrimary)
                            Spacer()
                            Picker("", selection: $appearanceStore.preference) {
                                ForEach(AppearanceStore.Preference.allCases, id: \.self) { pref in
                                    Text(pref.label).tag(pref)
                                }
                            }
                            .pickerStyle(.segmented)
                            .frame(width: 180)
                        }
                        .listRowBackground(Theme.surface)
                    }

                    // ── App settings ──────────────────────────────────────────
                    Section(header: sectionHeader("Permissions")) {
                        ProfileRow(icon: "bell", label: "Notifications") {}
                        ProfileRow(icon: "location", label: "Location Access") { openSettings() }
                        ProfileRow(icon: "camera", label: "Camera Access") { openSettings() }
                    }

                    // ── Support ───────────────────────────────────────────────
                    Section(header: sectionHeader("Support")) {
                        ProfileRow(icon: "questionmark.circle", label: "How to Use This App") {
                            showHelp = true
                        }
                        ProfileRow(icon: "doc.text", label: "Contractor Agreement") {}
                        ProfileRow(icon: "envelope", label: "Contact Support") {
                            if let url = URL(string: "mailto:support@salesflow.app") {
                                UIApplication.shared.open(url)
                            }
                        }
                    }

                    // ── Legal ─────────────────────────────────────────────────
                    Section(header: sectionHeader("Legal")) {
                        ProfileRow(icon: "hand.raised", label: "Privacy Policy") {}
                        ProfileRow(icon: "doc.plaintext", label: "Terms of Service") {}
                    }

                    // ── Sign out ──────────────────────────────────────────────
                    Section {
                        Button(action: { showSignOutAlert = true }) {
                            HStack(spacing: 10) {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Theme.statusRejected)
                                    .frame(width: 22)
                                Text("Sign Out")
                                    .font(.system(size: 15))
                                    .foregroundStyle(Theme.statusRejected)
                                Spacer()
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }

                    // ── Version ───────────────────────────────────────────────
                    Section {
                        Text("SalesFlow v1.0  ·  Build 1  ·  Independent contractor platform")
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.textMuted)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .background(Theme.background)
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showHelp) { HelpView() }
            .alert("Sign Out", isPresented: $showSignOutAlert) {
                Button("Sign Out", role: .destructive) { authStore.signOut() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need your PIN to sign back in.")
            }
        }
    }

    // MARK: — User card

    private var userCard: some View {
        let user = authStore.currentUser
        return HStack(spacing: 14) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Theme.surfaceElevated)
                    .frame(width: 52, height: 52)
                    .overlay(Circle().stroke(Theme.border, lineWidth: Theme.borderWidth))
                Text((user?.name.prefix(1) ?? "?").uppercased())
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text((user?.name ?? "Contractor").capitalized)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                HStack(spacing: 6) {
                    Text(user?.role?.capitalized ?? "Field Contractor")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                    Circle()
                        .fill(Theme.statusSold)
                        .frame(width: 5, height: 5)
                    Text("Active")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.statusSold)
                }
            }
            Spacer()
        }
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    // MARK: — Performance card

    private var performanceCard: some View {
        HStack(spacing: 0) {
            PerfCell(value: "—", label: "This week")
            perfDivider
            PerfCell(value: "£50", label: "Per sale", mono: true)
            perfDivider
            PerfCell(value: "Fri", label: "Payout")
        }
        .padding(.vertical, 14)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(Theme.border, lineWidth: Theme.borderWidth)
        )
    }

    private var perfDivider: some View {
        Rectangle().fill(Theme.border).frame(width: Theme.borderWidth, height: 30)
    }

    // MARK: — Helpers

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Theme.textMuted)
            .tracking(0.5)
            .textCase(.uppercase)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: — Perf cell
private struct PerfCell: View {
    let value: String
    let label: String
    var mono: Bool = false

    var body: some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(size: 16, weight: .bold, design: mono ? .monospaced : .default))
                .foregroundStyle(Theme.textPrimary)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(Theme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: — Profile row
private struct ProfileRow: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.textSecondary)
                    .frame(width: 22)
                Text(label)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.textMuted)
            }
        }
        .listRowBackground(Theme.surface)
    }
}

// MARK: — Help view
struct HelpView: View {
    @Environment(\.dismiss) private var dismiss

    private let steps: [(String, String, String)] = [
        ("01", "Get your leads", "Your assigned businesses appear in the Leads tab. Each card shows the status, rating, and whether a demo site is ready."),
        ("02", "Prepare before you visit", "Tap any lead and go to the Prepare tab for talking points, customer reviews, trust signals, and topics to avoid."),
        ("03", "Tap 'I'm Here' on arrival", "This starts visit tracking and logs your GPS position for payout verification."),
        ("04", "Show the demo site", "In the Pitch tab, tap 'Show Demo to Client' to walk them through the website on your phone."),
        ("05", "Update the status", "After each interaction, update the status: Visited, Pitched, Sold, or Rejected."),
        ("06", "Collect your commission", "£50 lands every Friday for each confirmed sale. No targets. No minimums."),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(steps, id: \.0) { step in
                            HStack(alignment: .top, spacing: 14) {
                                Text(step.0)
                                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 28, height: 28)
                                    .background(Theme.accent.opacity(0.10))
                                    .clipShape(RoundedRectangle(cornerRadius: 7))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 7)
                                            .stroke(Theme.accent.opacity(0.25), lineWidth: Theme.borderWidth)
                                    )

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(step.1)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Theme.textPrimary)
                                    Text(step.2)
                                        .font(.system(size: 13))
                                        .foregroundStyle(Theme.textSecondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer()
                            }
                            .padding(14)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
                            .overlay(
                                RoundedRectangle(cornerRadius: Theme.radiusCard)
                                    .stroke(Theme.border, lineWidth: Theme.borderWidth)
                            )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
            }
            .navigationTitle("How to Use")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Theme.accent)
                        .font(.system(size: 15, weight: .medium))
                }
            }
        }
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthStore.shared)
        .environmentObject(AppearanceStore.shared)
}
