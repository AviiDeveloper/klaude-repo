import Foundation
import CoreLocation
import SwiftData

// MARK: — GeocodingService
// Geocodes lead addresses using CLGeocoder with rate limiting.
// Results are cached in Lead.cachedLat/cachedLng via SwiftData.

@MainActor
final class GeocodingService {
    private let geocoder = CLGeocoder()
    private let context: ModelContext
    private var postcodeCache: [String: CLLocationCoordinate2D] = [:]
    private(set) var isGeocoding = false

    init(context: ModelContext) {
        self.context = context
    }

    /// Geocode all leads missing coordinates. Rate-limited to 1 req/sec.
    func geocodeLeads(_ leads: [Lead]) async {
        let ungeocodedLeads = leads.filter { $0.cachedLat == nil || $0.cachedLng == nil }
        guard !ungeocodedLeads.isEmpty else { return }

        isGeocoding = true
        defer { isGeocoding = false }

        for lead in ungeocodedLeads {
            // Check postcode cache first
            if let cached = postcodeCache[lead.postcode] {
                let offset = smallOffset(for: lead.assignmentId)
                lead.cachedLat = cached.latitude + offset.0
                lead.cachedLng = cached.longitude + offset.1
                continue
            }

            // Geocode from address + postcode
            let query = "\(lead.address), \(lead.postcode), UK"
            do {
                let placemarks = try await geocoder.geocodeAddressString(query)
                if let location = placemarks.first?.location?.coordinate {
                    lead.cachedLat = location.latitude
                    lead.cachedLng = location.longitude
                    postcodeCache[lead.postcode] = location
                }
            } catch {
                // Try postcode only as fallback
                do {
                    let placemarks = try await geocoder.geocodeAddressString("\(lead.postcode), UK")
                    if let location = placemarks.first?.location?.coordinate {
                        let offset = smallOffset(for: lead.assignmentId)
                        lead.cachedLat = location.latitude + offset.0
                        lead.cachedLng = location.longitude + offset.1
                        postcodeCache[lead.postcode] = location
                    }
                } catch {
                    #if DEBUG
                    print("[Geocoding] Failed for \(lead.businessName): \(error.localizedDescription)")
                    #endif
                }
            }

            // Rate limit: 1 second between requests
            try? await Task.sleep(for: .seconds(1))
        }

        try? context.save()
    }

    /// Small deterministic offset to separate leads sharing a postcode
    private func smallOffset(for id: String) -> (Double, Double) {
        let hash = abs(id.hashValue)
        let latOffset = Double(hash % 100) * 0.00002 - 0.001
        let lngOffset = Double((hash / 100) % 100) * 0.00002 - 0.001
        return (latOffset, lngOffset)
    }
}
