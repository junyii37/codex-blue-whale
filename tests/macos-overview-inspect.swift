import CoreGraphics
import Foundation

// Diagnostic metadata only: no window titles, pixels, input or app activation.
let rows = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
let windows = rows.compactMap { row -> [String: Any]? in
    let owner = row[kCGWindowOwnerName as String] as? String ?? ""
    guard ["Dock", "WindowManager", "Window Manager"].contains(owner) else { return nil }
    return ["owner": owner, "pid": row[kCGWindowOwnerPID as String] ?? 0,
            "id": row[kCGWindowNumber as String] ?? 0,
            "layer": row[kCGWindowLayer as String] ?? 0,
            "alpha": row[kCGWindowAlpha as String] ?? 0,
            "bounds": row[kCGWindowBounds as String] ?? [:]]
}
let data = try JSONSerialization.data(withJSONObject: windows, options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
