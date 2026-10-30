# Codex Blue Whale

A blue companion widget that follows the Codex desktop window: check how much of your subscription quota is left, or click it for lines and animated GIFs.

Based on [Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public), which derives from [MeteorNOX's DSH Balance Whale](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget). This is an unofficial, improved macOS build. It is not a widget embedded inside Codex: the plugin provides tools and a skill, and an Electron component draws the character and speech bubbles.

![Blue Whale character](assets/DSniang1.png)

## What this version changes

- Shows only while Codex or the widget's own menu is in the foreground. It hides when you switch apps, minimize, or enter Mission Control, and comes back when you return.
- Fixes jitter while following the window in Mission Control, and foreground detection that stopped updating after long sessions.
- The subscription page shows only "remaining quota" with two progress bars (5-hour and weekly), moved up closer to the center of the bubble.
- The second page restores DSH-style random lines and GIFs. Click the bubble to advance; click the character to return to the quota page or extend its display time. You can also set clicking the character to advance the queue.
- Tokens observed on this machine for each turn are shown separately, never mixed with account balance or subscription quota.
- Menu icons are smaller and scale with the character; small icons keep a transparent click target of at least 24px.
- Adds `codex-whale start / stop / status` commands that contain no personal paths.

Character import, sound effects, dragging, resizing, the local workshop and API mode are kept. This release was verified mainly on macOS; Windows code is kept from upstream but was not re-tested on real hardware.

## Install on macOS

Requires Node.js 24+ (with npm), the Codex desktop app, and Xcode Command Line Tools. The first install downloads Electron, so you need a network connection. This is not an offline installer or a notarized `.app`.

Download the source and unpack it into a directory you will keep, for example `~/Applications/codex-blue-whale`, then run:

```sh
node --version
npm run install:mac
npm start
```

If Swift build tools are missing, run `xcode-select --install`, finish the system prompt, and try again.

The installer compiles a window probe, ad-hoc signs Electron for this machine, and registers a LaunchAgent for the current user. After you log in to macOS, the follow service starts automatically; it does not open Codex. Before installing, it creates a private backup and a rollback receipt. Keep them on your machine and do not upload them.

Open the widget menu and choose **Codex subscription**. The public package ships without the maintainer's settings or account data, so on first use you pick the mode and character size yourself.

### Start and stop

From the source directory, run `npm start`, `npm stop`, or `npm run status`. To use short commands from any directory, run `npm link` in the source directory first:

```sh
codex-whale start
codex-whale stop
codex-whale status
```

If your global npm directory is not writable, use the commands from the source directory instead; do not add `sudo` blindly. `stop` only closes the widget. It does not quit Codex or cancel auto-start at the next login. To disable auto-start permanently, run `npm run uninstall:mac`; your settings and records are kept.

### Codex plugin

The desktop component can be installed on its own. If you also want the whale tools and skill inside Codex chats, install `api-balance-whale` from this directory through Codex's local plugin entry. This package keeps the plugin manifest, MCP entry and skill; the internal version is still 0.4.1. The plugin entry may differ between Codex versions, so start a new chat after installing to check that the tools loaded.

For the original Windows plugin install, API balance settings, and rollback flow, see the [upstream README](README-UPSTREAM.md). Upstream version tags, release permissions, and test records describe history only and do not reflect the current state of this fork.

## Quota and privacy

Subscription quota comes from official snapshots already observed in Codex sessions on this machine. It is not a real-time, complete bill for your whole account. With no snapshot it shows "unknown", and stale data is marked. The two progress bars show **remaining quota = 100% − used fraction**. Local token counts are not your remaining subscription tokens and do not cover other devices.

The default data directory is `~/.codex/whale-widget`; set `WHALE_HOME` to use a different one. The program reads related local configuration and session records to identify sources, quota and usage. It does not change your Codex model, sign-in method or API configuration in order to display quota. Subscription mode needs no API key; API mode contacts the service you configured when it queries.

The public package contains no keys, account configuration, chats, ledgers, personal absolute paths, runtime caches, test screenshots or private backups. Do not add your own data directory to Git.

## Test and package

```sh
npm test
python3 tests/release-privacy-test.py
python3 scripts/build-release.py --release-tag 'codex-v0.4.1(blue1)' --publication-ready
```

The builder produces an installer package, a source package and a SHA-256 manifest. It does not upload anything to GitHub; `--publication-ready` is a local build flag and does not mean the build was published.

The original suite of 502 automated tests passes, with 6 platform-specific tests skipped. The new public CLI uses isolated mock tests and does not reinstall the current machine during packaging. Foreground hide/restore and the Mission Control jitter fix were confirmed by the user on real hardware, and quota layout and menu scaling were checked in the actual UI. A full install on a clean macOS account, auto-start after a reboot, and Windows hardware tests have not been redone.

## Credits and license

Maintained by [junyii37](https://github.com/junyii37). This fork does not present upstream work as its own.

- DSH original author: [MeteorNOX](https://github.com/MeteorNOX)
- Codex adaptation: [Yang-huai406](https://github.com/Yang-huai406)
- Original macOS compatibility: [1llysviel's PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128), with implementation and attribution kept

Code remains under the [MIT License](LICENSE), keeping the upstream Copyright (c) 2026 MeteorNOX. Images, GIFs and sound effects ship with the widget under the upstream distribution terms; the MIT license on the code grants no additional rights to these assets, and they are not claimed as original to this fork. See [Third-party notices](THIRD_PARTY_NOTICES.md), [Attribution](docs/ATTRIBUTION.md) and [Provenance](PROVENANCE.md).

Documents under `docs/`, along with `README-UPSTREAM.md`, are upstream development records kept for provenance. They are written in Chinese and describe upstream releases, not this fork.

## Build cost

This fork was vibe-coded with OpenAI Codex. Usage was not recorded, so the figures below are a rough **estimate**, not a measurement:

| | Approx. |
| --- | --- |
| Tokens processed | ~30M–100M (mostly cached context re-reads) |
| Tokens generated | ~0.1M–0.3M |

The estimate is based on the size of the work: about 1,200 lines of code and tests changed against upstream in a codebase of roughly 34K lines, plus several rounds of on-device testing for window following and Mission Control. It is scaled from a measured session of smaller, similar work ([Clay](https://github.com/junyii37/markdown-viewer-clay): ~11M tokens processed for a ~6.5 KB theme with test renders and fixes).
