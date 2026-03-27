import Foundation
import SwiftUI
import Network
import Combine

// MARK: — DemoSiteCache
// Downloads and stores demo sites locally for offline viewing.
// Each site is cached under Caches/demosites/<domain>/
// Assets (CSS, JS, images) are downloaded and URL-rewritten in the HTML.

actor DemoSiteCache {
    static let shared = DemoSiteCache()

    private let cacheRoot: URL = {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let root = caches.appendingPathComponent("demosites", isDirectory: true)
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }()

    private var inProgress: Set<String> = []

    // MARK: — Public API

    /// Returns the best local URL for a domain:
    /// 1. Downloaded cache (most up-to-date)
    /// 2. Bundled HTML file (always available, no network needed)
    /// 3. nil (need network)
    func localURL(for domain: String) -> URL? {
        // Check downloaded cache first
        let cached = siteDir(for: domain).appendingPathComponent("index.html")
        if FileManager.default.fileExists(atPath: cached.path) { return cached }
        // Fall back to bundled demo
        return bundledURL(for: domain)
    }

    /// Returns the URL of a bundled HTML file for a domain, if one exists.
    nonisolated func bundledURL(for domain: String) -> URL? {
        // Map domain prefix to bundled filename
        // e.g. "barber-co.salesflow.site" -> "barber-co"
        let filename = domain.components(separatedBy: ".").first ?? domain
        return Bundle.main.url(forResource: filename, withExtension: "html")
    }

    /// Caches the site if not already cached. Safe to call multiple times.
    func cache(domain: String) async {
        guard !inProgress.contains(domain) else { return }
        guard localURL(for: domain) == nil else { return } // already cached
        inProgress.insert(domain)
        defer { inProgress.remove(domain) }

        await downloadSite(domain: domain)
    }

    /// Force-refreshes the cache for a domain (call when online after a stale cache).
    func refresh(domain: String) async {
        clearCache(for: domain)
        await downloadSite(domain: domain)
    }

    /// True if a local cache exists for this domain.
    func isCached(domain: String) -> Bool {
        localURL(for: domain) != nil
    }

    /// Synchronous (non-actor-isolated) check of the downloaded cache only.
    /// Safe to call from UIKit/makeUIView context.
    nonisolated func localURLSync(for domain: String) -> URL? {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let safe = domain.replacingOccurrences(of: ".", with: "_")
        let index = caches
            .appendingPathComponent("demosites")
            .appendingPathComponent(safe)
            .appendingPathComponent("index.html")
        return FileManager.default.fileExists(atPath: index.path) ? index : nil
    }

    /// Removes cached files for a domain.
    func clearCache(for domain: String) {
        let dir = siteDir(for: domain)
        try? FileManager.default.removeItem(at: dir)
    }

    // MARK: — Download

    private func downloadSite(domain: String) async {
        let url = URL(string: "https://\(domain)")!
        let dir = siteDir(for: domain)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        // 1. Fetch main HTML
        guard let (htmlData, _) = try? await URLSession.shared.data(from: url),
              var html = String(data: htmlData, encoding: .utf8) ?? String(data: htmlData, encoding: .isoLatin1)
        else { return }

        // 2. Extract and download assets
        let assetURLs = extractAssetURLs(from: html, base: url)
        var urlToLocal: [String: String] = [:]

        await withTaskGroup(of: (String, String?)?.self) { group in
            for assetURL in assetURLs {
                group.addTask {
                    guard let (data, _) = try? await URLSession.shared.data(from: assetURL) else {
                        return nil
                    }
                    let filename = self.safeFilename(for: assetURL)
                    let localPath = dir.appendingPathComponent(filename)
                    try? data.write(to: localPath)
                    return (assetURL.absoluteString, filename)
                }
            }
            for await result in group {
                if let (original, local) = result {
                    urlToLocal[original] = local
                }
            }
        }

        // 3. Rewrite HTML asset references to relative local paths
        for (original, local) in urlToLocal {
            html = html.replacingOccurrences(of: original, with: local)
            // Also rewrite protocol-relative URLs
            if original.hasPrefix("https://") {
                html = html.replacingOccurrences(
                    of: original.replacingOccurrences(of: "https://", with: "//"),
                    with: local
                )
            }
        }

        // 4. Write rewritten HTML
        let indexPath = dir.appendingPathComponent("index.html")
        try? html.write(to: indexPath, atomically: true, encoding: .utf8)
    }

    // MARK: — Asset extraction

    private func extractAssetURLs(from html: String, base: URL) -> [URL] {
        var urls: [URL] = []

        // Patterns that reference external assets
        let patterns = [
            #"href=[\"']([^\"']+\.css[^\"']*)[\"']"#,
            #"src=[\"']([^\"']+\.js[^\"']*)[\"']"#,
            #"src=[\"']([^\"']+\.(?:png|jpg|jpeg|gif|webp|svg|ico)[^\"']*)[\"']"#,
            #"url\([\"']?([^\"')]+\.(?:png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot)[^\"')]*)[\"']?\)"#,
        ]

        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { continue }
            let range = NSRange(html.startIndex..., in: html)
            let matches = regex.matches(in: html, range: range)
            for match in matches {
                guard let captureRange = Range(match.range(at: 1), in: html) else { continue }
                let raw = String(html[captureRange])
                if let resolved = resolveURL(raw, base: base) {
                    urls.append(resolved)
                }
            }
        }

        return Array(Set(urls)) // deduplicate
    }

    private func resolveURL(_ raw: String, base: URL) -> URL? {
        if raw.hasPrefix("data:") || raw.hasPrefix("#") { return nil }
        if raw.hasPrefix("http://") || raw.hasPrefix("https://") {
            return URL(string: raw)
        }
        if raw.hasPrefix("//") {
            return URL(string: "https:" + raw)
        }
        return URL(string: raw, relativeTo: base)?.absoluteURL
    }

    nonisolated private func safeFilename(for url: URL) -> String {
        // Turn the URL path into a safe flat filename
        let path = url.path.replacingOccurrences(of: "/", with: "_")
        let query = url.query.map { "_\($0)" } ?? ""
        let raw = (path + query)
            .replacingOccurrences(of: "?", with: "_")
            .replacingOccurrences(of: "&", with: "_")
            .replacingOccurrences(of: "=", with: "_")
        // Preserve extension
        let ext = url.pathExtension.isEmpty ? "" : ""
        let _ = ext
        return String(raw.prefix(120))
    }

    private func siteDir(for domain: String) -> URL {
        let safe = domain.replacingOccurrences(of: ".", with: "_")
        return cacheRoot.appendingPathComponent(safe, isDirectory: true)
    }
}

// MARK: — Network monitor

final class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()
    @Published private(set) var isOnline = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isOnline = path.status == .satisfied
            }
        }
        monitor.start(queue: queue)
    }
}
