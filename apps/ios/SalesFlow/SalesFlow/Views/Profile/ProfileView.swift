import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let user = authManager.user {
                        HStack(spacing: 12) {
                            ZStack {
                                Circle()
                                    .fill(SF.hover)
                                    .frame(width: 44, height: 44)
                                Text(String(user.name.prefix(1)).uppercased())
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundColor(SF.textSecondary)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.name)
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundColor(SF.text)
                                Text(user.areaPostcode ?? "No area set")
                                    .font(SF.captionFont)
                                    .foregroundColor(SF.textMuted)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listRowBackground(SF.surface)

                Section {
                    Button(role: .destructive) {
                        authManager.logout()
                    } label: {
                        Text("Sign Out")
                            .foregroundColor(SF.red)
                    }
                }
                .listRowBackground(SF.surface)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(SF.bg)
            .navigationTitle("Account")
        }
    }
}
