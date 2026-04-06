import SwiftUI

struct LeaderboardView: View {
    @State private var rankings: [LeaderboardEntry] = []
    @State private var isLoading = true
    @State private var selectedPeriod = "weekly"
    @State private var errorMessage: String?

    private let periods: [(label: String, value: String)] = [
        ("Weekly", "weekly"),
        ("Monthly", "monthly"),
        ("All Time", "alltime"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Period filter
                    periodFilter
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                    if isLoading {
                        Spacer()
                        ProgressView()
                            .tint(Theme.textMuted)
                        Spacer()
                    } else if let error = errorMessage {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "wifi.slash")
                                .font(.system(size: 28))
                                .foregroundStyle(Theme.textMuted)
                            Text(error)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.textSecondary)
                            Button("Retry") { Task { await loadData() } }
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.accent)
                        }
                        Spacer()
                    } else if rankings.isEmpty {
                        Spacer()
                        VStack(spacing: 8) {
                            Image(systemName: "chart.bar")
                                .font(.system(size: 28))
                                .foregroundStyle(Theme.textMuted)
                            Text("No sales yet")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundStyle(Theme.textSecondary)
                            Text("Be the first on the board!")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.textMuted)
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            VStack(spacing: 0) {
                                // Top 3 podium
                                if rankings.count >= 3 {
                                    podiumSection
                                        .padding(.horizontal, 16)
                                        .padding(.top, 8)
                                        .padding(.bottom, 16)
                                }

                                // Full rankings list
                                VStack(spacing: 6) {
                                    ForEach(rankings) { entry in
                                        LeaderboardRow(entry: entry)
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.bottom, 24)
                            }
                        }
                        .refreshable { await loadData() }
                    }
                }
            }
            .navigationTitle("Leaderboard")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task { await loadData() }
        .onChange(of: selectedPeriod) { _, _ in
            Task { await loadData() }
        }
    }

    // MARK: — Period filter

    private var periodFilter: some View {
        HStack(spacing: 0) {
            ForEach(periods, id: \.value) { period in
                Button(action: { selectedPeriod = period.value }) {
                    Text(period.label)
                        .font(.system(size: 13, weight: selectedPeriod == period.value ? .semibold : .regular))
                        .foregroundStyle(selectedPeriod == period.value ? Theme.textPrimary : Theme.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(
                            selectedPeriod == period.value
                                ? Theme.surface
                                : Color.clear
                        )
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.radiusButton)
                                .stroke(
                                    selectedPeriod == period.value ? Theme.border : Color.clear,
                                    lineWidth: Theme.borderWidth
                                )
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(Theme.surfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton + 3))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusButton + 3)
                .stroke(Theme.borderSubtle, lineWidth: Theme.borderWidth)
        )
    }

    // MARK: — Top 3 podium

    private var podiumSection: some View {
        HStack(alignment: .bottom, spacing: 8) {
            // 2nd place
            if rankings.count > 1 {
                PodiumCard(entry: rankings[1], medal: "2", color: Color(hex: "#C0C0C0"), height: 100)
            }
            // 1st place
            PodiumCard(entry: rankings[0], medal: "1", color: Color(hex: "#FFD700"), height: 120)
            // 3rd place
            if rankings.count > 2 {
                PodiumCard(entry: rankings[2], medal: "3", color: Color(hex: "#CD7F32"), height: 86)
            }
        }
    }

    // MARK: — Data

    private func loadData() async {
        isLoading = rankings.isEmpty
        errorMessage = nil
        do {
            rankings = try await APIClient.shared.fetchLeaderboard(period: selectedPeriod)
        } catch {
            if rankings.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
        isLoading = false
    }
}

// MARK: — Podium card

private struct PodiumCard: View {
    let entry: LeaderboardEntry
    let medal: String
    let color: Color
    let height: CGFloat

    var body: some View {
        VStack(spacing: 6) {
            // Medal
            Text(medal)
                .font(.system(size: 14, weight: .black, design: .rounded))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(color)
                .clipShape(Circle())

            // Avatar
            Text(String(entry.name.prefix(1)).uppercased())
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 36, height: 36)
                .background(Theme.surfaceElevated)
                .clipShape(Circle())
                .overlay(Circle().stroke(entry.isYou ? Theme.accent : Theme.border, lineWidth: entry.isYou ? 2 : 1))

            // Name
            Text(entry.name.capitalized)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(1)

            // Sales
            Text("\(entry.salesCount) sales")
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .foregroundStyle(Theme.textSecondary)

            // Earnings
            Text("£\(Int(entry.earned))")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .padding(.vertical, 12)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(entry.isYou ? Theme.accent.opacity(0.5) : Theme.border, lineWidth: Theme.borderWidth)
        )
    }
}

// MARK: — Leaderboard row

private struct LeaderboardRow: View {
    let entry: LeaderboardEntry

    var body: some View {
        HStack(spacing: 12) {
            // Rank
            Text("\(entry.rank)")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.textMuted)
                .frame(width: 28, alignment: .center)

            // Avatar
            ZStack {
                Circle()
                    .fill(Theme.surfaceElevated)
                    .frame(width: 36, height: 36)
                    .overlay(Circle().stroke(entry.isYou ? Theme.accent : Theme.border, lineWidth: entry.isYou ? 2 : 1))
                Text(String(entry.name.prefix(1)).uppercased())
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
            }

            // Name + ID
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name.capitalized)
                    .font(.system(size: 14, weight: entry.isYou ? .bold : .medium))
                    .foregroundStyle(Theme.textPrimary)
                if let id = entry.contractorNumber {
                    Text(id)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                }
            }

            Spacer()

            // Stats
            VStack(alignment: .trailing, spacing: 2) {
                Text("£\(Int(entry.earned))")
                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                    .foregroundStyle(Theme.textPrimary)
                Text("\(entry.salesCount) sale\(entry.salesCount == 1 ? "" : "s")")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(entry.isYou ? Theme.accent.opacity(0.08) : Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusCard))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.radiusCard)
                .stroke(entry.isYou ? Theme.accent.opacity(0.3) : Theme.border, lineWidth: Theme.borderWidth)
        )
    }
}

#Preview {
    LeaderboardView()
}
