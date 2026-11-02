# Development Guide

## Prerequisites

- **Node.js** 22 or higher
- **bun** — Package manager & runtime ([install](https://bun.sh))
- **Rust stable + Cargo** — Only required when building the local backend from source ([install](https://rustup.rs))
- **Python** 3.11+ (for native module compilation)
- **prek** — PR code checker (`npm install -g @j178/prek`)

On Windows, install the Rust MSVC toolchain. If Rust compilation fails because native build tools are missing, install **Microsoft C++ Build Tools** from the Visual Studio installer, then reopen your terminal.

## Repository Layout

AionUi development uses two repositories:

- **BadouWorkCore** (`https://github.com/zhaolinzhi/BadouWorkCore`) builds the local backend binary: `aioncore` on macOS/Linux and `aioncore.exe` on Windows. The exact version is pinned by `aioncoreVersion` in the repo-root `package.json`.
- **AionUi** (`https://github.com/iOfficeAI/AionUi.git`) starts the Electron desktop app and launches the backend binary automatically.

Keep the repositories side by side when possible:

```text
workspace/
|-- BadouWorkCore/
`-- AionUi/
```

### 后端二进制从哪来

后端二进制有**两个来源**，开发时优先用第一个：

| 顺序 | 来源                                                    | 什么时候有                                                                                     |
| ---- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1    | `resources/bundled-aioncore/<platform>-<arch>/aioncore` | `node scripts/prepareAioncore.js` 准备好之后（**gitignore 的构建缓存**，dev 与打包都从这儿取） |
| 2    | `PATH` 上的 `aioncore`                                  | 随包整包不在时的兜底 —— **可能不是同一条谱系**                                                 |

> ⚠️ **两个来源必须同一条迁移谱系。**
> 本仓库 pin 的是 `zhaolinzhi/BadouWorkCore`；上游 `iOfficeAI/AionCore` 是**另一条** ——
> 两边的 sqlx migration 编号与内容都不同，混用会在启动时报
> `migration 38 was previously applied but been modified`，
> 界面上只显示成「本地数据迁移失败」，重装应用治不了（库里记的 checksum 不会变）。
> 排查见[后端启动疑难](#backend-startup-troubleshooting)。

`resources/bundled-aioncore/` 是**构建缓存**：`git clean -xfd`、构建中断、手误删都会清空它。
清空之后应用会退到 PATH 上的二进制 —— `bun run dev:all` 现在会在拉起任何进程之前先查一遍并提示，
单独起主应用则会在解析后端时打一条 warn。两条提示都指向同一个恢复命令：`node scripts/prepareAioncore.js`。

## Quick Start

### 1. 克隆两个仓库

```bash
git clone https://github.com/zhaolinzhi/BadouWorkCore.git
git clone https://github.com/iOfficeAI/AionUi.git
```

只有打算自己编后端时才需要克隆后端仓库 —— 第 2 步会直接下载现成的整包。
两个仓库默认都用 `main` 分支，除非维护者让你试别的分支。

### 2. 准备后端二进制

后端二进制（`aioncore`）必须与本仓库**同一条迁移谱系** —— 本仓库 pin 的是
`zhaolinzhi/BadouWorkCore`，版本由仓库根 `package.json` 的 `aioncoreVersion` 决定。

最省事的做法是直接拉整包（脚本按 pin 好的版本取，并写好 `manifest.json` 与 `managed-resources/`）：

```bash
cd AionUi
node scripts/prepareAioncore.js
```

产物在 `resources/bundled-aioncore/<platform>-<arch>/`（**gitignore 的构建缓存**）。

没有外网、或者本机装过同版本应用时，让脚本复用本机已有的整包：

```bash
# macOS —— 复用已安装应用里的那份
AIONUI_BACKEND_LOCAL_BUNDLE_DIR="/Applications/BadouWorklocal.app/Contents/Resources/bundled-aioncore/darwin-x64" \
  node scripts/prepareAioncore.js
```

> 这个环境变量会**跳过版本校验**，用之前自己核对 `manifest.json` 的 `version`
> 与 `package.json` 的 `aioncoreVersion` 一致。

准备完验一下：

```bash
ls resources/bundled-aioncore/*/   # 应看到 aioncore、manifest.json、managed-resources/
```

#### 只有要改后端源码时才需要自己编

```bash
cd BadouWorkCore            # ⚠️ 必须是 zhaolinzhi/BadouWorkCore，别用上游 iOfficeAI/AionCore
cargo clean
cargo install --path crates/aionui-app --locked

# macOS / Linux：让 cargo 装出来的二进制在 PATH 上
export PATH="$HOME/.cargo/bin:$PATH"
which aioncore && aioncore --help
```

Windows PowerShell：

```powershell
cd BadouWorkCore
cargo clean
cargo install --path crates/aionui-app --locked

$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
where.exe aioncore
aioncore --help
```

> ⚠️ **自编的二进制落在 PATH 上，是兜底来源。** `resources/bundled-aioncore/` 还在时，
> 应用用的是整包里那份，不是你刚编的 —— 想让改动生效，得把整包换成新的，
> 或者把整包挪开让它退到 PATH 上那份。两种做法见
> [后端改了不生效](#后端改了不生效)。
>
> 另外**别编错仓库**：上游 `iOfficeAI/AionCore` 是另一条迁移谱系，
> 混用会在启动时直接报 checksum 冲突（界面上是「本地数据迁移失败」）。

### 3. 启动 AionUi

在 `AionUi` 仓库里执行：

```bash
cd AionUi

# 安装依赖
bun install

# 以开发模式启动 Electron 桌面应用
bun run start
```

启动时 AionUi 会自己拉起 `aioncore`，并把后端端口传给渲染进程 —— **不用另开终端起后端**。

## Updating the Local Backend

改动后端源码后，重建二进制并重启 AionUi：

```bash
cd ../BadouWorkCore
cargo install --path crates/aionui-app --locked --force

cd ../AionUi
bun run start
```

用 `--force` 是为了强制覆盖已安装的二进制 —— 否则 Cargo 可能留着旧的那份。

> ⚠️ **只 `cargo install` 看不到效果。** dev 优先用 `resources/bundled-aioncore/` 里那份，
> 不是 PATH 上这份 —— 要么把整包换成新编的，要么把整包挪开让它退到 PATH。
> 两种做法见 [后端改了不生效](#后端改了不生效)。

## Backend Startup Troubleshooting

### 界面报「本地数据迁移失败」（migration checksum 冲突）

**症状**：启动时弹「本地数据迁移失败」，后端日志里有
`migration 38 was previously applied but been modified`（或别的编号）。

**原因**：用的后端二进制**不是本仓库 pin 的那一条迁移谱系**。本仓库 pin 的是
`zhaolinzhi/BadouWorkCore`（`package.json` 的 `aioncoreVersion`），上游 `iOfficeAI/AionCore`
是另一条 —— 两边的 sqlx migration 编号与内容都不同，对着同一个数据目录跑必然对不上 checksum。

**排查**：先看用的是哪一个二进制。

```bash
ls resources/bundled-aioncore/*/   # 随包整包在不在
which aioncore                     # PATH 上那份是哪来的
```

**修法**：把随包整包准备好。

```bash
node scripts/prepareAioncore.js
```

> ⚠️ **重装应用治不了。** 库里记的 migration checksum 不会因为重装而变，冲突照样报。
> **也别删数据目录** —— 删掉确实能绕开冲突，但本地 dev 数据会一起没。

### `dev:all` 启动前的预检

`bun run dev:all` 在拉起任何进程之前先查 `resources/bundled-aioncore/<platform>-<arch>/aioncore`：

| 情况                    | 行为                                                         |
| ----------------------- | ------------------------------------------------------------ |
| 整包在                  | 照常启动，不打扰                                             |
| 整包不在、PATH 上也没有 | 直接退出（exit 1），提示跑 `node scripts/prepareAioncore.js` |
| 整包不在、PATH 上有     | 警告后继续，并提示「若不是同一谱系会报 migration 冲突」      |

单独起主应用（`bun run dev`）没有这道预检 —— 它会在**解析后端时**打一条 warn
（`[aioncore] 没找到随包后端…`），内容与上表第三行相同。

### 找不到 aioncore 二进制

随包整包与 `PATH` 上都没找到后端二进制。

在启动 AionUi 的同一个终端里查：

```bash
# macOS / Linux
which aioncore

# Windows PowerShell
where.exe aioncore
```

查不到就把 Cargo 的二进制目录加进 `PATH`，另开一个终端再启动 AionUi。
但更推荐 `node scripts/prepareAioncore.js` —— 它放进去的是**pin 好的那一版谱系**，
而不是 `PATH` 上碰巧存在的那个。

### 终端里能跑 aioncore，应用却找不到

确认启动 `bun run start` 的那个终端环境也能跑 `aioncore --help`。IDE 的终端与从图形界面
拉起的 shell 继承到的 `PATH` 可能不一样 —— 改完 `PATH` 后重启 IDE，或从终端里启动。

### 后端改了不生效

dev 时应用优先用 `resources/bundled-aioncore/<platform>-<arch>/aioncore` ——
**整包还在时，PATH 上那份自编的二进制根本不会被执行**，所以 `cargo install --force` 之后
看不到变化是正常的。要让新二进制生效，得把它换进整包：

```bash
# 在 BadouWorkCore 仓库里先编出新的
cargo install --path crates/aionui-app --locked --force

# 再用它重建整包（会重新准备 managed-resources，需要联网）
AIONUI_BACKEND_LOCAL_BINARY="$HOME/.cargo/bin/aioncore" node scripts/prepareAioncore.js
```

或者把整包挪开，让应用退到 PATH 上那份（启动时会打 warn 说明在用兜底来源）：

```bash
mv resources/bundled-aioncore resources/bundled-aioncore.bak
```

> 整包挪走之后记得挪回来 —— `build:all` 打包要用它。
>
> 应用在开发期自己持有后端子进程，所以**必须先退出 AionUi 再重启**，
> 正在跑的实例不会换二进制。

### Windows 上 Rust 编译报错

用 Rust MSVC 工具链，并安装 Microsoft C++ Build Tools。装完或换了工具链之后，
另开一个 PowerShell 窗口重新跑后端的安装命令。

## Scripts Reference

### Development

| Command                     | Description                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `bun start`                 | Start Electron app in development mode (desktop)                                                               |
| `bun run dev`               | Alias for `bun start`                                                                                          |
| `bun run dev:all`           | Start the desktop app plus every micro app dev server in one command                                           |
| `bun run start:multi`       | Start a second Electron instance alongside an existing one (see [Multi-Instance](#multi-instance-development)) |
| `bun run cli`               | Alias for `bun start`                                                                                          |
| `bun run webui`             | Start in WebUI mode (browser-based, no Electron window)                                                        |
| `bun run webui:remote`      | Start in WebUI mode with remote access enabled                                                                 |
| `bun run webui:prod`        | Start WebUI in production mode                                                                                 |
| `bun run webui:prod:remote` | Start WebUI in production mode with remote access                                                              |
| `bun run resetpass`         | Reset user password via CLI                                                                                    |

### Build & Distribution

| Command                   | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `bun run package`         | Build all processes (main, preload, renderer) to `out/`             |
| `bun run make`            | Alias for `bun run package`                                         |
| `bun run dist`            | Build and package distributable for current platform                |
| `bun run dist:mac`        | Build distributable for macOS                                       |
| `bun run dist:win`        | Build distributable for Windows                                     |
| `bun run dist:linux`      | Build distributable for Linux                                       |
| `bun run build-mac`       | Build macOS distributable (architectures chosen by host)            |
| `bun run build-mac:arm64` | Build macOS distributable for Apple Silicon only                    |
| `bun run build-mac:x64`   | Build macOS distributable for Intel only                            |
| `bun run build-win`       | Build Windows distributable (architectures chosen by host)          |
| `bun run build-win:arm64` | Build Windows distributable for ARM64                               |
| `bun run build-win:x64`   | Build Windows distributable for x64                                 |
| `bun run build-deb`       | Build Linux (.deb) distributable                                    |
| `bun run build`           | Alias for `bun run build-mac`                                       |
| `bun run build:all`       | Same as `build`, but also bundle every micro app into the installer |
| `bun run build:offline`   | Same as `build:all`, but for hosts that cannot reach GitHub         |

#### Building Without GitHub Access

`build:all` reaches the network three times: the aioncore backend binary, the AionHub
resources, and the Electron distribution. On a host behind a firewall that blocks GitHub
(`curl https://github.com` times out) each of those fails, and the build stops at the first
one. `build:offline` is the same command with the three network steps pointed at sources
that are reachable:

```bash
AIONUI_HUB_SKIP=1 ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ bun run build:all
```

- `AIONUI_HUB_SKIP=1` skips the AionHub download. The script deletes `resources/hub/`
  **before** it downloads, so restore it from a previously built app first if you want the
  offline hub fallback in the installer — otherwise the installer ships without it.
- `ELECTRON_MIRROR` points electron-builder at a mirror for the Electron zip and its
  `SHASUMS256.txt`. The checksum file is fetched on every build even when the zip is
  already cached, so this one is required even with a warm cache.
- aioncore needs no flag. `prepareAioncore` reuses a **complete** bundle that already
  exists on this machine instead of downloading: the repo cache at
  `resources/bundled-aioncore/<platform>-<arch>/`, or the copy shipped inside an
  installed app (`/Applications/BadouWorklocal.app/Contents/Resources/bundled-aioncore/…`
  on macOS, `…\resources\bundled-aioncore\…` on Windows). A bundle is only used when its
  `manifest.json` records the **same version** the build asks for — shipping a stale
  backend is worse than a failed build. `AIONUI_BACKEND_LOCAL_BUNDLE_DIR` points it at a
  bundle directory explicitly, bypassing the version check.

  Reusing a bundle also skips `prepareManagedResources`, which otherwise wipes
  `managed-resources/` and re-downloads ~100 MB of Node runtime on every single build.

#### Where the Output Lands

`packages/desktop/electron-builder.yml` sets `directories.output: out`, so **the installers land in `out/` alongside the compiled processes** — there is no separate `release/` directory. Expect roughly this layout after `bun run build-mac`:

```text
out/
├── main/                  # main process bundle (electron-vite)
├── preload/               # preload bundle
├── renderer/              # renderer bundle (+ microapps/ when bundling)
├── mac/                   # unpacked .app — see the note below on this name
├── BadouWorklocal-<version>-mac-arm64.dmg
├── BadouWorklocal-<version>-mac-arm64.zip
├── BadouWorklocal-<version>-mac-x64.dmg
└── BadouWorklocal-<version>-mac-x64.zip
```

The unpacked `.app` directory is named `mac` when a single architecture was built and `mac-<arch>` when several were — do not hard-code either. `findAppDir` in `scripts/build-with-builder.js` probes `mac`, `mac-arm64`, `mac-x64`, and `mac-universal` in that order for exactly this reason. Apple Silicon hosts therefore see `out/mac/`, while Intel hosts building both architectures see `out/mac-arm64/` and `out/mac-x64/`.

| Platform | Targets      | Artifacts                                       |
| -------- | ------------ | ----------------------------------------------- |
| macOS    | `dmg`, `zip` | `BadouWorklocal-<version>-mac-<arch>.{dmg,zip}` |
| Windows  | `nsis`       | `BadouWorklocal-<version>-win-<arch>.exe`       |
| Linux    | `deb`        | `BadouWorklocal-<version>-linux-<arch>.deb`     |

Names follow `artifactName: ${productName}-${version}-${os}-${arch}.${ext}` in the same config file; `productName` is `BadouWorklocal`.

**Backend binaries do not land in `out/`.** `prepareAioncore` downloads them into `resources/bundled-aioncore/<platform>-<arch>/` (gitignored), and electron-builder ships that directory through `extraResources` — inside the installed app it ends up at `Contents/Resources/bundled-aioncore/` on macOS and `resources/bundled-aioncore/` on Windows. `resources/hub/` follows the same route.

Because `extraResources` copies that directory **whole**, with no per-arch filtering, two things matter:

- Every architecture being packaged gets prepared, not just the primary one. A multi-arch build calls `prepareAioncore` for each target arch, so the x64 installer on an Apple Silicon host has its own `darwin-x64/` bundle instead of relying on whatever was already on disk.
- Remnants from an earlier or failed build are pruned before packaging. A failed prepare stops before fetching managed resources, leaving a directory that holds only `aioncore` — no `manifest.json`, no `managed-resources/` — which would otherwise add ~96 MB of dead weight to every installer and leave a directory that exists but cannot run. The logic is in [`prune-stale-aioncore-bundles.js`](../../packages/shared-scripts/src/prune-stale-aioncore-bundles.js); pruning never inspects content, because an architecture the host cannot execute could never be validated by running prepare.

CI is unaffected: each of its macOS/Windows jobs builds a single architecture, so the prune removes nothing there.

Only one other output directory exists: `out-fast-builds/`, written exclusively by `scripts/build-fast-debug-versions.ps1` for bulk Windows debug builds.

`out/` and `out-fast-builds/` are both gitignored. `electron-vite build` clears `out/` on every run, so a stale installer from a previous build does not survive — and micro app output copied in by `build:all` is wiped by the next plain `bun run build`.

#### Repackaging Without Rebuilding

If `out/main`, `out/preload`, and `out/renderer` are already populated — for example a full `bun run build:all` just finished but electron-builder failed, or you only need to change packaging options — call electron-builder directly instead of re-running the whole script. This skips `prepareAioncore`, which otherwise re-executes the backend binary to re-download ~100 MB of managed resources every single time (it is not cached).

A `prepareAioncore` run that finds a complete bundle on disk — the repo cache or an installed app's copy — reuses it and skips that download entirely, so the "re-download every time" cost only applies to a bundle that is missing or incomplete.

```bash
# macOS, host architecture only
bunx electron-builder --config packages/desktop/electron-builder.yml --mac --publish=never

# Pin to one architecture
bunx electron-builder --config packages/desktop/electron-builder.yml --mac --x64 --publish=never

# Windows / Linux
bunx electron-builder --config packages/desktop/electron-builder.yml --win --publish=never
bunx electron-builder --config packages/desktop/electron-builder.yml --linux --publish=never
```

- `--publish=never` is **not optional** — without it electron-builder tries to publish to GitHub Releases.
- `--config` points at `packages/desktop/`, not the repository root.
- This produces exactly the same artifacts as `build-with-builder.js`, which builds this same command internally and only adds a `--prepackaged` retry for the case where the `.app` is built but DMG creation failed.
- Requirements: `out/main`, `out/preload`, and `out/renderer` must all exist, and `resources/bundled-aioncore/<platform>-<arch>/` must already contain `aioncore`, `manifest.json`, and a populated `managed-resources/` — electron-builder ships the last one through `extraResources`.

#### Running an Unsigned macOS Build Locally

Local builds are unsigned unless a certificate is available. With none, electron-builder logs a warning and skips signing rather than failing:

```bash
security find-identity -v -p codesigning   # "0 valid identities found" means unsigned
```

macOS will refuse to open an unsigned app downloaded via a browser quarantine attribute. Locally built artifacts are unaffected, but anything shared or downloaded needs one of:

```bash
# Drag to /Applications, then right-click → Open (one-time per machine)
# or remove the quarantine attribute from the command line
xattr -dr com.apple.quarantine /Applications/BadouWorklocal.app
```

The `.zip` artifact sidesteps this entirely — unzip and double-click, no Gatekeeper prompt. Prefer it for local debugging. Note that an x64 build runs only on Intel Macs; arm64 users need an arm64 package, since Rosetta 2 emulation is one-directional.

#### Micro Apps

`build` and `build:all` embed the micro apps under `packages/microapps/` into the installer (`out/renderer/microapps/`), and inject `VITE_MICRO_APP_ENABLED=true` plus a `app://microapps` asset base so the packaged app can load them offline. `build:all` always does a full renderer rebuild — the incremental cache keys on a source hash that cannot see those injected env vars, so a cached bundle would carry `VITE_MICRO_APP_ENABLED=false`.

`build:all` currently targets macOS. To embed micro apps in a Windows or Linux installer, set the flag manually:

```bash
# Windows (PowerShell / cmd)
set MICRO_APP_BUNDLE=1 && bun run build-win

# macOS / Linux
MICRO_APP_BUNDLE=1 bun run build-win
```

#### Architectures Chosen by the Build Host

`build`, `build-mac`, `build-win`, `build-deb`, and `build:all` pass no architecture flags — the build script picks them from `process.arch`:

| Build host        | Architectures produced | Why                              |
| ----------------- | ---------------------- | -------------------------------- |
| Intel Mac         | x64 only               | cannot execute arm64 binaries    |
| Apple Silicon Mac | arm64 + x64            | Rosetta 2 runs x86_64 binaries   |
| x64 Windows       | x64 only               | cannot execute arm64 executables |
| Windows on ARM    | arm64 + x64            | system-level x64 emulation       |

This is a hard constraint, not a preference: the build executes the _target_ architecture's `aioncore` binary to download managed resources, which include an architecture-specific Node runtime (for example `node-v24.11.0-darwin-x64`). A host that cannot run it fails with `EBADARCH` (-86). The `:arm64` / `:x64` scripts bypass this check and are what CI uses.

See [Micro Frontend Build & Deploy](../qiankun/06-build-and-deploy.md) for the full micro app build pipeline.

### Standalone Server (non-Electron)

| Command                            | Description                                                 |
| ---------------------------------- | ----------------------------------------------------------- |
| `bun run build:renderer:web`       | Build renderer for standalone web deployment                |
| `bun run build:server`             | Build standalone server bundle to `dist-server/`            |
| `bun run server:start`             | Run standalone server in development mode                   |
| `bun run server:start:remote`      | Run standalone server with remote access                    |
| `bun run server:start:prod`        | Run standalone server in production mode                    |
| `bun run server:start:prod:remote` | Run standalone server in production mode with remote access |
| `bun run server:resetpass`         | Reset password via standalone server CLI                    |
| `bun run server:resetpass:prod`    | Reset password via standalone server CLI (production)       |

### Code Quality

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `bun run lint`         | Check for lint issues (oxlint, read-only) |
| `bun run lint:fix`     | Auto-fix lint issues                      |
| `bun run format`       | Auto-format code (oxfmt)                  |
| `bun run format:check` | Check formatting without modifying files  |
| `bun run i18n:types`   | Generate TypeScript types for i18n keys   |

### Testing

| Command                      | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `bun run test`               | Run all unit tests (vitest)                       |
| `bun run test:watch`         | Run tests in watch mode                           |
| `bun run test:coverage`      | Run tests with coverage report                    |
| `bun run test:contract`      | Run contract tests                                |
| `bun run test:integration`   | Run integration tests                             |
| `bun run test:bun`           | Run Bun-specific database driver tests            |
| `bun run test:e2e`           | Run end-to-end tests (Playwright)                 |
| `bun run test:packaged:i18n` | Run i18n integration tests against packaged build |
| `bun run test:packaged:bun`  | Run Bun packaged integration tests                |

### Debug

| Command                      | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `bun run debug:perf`         | Start app with performance monitoring enabled   |
| `bun run debug:perf:report`  | Generate performance report from collected data |
| `bun run debug:mcp`          | Debug MCP server connections                    |
| `bun run debug:mcp:list`     | List configured MCP servers                     |
| `bun run debug:mcp:validate` | Validate MCP server configurations              |
| `bun run debug:custom-agent` | Debug custom agent connections                  |

## Multi-Instance Development

When you have two clones of the repository (e.g. `AionUi` and `AionUi-refactor`) and need to run both simultaneously, the second instance can be started with:

```bash
bun run start:multi
```

This sets `AIONUI_MULTI_INSTANCE=1`, which:

- Skips the Electron single-instance lock
- Uses a separate userData directory (`AionUi-Dev-2`) to avoid database and config conflicts
- Isolates data/config symlink paths (`~/.aionui-dev-2`, `~/.aionui-config-dev-2`)
- Vite renderer, CDP, and WebUI proxy ports auto-increment to avoid collisions

> **Note:** The multi-instance WebUI defaults to port 25810 (instead of 25809). When accessing WebUI in a browser, use an **incognito/private window** for the second instance — both instances share the `localhost` cookie jar, and their JWT secrets differ, causing authentication failures if the same browser session is reused.

## Code Checks (prek)

The project uses [prek](https://github.com/j178/prek) (a Rust implementation of pre-commit) for code checks, configured in `.pre-commit-config.yaml`:

```bash
# Install prek
npm install -g @j178/prek

# Install git hooks (optional, auto-check before commit)
prek install

# Run checks on staged files
prek run

# Run checks on changes vs main (same as CI)
prek run --from-ref origin/main --to-ref HEAD
```

## Build System

AionUi uses **electron-vite** for fast bundling:

- **Main process**: bundled with Vite (ESM)
- **Renderer process**: bundled with Vite (React + TypeScript)
- **Preload scripts**: bundled with Vite

The build output goes to `out/` directory:

- `out/main/` - Main process code
- `out/renderer/` - Renderer process code
- `out/preload/` - Preload scripts

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast bundler (via electron-vite)
- **UnoCSS** - Atomic CSS engine
- **better-sqlite3** - Local database
- **vitest** - Testing framework
