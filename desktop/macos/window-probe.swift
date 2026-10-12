import AppKit
import CoreGraphics
import Darwin
import Foundation

struct Options {
    var bundleIDs: Set<String>
    var appPath: String?
    var intervalMilliseconds = 16
    var once = false
}

func optionValues(_ name: String) -> [String] {
    var values: [String] = []
    var index = 1
    while index < CommandLine.arguments.count {
        if CommandLine.arguments[index] == name, index + 1 < CommandLine.arguments.count {
            values.append(CommandLine.arguments[index + 1])
            index += 2
            continue
        }
        index += 1
    }
    return values
}

func parseOptions() -> Options {
    let environment = ProcessInfo.processInfo.environment
    var identifiers = optionValues("--bundle-id").flatMap {
        $0.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
    }
    if identifiers.isEmpty, let configured = environment["WHALE_CODEX_BUNDLE_ID"], !configured.isEmpty {
        identifiers = configured.split(separator: ",").map { String($0).trimmingCharacters(in: .whitespaces) }
    }
    if identifiers.isEmpty {
        identifiers = ["com.openai.codex"]
    }
    let interval = optionValues("--interval-ms").last.flatMap(Int.init) ?? 16
    return Options(
        bundleIDs: Set(identifiers.filter { !$0.isEmpty }),
        appPath: optionValues("--app-path").last ?? environment["WHALE_CODEX_APP_PATH"],
        intervalMilliseconds: max(8, interval),
        once: CommandLine.arguments.contains("--once")
    )
}

func expectedApplicationPaths(_ options: Options) -> Set<String> {
    var paths = Set<String>()
    if let appPath = options.appPath {
        paths.insert(URL(fileURLWithPath: appPath).standardizedFileURL.path)
    }
    for bundleID in options.bundleIDs {
        if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) {
            paths.insert(url.standardizedFileURL.path)
        }
    }
    if options.bundleIDs.contains("com.openai.codex") {
        paths.insert("/Applications/ChatGPT.app")
    }
    return paths
}

func executablePath(_ pid: pid_t) -> String? {
    var buffer = [CChar](repeating: 0, count: 4096)
    let length = proc_pidpath(pid, &buffer, UInt32(buffer.count))
    guard length > 0 else { return nil }
    return String(cString: buffer)
}

func matchingProcessIDs(_ options: Options) -> [pid_t] {
    let expectedPaths = expectedApplicationPaths(options)
    let estimatedBytes = proc_listpids(UInt32(PROC_ALL_PIDS), 0, nil, 0)
    let capacity = max(64, Int(estimatedBytes) / MemoryLayout<pid_t>.size + 32)
    var pids = [pid_t](repeating: 0, count: capacity)
    let bytes = pids.withUnsafeMutableBytes { buffer in
        proc_listpids(UInt32(PROC_ALL_PIDS), 0, buffer.baseAddress, Int32(buffer.count))
    }
    guard bytes > 0 else { return [] }
    let count = Int(bytes) / MemoryLayout<pid_t>.size
    return pids.prefix(count).filter { pid in
        guard pid > 0, let executable = executablePath(pid) else { return false }
        if expectedPaths.contains(where: { executable.hasPrefix($0 + "/Contents/MacOS/") }) {
            return true
        }
        return options.bundleIDs.contains("com.openai.codex")
            && executable.contains("/ChatGPT.app/Contents/MacOS/")
    }
}

struct HostWindow {
    let windowNumber: UInt32
    let ownerPID: pid_t
    let bounds: CGRect
}

// BEGIN overview policy (also exercised by the native regression test).
func overviewIsActive(_ rawWindows: [[String: Any]]) -> Bool {
    var dock18 = 0, dock20 = 0
    for info in rawWindows {
        let owner = info[kCGWindowOwnerName as String] as? String ?? ""
        let layer = info[kCGWindowLayer as String] as? Int ?? 0
        let alpha = info[kCGWindowAlpha as String] as? Double ?? 1
        guard alpha > 0.01 else { continue }
        // Observed on this Mac running macOS 27: WindowManager's layer-19
        // overview surface, not its permanent negative-layer desktop surface.
        if owner == "WindowManager" || owner == "Window Manager" {
            if layer == 19,
               let bounds = info[kCGWindowBounds as String] as? NSDictionary,
               let width = bounds["Width"] as? CGFloat,
               let height = bounds["Height"] as? CGFloat,
               width >= 320, height >= 200 { return true }
        }
        // Older macOS versions expose the overview through Dock. A single
        // layer-20 tracking surface is not enough (it exists outside overview).
        if owner == "Dock" {
            if layer == 18 { dock18 += 1 }
            if layer == 20 { dock20 += 1 }
        }
    }
    return dock18 > 0 && dock20 > 0
}

struct OverviewGuard {
    var suspended = false
    var candidate: String?
    var stableSince = 0.0
    mutating func update(active: Bool, geometry: String?, now: Double) -> Bool {
        if active {
            suspended = true
            candidate = nil
            stableSince = now
            return true
        }
        guard suspended else { return false }
        guard let geometry else {
            candidate = nil
            stableSince = now
            return true
        }
        if geometry != candidate {
            candidate = geometry
            stableSince = now
        }
        if now - stableSince >= 0.35 { suspended = false }
        return suspended
    }
}

func companionMayShow(hostFrontmost: Bool, companionFrontmost: Bool, overviewSuspended: Bool) -> Bool {
    return !overviewSuspended && (hostFrontmost || companionFrontmost)
}
// END overview policy

