import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var name = ""
    @State private var pin = ""
    @State private var loading = false
    @State private var error = ""

    var body: some View {
        ZStack {
            SF.bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Spacer()

                // Logo
                Text("▲ SalesFlow")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(.bottom, 4)

                Text("Walk in. Pitch. Sell.")
                    .font(SF.captionFont)
                    .foregroundColor(SF.textMuted)
                    .padding(.bottom, 40)

                // Name
                TextField("Username", text: $name)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding()
                    .background(SF.elevated)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SF.border, lineWidth: 0.5))
                    .foregroundColor(SF.text)
                    .padding(.bottom, 8)

                // PIN
                SecureField("PIN", text: $pin)
                    .keyboardType(.numberPad)
                    .padding()
                    .background(SF.elevated)
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(SF.border, lineWidth: 0.5))
                    .foregroundColor(SF.text)
                    .padding(.bottom, 16)

                // Error
                if !error.isEmpty {
                    Text(error)
                        .font(SF.captionFont)
                        .foregroundColor(SF.red)
                        .padding(.bottom, 12)
                }

                // Sign In
                Button {
                    Task { await handleLogin() }
                } label: {
                    Group {
                        if loading {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Text("Sign In")
                                .font(.system(size: 15, weight: .semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(.white)
                    .foregroundColor(.black)
                    .cornerRadius(10)
                }
                .disabled(name.isEmpty || pin.isEmpty || loading)
                .opacity(name.isEmpty || pin.isEmpty ? 0.3 : 1)

                Spacer()
                Spacer()
            }
            .padding(.horizontal, 24)
        }
    }

    private func handleLogin() async {
        loading = true
        error = ""
        let ok = await authManager.login(name: name.trimmingCharacters(in: .whitespaces), pin: pin)
        if !ok { error = "Invalid credentials" }
        loading = false
    }
}
