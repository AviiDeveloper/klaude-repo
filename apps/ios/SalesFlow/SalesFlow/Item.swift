//
//  Item.swift
//  salesflow
//
//  Created by Avii Developer on 24/03/2026.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
