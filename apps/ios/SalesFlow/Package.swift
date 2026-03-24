// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SalesFlow",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "SalesFlow", targets: ["SalesFlow"])
    ],
    targets: [
        .target(name: "SalesFlow", path: "SalesFlow")
    ]
)
