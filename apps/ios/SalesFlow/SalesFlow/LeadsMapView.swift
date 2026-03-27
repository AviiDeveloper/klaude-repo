import SwiftUI
import Combine
import MapKit
import SwiftData

// MARK: — LeadsMapView
struct LeadsMapView: View {
    @Query private var leads: [Lead]
    @StateObject private var locationManager = MapLocationManager()
    @State private var selectedLead: Lead?
    @State private var showDetail = false
    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Map(position: $cameraPosition) {
                    // User location
                    UserAnnotation()

                    // Lead pins
                    ForEach(leads) { lead in
                        Annotation(lead.businessName, coordinate: coordinate(for: lead)) {
                            LeadMapPin(lead: lead)
                                .onTapGesture {
                                    selectedLead = lead
                                    showDetail = true
                                }
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic, emphasis: .muted, pointsOfInterest: .excludingAll))
                .preferredColorScheme(.dark)
                .ignoresSafeArea(edges: .top)

                // Selected lead card
                if let lead = selectedLead, showDetail {
                    LeadMapCard(lead: lead) {
                        showDetail = false
                        selectedLead = nil
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .navigationTitle("Map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: centreOnUser) {
                        Image(systemName: "location.fill")
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            .onAppear { locationManager.startUpdating() }
            .animation(.spring(response: 0.3), value: showDetail)
        }
    }

    private func coordinate(for lead: Lead) -> CLLocationCoordinate2D {
        // Fall back: geocode postcode → for now use a London-centred spread
        // In production this would use CLGeocoder or stored lat/lng
        let hash = Double(lead.assignmentId.hashValue) / Double(Int.max)
        return CLLocationCoordinate2D(
            latitude: 51.5074 + hash * 0.1,
            longitude: -0.1278 + hash * 0.1
        )
    }

    private func centreOnUser() {
        if let loc = locationManager.location {
            cameraPosition = .region(MKCoordinateRegion(
                center: loc.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
            ))
        }
    }
}

// MARK: — Lead map pin
private struct LeadMapPin: View {
    let lead: Lead

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.statusColor(for: lead.status))
                .frame(width: 14, height: 14)
            Circle()
                .stroke(Color.black, lineWidth: 2)
                .frame(width: 14, height: 14)
        }
    }
}

// MARK: — Bottom card when pin tapped
private struct LeadMapCard: View {
    let lead: Lead
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(lead.businessName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                    Text("\(lead.address), \(lead.postcode)")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.textMuted)
                        .padding(6)
                        .background(Theme.surfaceElevated)
                        .clipShape(Circle())
                }
            }

            HStack(spacing: 10) {
                StatusBadge(status: lead.status)
                Spacer()

                // Directions button
                Button(action: openDirections) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.turn.up.right.circle")
                            .font(.system(size: 13))
                        Text("Directions")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(Theme.accent)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Theme.accent.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.radiusButton)
                            .stroke(Theme.accent.opacity(0.3), lineWidth: Theme.borderWidth)
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(destination: LeadDetailView(lead: lead)) {
                    Text("View")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.textPrimary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Theme.accent)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.radiusButton))
                }
                .buttonStyle(.plain)
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

    private func openDirections() {
        let query = "\(lead.address) \(lead.postcode)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "maps://?q=\(query)") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: — Location manager for map
@MainActor
final class MapLocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    @Published var location: CLLocation?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func startUpdating() {
        manager.requestWhenInUseAuthorization()
        manager.startUpdatingLocation()
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        Task { @MainActor in self.location = loc }
    }
}