func hostWindow(for processIDs: [pid_t], in rawWindows: [[String: Any]]) -> HostWindow? {
    let processIDs = Set(processIDs)
    guard !processIDs.isEmpty else { return nil }

    let candidates: [HostWindow] = rawWindows.compactMap { info in
        guard let ownerPID = info[kCGWindowOwnerPID as String] as? pid_t,
              processIDs.contains(ownerPID),
              let windowNumber = info[kCGWindowNumber as String] as? UInt32,
              let boundsDictionary = info[kCGWindowBounds as String] as? NSDictionary,
              let x = boundsDictionary["X"] as? CGFloat,
              let y = boundsDictionary["Y"] as? CGFloat,
              let width = boundsDictionary["Width"] as? CGFloat,
              let height = boundsDictionary["Height"] as? CGFloat
        else { return nil }
        let bounds = CGRect(x: x, y: y, width: width, height: height)
        let layer = info[kCGWindowLayer as String] as? Int ?? 0
        let alpha = info[kCGWindowAlpha as String] as? Double ?? 1
        let onscreen = info[kCGWindowIsOnscreen as String] as? Bool ?? true
        guard layer == 0, alpha > 0.01, onscreen,
              bounds.width >= 320, bounds.height >= 200
        else { return nil }
        return HostWindow(windowNumber: windowNumber, ownerPID: ownerPID, bounds: bounds)
    }

    let frontmostPID = NSWorkspace.shared.frontmostApplication?.processIdentifier
    return candidates.first(where: { $0.ownerPID == frontmostPID }) ?? candidates.first
}

func emit(_ state: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0a]))
}

let options = parseOptions()
var lastWindowNumber: UInt32 = 0
var lastOwnerPID: pid_t = 0
var lastBounds = CGRect.zero
var lastEncoded = ""
var lastHeartbeat = Date.distantPast
var cachedProcessIDs: [pid_t] = []
var lastProcessScan = Date.distantPast
var overviewGuard = OverviewGuard()

while true {
    autoreleasepool {
        if Date().timeIntervalSince(lastProcessScan) >= 0.25 {
            cachedProcessIDs = matchingProcessIDs(options)
            lastProcessScan = Date()
        }
        let processIDs = cachedProcessIDs
        let rawWindows = CGWindowListCopyWindowInfo(
            [.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID
        ) as? [[String: Any]] ?? []
        let observedWindow = hostWindow(for: processIDs, in: rawWindows)
        let overviewActive = overviewIsActive(rawWindows)
        let geometry = observedWindow.map { "\($0.windowNumber):\($0.bounds)" }
        if processIDs.isEmpty { overviewGuard = OverviewGuard() }
        let overviewSuspended = overviewGuard.update(
            active: overviewActive, geometry: geometry, now: ProcessInfo.processInfo.systemUptime
        )
        let frontmost = NSWorkspace.shared.frontmostApplication
        let hostFrontmost = processIDs.contains(frontmost?.processIdentifier ?? 0)
        let companionFrontmost = frontmost?.bundleIdentifier == "com.api-balance-whale.codex.desktop"
        let eligible = companionMayShow(hostFrontmost: hostFrontmost,
                                        companionFrontmost: companionFrontmost,
                                        overviewSuspended: overviewSuspended)
        // Freeze accepted coordinates while hidden. Never feed overview's
        // thumbnail transformations back into the overlay's own geometry.
        let window = eligible ? observedWindow : nil
        if let window {
            lastWindowNumber = window.windowNumber
            lastOwnerPID = window.ownerPID
            lastBounds = window.bounds
        }

        let hostAlive = !processIDs.isEmpty
        let visible = hostAlive && window != nil
        let bounds = window?.bounds ?? lastBounds
        let scale = window.flatMap { _ in NSScreen.main?.backingScaleFactor } ?? NSScreen.main?.backingScaleFactor ?? 1
        var state: [String: Any] = [
            "hostAlive": hostAlive,
            "hostPid": window?.ownerPID ?? lastOwnerPID,
            "window": String(window?.windowNumber ?? lastWindowNumber),
            "visible": visible,
            "attached": visible,
            "hostFrontmost": hostFrontmost,
            "companionFrontmost": companionFrontmost,
            "overviewActive": overviewActive,
            "overviewSuspended": overviewSuspended,
            "nativeFollowing": false,
            "followMode": "macos-cgwindow-poll",
            "dpi": 72.0 * scale,
            "bounds": [
                "x": Double(bounds.origin.x),
                "y": Double(bounds.origin.y),
                "width": Double(bounds.width),
                "height": Double(bounds.height)
            ],
            "bundleId": hostAlive ? (options.bundleIDs.first ?? "unknown") : NSNull()
        ]
        if ProcessInfo.processInfo.environment["WHALE_PROBE_DEBUG"] == "1" {
            state["processIds"] = processIDs
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: state, options: [.sortedKeys])
            let encoded = String(data: data, encoding: .utf8) ?? ""
            let now = Date()
            if encoded != lastEncoded || now.timeIntervalSince(lastHeartbeat) >= 1 {
                try emit(state)
                lastEncoded = encoded
                lastHeartbeat = now
            }
        } catch {
            FileHandle.standardError.write(Data("window probe serialization failed\n".utf8))
        }
    }

    if options.once { break }
    // NSWorkspace refreshes its frontmostApplication through workspace events.
    // Sleeping this thread starves those events, leaving a long-lived probe
    // pinned to the app that was frontmost when it first started. Pump the main
    // run loop between samples; keep the polling interval and overview guard.
    RunLoop.current.run(until: Date(timeIntervalSinceNow: Double(options.intervalMilliseconds) / 1000.0))
}
