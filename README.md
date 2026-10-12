# Codex 蓝色大肥鱼 · Blue Whale

跟随 Codex 窗口的蓝色伴随挂件：看订阅剩余额度，点一下看台词和动图。

基于 [Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)，源自 [MeteorNOX 的 DSH 大肥鱼](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)。这是非官方的 macOS 改进版，不是 Codex 内嵌控件：插件提供工具和技能，Electron 组件负责角色与气泡。

![蓝色大肥鱼角色](assets/DSniang1.png)

## 这一版改了什么

- 只在 Codex 或挂件自己的菜单处于前台时显示，切换应用、最小化或进入调度中心时隐藏，回来后恢复。
- 修复调度中心里的跟随抖动，以及长时间运行后前台识别不更新的问题。
- 订阅第一页只显示“剩余额度”和 5 小时、每周两条进度条；整组上移，更接近气泡中心。
- 第二页恢复 DSH 风格的随机台词和动图。点击气泡推进，点角色回到额度页或续时；也可设置点角色推进队列。
- 每轮本机已观测 token 单独提示，不与账户余额或订阅额度混在一起。
- 菜单图标缩小并随角色缩放，小图标保留至少 24px 的透明点击区域。
- 提供不含个人路径的 `codex-whale start / stop / status` 命令。

角色导入、音效、拖动、缩放、本地工坊和 API 模式保留。此次主要验证 macOS；Windows 保留上游代码，未重新进行 Windows 实机验收。

## macOS 安装

需要 Node.js 24+（含 npm）、Codex 桌面应用，以及 Xcode Command Line Tools。首次安装要联网下载 Electron；这不是离线安装包，也不是已公证的 `.app`。

下载源码并解压到长期保留的目录，例如 `~/Applications/codex-blue-whale`，进入目录执行：

```sh
node --version
npm run install:mac
npm start
```

若缺少 Swift 编译工具，先执行 `xcode-select --install`，按系统提示完成后重试。

安装器会编译窗口探针、对 Electron 做本机 ad-hoc 签名，并注册当前用户的 LaunchAgent。登录 macOS 后自动启动跟随服务，不会自动打开 Codex。安装前会生成私有备份与回滚回执，请保存在本机，不要上传。

打开挂件菜单，选择 **Codex 订阅**。公开包不带维护者的设置和账户信息，首次使用需自行选择模式、角色大小。

### 启动和关闭

在源码目录执行 `npm start`、`npm stop`、`npm run status`。想在任意目录使用短命令，可先在源码目录执行 `npm link`：

```sh
codex-whale start
codex-whale stop
codex-whale status
```

如果 npm 全局目录不可写，用源码目录的命令即可，不要盲目加 `sudo`。`stop` 只关闭挂件，不退出 Codex，也不取消下次登录自启。永久停用自启用 `npm run uninstall:mac`；设置和记录会保留。

### Codex 插件

桌面组件可独立安装。如需聊天里的鲸鱼工具和技能，再通过 Codex 的本地插件入口安装本目录中的 `api-balance-whale`；本包保留插件清单、MCP 入口与技能，内部版本仍为 0.4.1。不同 Codex 版本的入口可能不同，安装后新建聊天检查工具是否加载。

原版 Windows 插件安装、API 余额设置与回滚流程见 [上游说明](README-UPSTREAM.md)。上游旧版本标签、发布权限与测试记录仅描述历史，不代表本分支当前状态。

## 额度与隐私

订阅额度来自本机 Codex 会话中已观测到的官方快照，不是整个账户的实时完整账单。没有快照显示未知，过期会标记。两条进度条表示 **剩余额度 = 100% − 已用比例**；本机 token 统计不是订阅剩余 token，也不覆盖其他设备。

默认数据目录为 `~/.codex/whale-widget`，可通过 `WHALE_HOME` 指定独立目录。程序读取相关本机配置与会话记录用于识别来源、额度和用量，不为显示额度修改 Codex 模型、登录方式或 API 配置。订阅模式不需要另填 API key；API 模式主动查询时会访问你配置的服务。

公开包不含密钥、账户配置、聊天、账本、个人绝对路径、运行时缓存、测试截图和私有备份。不要把自己的数据目录加入 Git。

## 测试和打包

```sh
npm test
python3 tests/release-privacy-test.py
python3 scripts/build-release.py --release-tag 'codex-v0.4.1(blue1)' --publication-ready
```

构建器生成安装包、源码包与 SHA-256 清单，不会上传 GitHub；`--publication-ready` 是本地构建标记，不代表已经发布。

原安装的 502 项自动测试通过，6 项平台相关测试跳过；新增公开版 CLI 使用隔离模拟测试，不在打包时重装当前机器。前台隐藏/恢复及调度中心防抖已获用户实机确认，额度位置和菜单缩放已检查实际界面。未用干净 macOS 账户完整安装或重启机器验收自启，未重新执行 Windows 实机测试。

## 来源与许可

开源维护：[junyii37](https://github.com/junyii37)。本分支不将上游工作改称为原创。

- DSH 原作者：[MeteorNOX](https://github.com/MeteorNOX)。
- Codex 适配：[Yang-huai406](https://github.com/Yang-huai406)。
- macOS 原始兼容：[1llysviel 的 PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)，保留实现与署名。

代码沿用 [MIT License](LICENSE)，保留上游 Copyright (c) 2026 MeteorNOX。图片、动图和音效继续按上游分发边界随挂件提供；代码 MIT 不额外授予素材权利，也不声明媒体为本分支原创。见 [第三方声明](THIRD_PARTY_NOTICES.md)、[署名](docs/ATTRIBUTION.md) 和 [历史来源](PROVENANCE.md)。
