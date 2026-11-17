# Provenance, scope of changes, and license

## Lineage

1. **DSH Balance Whale** by [MeteorNOX](https://github.com/MeteorNOX) ([DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)): the original web widget, characters, images, GIFs and sounds.
2. **Codex adaptation** by [Yang-huai406](https://github.com/Yang-huai406) ([Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)): turned the widget into a Codex desktop companion with the `api-balance-whale` plugin (For-Codex v0.4 line).
3. **Original macOS compatibility** by [1llysviel](https://github.com/1llysviel) in [PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128). Its implementation and attribution are kept.
4. **This repository**, maintained by [junyii37](https://github.com/junyii37): a macOS-focused build, `codex-v0.4.1(blue1)`. See the [README](README.md) for what changed and the [changelog](CHANGELOG.md) for details.

This repository does not present upstream work as its own, and it is not an official OpenAI product or an upstream release.

## What this build changes

Foreground-only display with hide/restore, Mission Control jitter fix, refreshed foreground detection, a simplified subscription quota page, restored DSH-style lines and GIFs, separate per-turn local token hints, scaled menu icons with minimum click targets, and a `codex-whale` CLI without personal paths. Character import, sounds, dragging, resizing, the local workshop and API mode are unchanged.

## License boundaries

| Scope | License and distribution |
| --- | --- |
| Code and documentation | MIT, keeping the upstream copyright in [LICENSE](LICENSE) |
| Images, GIFs and audio in `assets/` | Distributed as-is under the upstream terms. This repository grants no sublicense, does not claim them as original, and does not extend asset rights through the code's MIT license |
| `vendor/smol-toml` | BSD-3-Clause, original license kept |
| Electron and Chromium | Downloaded at install time, with their own licenses and third-party notices |

See [Third-party notices](THIRD_PARTY_NOTICES.md).

## Privacy

Public packaging excludes personal keys, accounts, ledgers, runtime logs, real account screenshots, caches and local backups.

If you believe an asset infringes your rights, open an issue naming the file and the basis of your claim. For security issues, follow [SECURITY.md](SECURITY.md).

## Upstream records

Essential platform, protocol, attribution and limitation documents remain under `docs/`. `README-UPSTREAM.md` retains the upstream installation guide. Superseded development notes, test reports and duplicate release notes were removed from the current checkout; their original contents remain in [Git history](https://github.com/junyii37/codex-blue-whale/tree/d1316e74a05978fc014e95c7bcf9aeb247dca28e/docs). These historical records describe upstream releases, not the current build.
