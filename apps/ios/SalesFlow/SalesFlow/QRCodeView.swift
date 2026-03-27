import SwiftUI

// MARK: — QRCodeView
// Standalone full-screen view showing a large QR code for the demo site.
// Designed to be shown directly to a client — uses adaptive background.

struct QRCodeView: View {
    let businessName: String
    let demoURL: String

    @Environment(\.dismiss) private var dismiss
    @State private var showShareSheet = false
    @State private var saveSuccess = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // ── Nav bar ───────────────────────────────────────────────
                HStack {
                    Button(action: { dismiss() }) {
                        HStack(spacing: 6) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 14, weight: .semibold))
                            Text("Back")
                                .font(.system(size: 16))
                        }
                        .foregroundStyle(Theme.textPrimary)
                    }
                    .buttonStyle(.plain)

                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 24)

                Spacer()

                // ── QR code + labels ──────────────────────────────────────
                VStack(spacing: 20) {
                    // Business name
                    Text(businessName)
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(Theme.textPrimary)
                        .multilineTextAlignment(.center)

                    // Subtitle
                    Text("Scan to view your website demo")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.textSecondary)

                    // QR code — always on white background so scanners can read it
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.white)
                            .shadow(color: .black.opacity(0.1), radius: 16, x: 0, y: 4)

                        QRCodeImage(content: demoURL, size: 240)
                            .padding(20)
                    }
                    .fixedSize()

                    // URL label
                    Text(demoURL)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(Theme.textMuted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                Spacer()

                // ── Action buttons ────────────────────────────────────────
                VStack(spacing: 10) {
                    // Share
                    Button(action: { showShareSheet = true }) {
                        HStack(spacing: 8) {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 15, weight: .semibold))
                            Text("Share")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(Theme.background)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(Theme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)

                    // Save to Photos
                    Button(action: { saveToPhotos() }) {
                        HStack(spacing: 8) {
                            Image(systemName: saveSuccess ? "checkmark" : "square.and.arrow.down")
                                .font(.system(size: 15, weight: .semibold))
                            Text(saveSuccess ? "Saved to Photos" : "Save to Photos")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        .foregroundStyle(saveSuccess ? Theme.statusSold : Theme.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(Theme.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Theme.border, lineWidth: 1)
                        )
                        .animation(.easeInOut(duration: 0.2), value: saveSuccess)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = URL(string: demoURL) {
                ActivityShareSheet(items: [url])
            } else {
                ActivityShareSheet(items: [demoURL])
            }
        }
    }

    private func saveToPhotos() {
        guard let image = generateQRUIImage(content: demoURL, size: 600) else { return }
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        withAnimation { saveSuccess = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            withAnimation { saveSuccess = false }
        }
    }
}

// MARK: — Preview

#Preview {
    QRCodeView(
        businessName: "Barber & Co",
        demoURL: "https://barber-co.salesflow.site"
    )
}
