# Security Policy

## Supported version

This repository maintains the macOS build `codex-v0.4.1(blue1)` of Codex Blue Whale (internal plugin version 0.4.1). It was verified mainly on macOS. Windows code is kept from upstream but was not re-tested on real hardware.

For the upstream DSH web widget or the upstream Codex adaptation, report issues to those projects: [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget) and [Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public).

## Reporting a vulnerability

**Do not report security vulnerabilities in public issues.** Use GitHub private vulnerability reporting: go to this repository's **Security** tab and choose **Report a vulnerability**.

Please include, where possible:

- the affected version (`version` in `.codex-plugin/plugin.json`) and your macOS version;
- steps to reproduce or a minimal proof of concept, with any keys or ledger data redacted;
- the impact: what can be read or modified, and whether local code execution is required.

Never include real API keys, auth files, full chat logs or unredacted account screenshots.

## Scope notes

The widget reads local Codex configuration and session records on your machine to show quota and usage. Subscription mode needs no API key; API mode contacts the balance service you configured when it queries. See "Quota and privacy" in the [README](README.md).
