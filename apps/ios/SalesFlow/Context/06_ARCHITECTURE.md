# App Architecture — MVVM + Services

## Project Structure

```
salesflow/
  salesflowApp.swift              ← Entry point, routing

  Context/                        ← This folder (reference docs)

  Theme/
    Colors.swift                  ← All colour constants
    Typography.swift              ← Font helpers
    Components.swift              ← Reusable UI components (cards, buttons, badges)

  Models/
    User.swift
    Lead.swift
    Stats.swift
    Visit.swift
    Intel.swift

  Services/
    APIClient.swift               ← HTTP client with auth token
    AuthService.swift             ← Login, register, token storage (Keychain)
    LocationService.swift         ← CoreLocation GPS tracking
    CameraService.swift           ← Photo capture + storage
    NotificationService.swift     ← Push notification registration
    SyncService.swift             ← Offline data sync

  ViewModels/
    AuthViewModel.swift           ← Login/register state
    LeadsViewModel.swift          ← Lead list + filtering + stats
    LeadDetailViewModel.swift     ← Single lead actions + intel
    MapViewModel.swift            ← Map pins + user location
    PayoutsViewModel.swift        ← Earnings data
    ProfileViewModel.swift        ← User profile + settings

  Views/
    Auth/
      LoginView.swift
      OnboardingView.swift
      RegisterView.swift

    Leads/
      LeadsView.swift             ← Dashboard/lead list (Tab 1)
      LeadDetailView.swift        ← Tabbed detail
      BriefWalkthroughView.swift  ← Full-screen briefing

    Map/
      MapView.swift               ← Map with pins (Tab 2)

    Payouts/
      PayoutsView.swift           ← Earnings (Tab 3)

    Profile/
      ProfileView.swift           ← Account (Tab 4)
      SettingsView.swift
      HelpView.swift
      ReferralsView.swift

    Shared/
      DemoViewerView.swift        ← WKWebView for demo sites
      CameraView.swift            ← Photo capture
      ShareDemoView.swift         ← Generate + share demo link

    Legal/
      TermsView.swift
      PrivacyView.swift
      ContractorView.swift

  Components/
    LeadCard.swift                ← Reusable lead row
    StatusDot.swift               ← 6pt colour dot
    StatCard.swift                ← Number + label card
    OpenIndicator.swift           ← "Open now" / "Closed" text
    SectionHeader.swift           ← Uppercase label
```

## Key Architecture Decisions

### 1. AuthService with Keychain
```swift
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?

    private let keychain = KeychainHelper()

    func login(name: String, pin: String) async throws
    func logout()
    func getToken() -> String?
}
```
Store the Bearer token in Keychain, not UserDefaults. Check on app launch if token exists + is valid.

### 2. APIClient with automatic auth
```swift
class APIClient {
    static let shared = APIClient()

    var baseURL = "http://localhost:4350"  // Change for production

    func request<T: Decodable>(_ endpoint: String, method: String = "GET", body: Encodable? = nil) async throws -> T

    // Automatically adds Authorization header from AuthService
}
```

### 3. ViewModels are @Observable (iOS 17+)
Use the new `@Observable` macro, not ObservableObject:
```swift
@Observable
class LeadsViewModel {
    var leads: [Lead] = []
    var stats: Stats?
    var selectedFilter: LeadStatus? = nil
    var isLoading = false
    var error: String?

    func fetchLeads() async
    func updateStatus(leadId: String, status: LeadStatus) async
}
```

### 4. Environment for dependency injection
```swift
@main
struct SalesFlowApp: App {
    @State private var authService = AuthService()

    var body: some Scene {
        WindowGroup {
            if authService.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .environment(authService)
    }
}
```

### 5. Offline-first with SwiftData
Cache leads locally using SwiftData. On fetch, update cache. When offline, show cached data with "Last updated 5 min ago" indicator.

### 6. Location tracking
```swift
class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var currentLocation: CLLocationCoordinate2D?
    @Published var isTracking = false
    @Published var visitDuration: TimeInterval = 0

    func startVisit(leadId: String)
    func endVisit() -> VisitResponse
    func requestPermission()
}
```

## iOS Version Target
- **Minimum**: iOS 17.0
- **Reason**: @Observable macro, NavigationStack improvements, SwiftData
- This covers 95%+ of iPhones in use

## Build Configuration
- **Development**: localhost:4350
- **Production**: https://api.salesflow.co.uk (TBD)
- Use Xcode schemes or a Config.swift with #if DEBUG
