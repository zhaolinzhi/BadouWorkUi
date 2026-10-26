# Development Guide

## Prerequisites

- **Node.js** 22 or higher
- **bun** — Package manager & runtime ([install](https://bun.sh))
- **Rust stable + Cargo** — Required to build the local AionCore backend ([install](https://rustup.rs))
- **Python** 3.11+ (for native module compilation)
- **prek** — PR code checker (`npm install -g @j178/prek`)

On Windows, install the Rust MSVC toolchain. If Rust compilation fails because native build tools are missing, install **Microsoft C++ Build Tools** from the Visual Studio installer, then reopen your terminal.

## Repository Layout

AionUi development uses two repositories:

- **AionCore** (`https://github.com/iOfficeAI/AionCore.git`) builds the local backend binary: `aioncore` on macOS/Linux and `aioncore.exe` on Windows.
- **AionUi** (`https://github.com/iOfficeAI/AionUi.git`) starts the Electron desktop app and launches the backend binary automatically.

Keep the repositories side by side when possible:

```text
workspace/
|-- AionCore/
`-- AionUi/
```

The desktop development server resolves the backend from the `PATH` inherited by `bun run start`. Install AionCore first, verify the binary is discoverable in the same terminal, then start AionUi.

## Quick Start

### 1. Clone Both Repositories

```bash
git clone https://github.com/iOfficeAI/AionCore.git
git clone https://github.com/iOfficeAI/AionUi.git
```

Use the `main` branch for both repositories unless a maintainer asks you to test another branch.

### 2. Build and Install AionCore

Run these commands from the `AionCore` repository.

#### macOS / Linux

```bash
cd AionCore
cargo clean
cargo install --path crates/aionui-app --locked

# Make Cargo-installed binaries visible to this shell if needed.
export PATH="$HOME/.cargo/bin:$PATH"

# Verify that AionUi will be able to find the backend.
which aioncore
aioncore --help
```

If `which aioncore` prints nothing, add `export PATH="$HOME/.cargo/bin:$PATH"` to your shell profile (`~/.zshrc`, `~/.bashrc`, or your shell's equivalent), open a new terminal, and verify again.

#### Windows PowerShell

```powershell
cd AionCore
cargo clean
cargo install --path crates/aionui-app --locked

# Make Cargo-installed binaries visible to this PowerShell session if needed.
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

# Verify that AionUi will be able to find the backend.
where.exe aioncore
aioncore --help
```

If `where.exe aioncore` prints nothing, make sure `%USERPROFILE%\.cargo\bin` is in your user `Path`, open a new PowerShell window, and verify again.

### 3. Start AionUi

Run these commands from the `AionUi` repository in a terminal where `aioncore` is discoverable.

```bash
cd AionUi

# Install dependencies
bun install

# Start the Electron desktop app in development mode
bun run start
```

During startup, AionUi launches `aioncore` automatically and passes the backend port to the renderer. You do not need to start AionCore in a separate terminal.

## Updating the Local Backend

When you pull or change AionCore, reinstall the backend binary and restart AionUi:

```bash
cd ../AionCore
cargo install --path crates/aionui-app --locked --force

cd ../AionUi
bun run start
```

Use `--force` when rebuilding local changes with the same AionCore package version; otherwise Cargo may keep the already installed binary.

## Backend Startup Troubleshooting

### `Cannot find "aioncore" binary`

AionUi cannot find the backend from the `PATH` inherited by `bun run start`.

Check from the same terminal where you start AionUi:

```bash
# macOS / Linux
which aioncore

# Windows PowerShell
where.exe aioncore
```

If the command fails, add Cargo's binary directory to `PATH` and start AionUi from a new terminal.

### `aioncore` Works in a Terminal but AionUi Still Cannot Find It

Make sure you start `bun run start` from the same terminal environment that can run `aioncore --help`. IDE terminals and GUI-launched shells can inherit a different `PATH`; restart the IDE or launch it from a terminal after updating `PATH`.

### Backend Changes Do Not Show Up

Quit AionUi, reinstall AionCore with `cargo install --path crates/aionui-app --locked --force`, then start AionUi again. The Electron app owns the backend subprocess during development, so a running AionUi instance will not pick up a newly installed binary until it restarts.

### Windows Rust Build Errors

Use the Rust MSVC toolchain and install Microsoft C++ Build Tools. After installing or changing toolchains, open a new PowerShell window and rerun the AionCore install command.

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
