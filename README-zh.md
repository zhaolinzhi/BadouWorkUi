# AionUi 开发环境搭建运行手册

本文档说明在 **macOS / Linux / Windows** 上从零搭建 AionUi 本地开发环境、并将项目跑起来所需的全部步骤与命令。

AionUi 由两个并列仓库组成：

| 仓库                                              | 角色                         | 技术栈             |
| ------------------------------------------------- | ---------------------------- | ------------------ |
| [AionCore](https://github.com/iOfficeAI/AionCore) | AI Agent 后端进程 `aioncore` | Rust + Cargo       |
| **AionUi**（本仓库 `badouworkui`）                | Electron 桌面应用前端        | TypeScript + React |

AionUi 启动时会**自动拉起 aioncore 子进程**，所以两边都必须就绪。

---

## 一、布局约定

两个仓库需要并列放置：

```text
workspace/                              ← 任意父目录
|-- AionCore/                           ← 后端，cargo install 产出二进制
`-- AionUi/    (即本仓库 badouworkui)   ← 前端，bun install + bun start
```

> 仓库根 [.gitignore](.gitignore) 中的 `workspace` 规则与此处目录名同名巧合，无关。

---

## 二、前置条件（必装）

| 工具             | 版本       | 用途                                       | 安装命令                                                              |
| ---------------- | ---------- | ------------------------------------------ | --------------------------------------------------------------------- |
| **Node.js**      | `>=22 <25` | 跑前端构建与 Electron                      | `nvm install 22.23.1 && nvm use 22.23.1 && nvm alias default 22.23.1` |
| **bun**          | 最新       | 包管理器、运行脚本（项目所有命令基于 bun） | `curl -fsSL https://bun.sh/install \| bash`                           |
| **Rust + Cargo** | stable     | 编译 aioncore 后端                         | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh`     |
| **Python**       | `>=3.11`   | 原生模块（node-gyp）编译依赖               | 自行安装（macOS: `brew install python@3.11`）                         |
| **prek**（可选） | 最新       | PR 提交前代码检查                          | `npm install -g @j178/prek`                                           |

Windows 额外要求：

- Rust **MSVC 工具链**（`rustup default stable-msvc`）
- **Microsoft C++ Build Tools**（Visual Studio Installer 中勾选）
- PowerShell 中需把 `%USERPROFILE%\.cargo\bin` 加入 `Path`

> 📌 **项目根 [package.json:262-264](package.json#L262-L264) 强制 `engines.node: ">=22 <25"`**，低于此版本所有脚本都会出问题。

---

## 三、首次搭建（按顺序执行）

### 步骤 1：装 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version    # 应输出版本号
```

### 步骤 2：装 bun

```bash
curl -fsSL https://bun.sh/install | bash
# 安装器已自动把 ~/.bun/bin 加入 ~/.bash_profile / ~/.zshrc
# 新开 shell 即生效；当前 shell 立即生效：
export PATH="$HOME/.bun/bin:$PATH"
bun --version
```

### 步骤 3：切到 Node 22

```bash
nvm install 22.23.1
nvm use 22.23.1
nvm alias default 22.23.1   # 永久默认，避免每次新 shell 回到老版本
```

### 步骤 4：克隆 AionCore 仓库（与本仓库并列）

```bash
cd ../badouwork/   # ← 改为你实际的父目录
git clone https://github.com/iOfficeAI/AionCore.git
```

> 网络受限环境下可用 GitHub 镜像：
> `git clone https://ghproxy.com/https://github.com/iOfficeAI/AionCore.git`

### 步骤 5：编译并安装 aioncore

```bash
cd AionCore
cargo clean
cargo install --path crates/aionui-app --locked    # 首次编译需要几分钟
```

产物会出现在 `~/.cargo/bin/aioncore`（Windows: `%USERPROFILE%\.cargo\bin\aioncore.exe`）。

**验证**：

```bash
export PATH="$HOME/.cargo/bin:$PATH"
which aioncore     # 应输出 /Users/.../.cargo/bin/aioncore
aioncore --help    # 应输出帮助文本
```

### 步骤 6：把 cargo bin 永久加入 PATH

```bash
# macOS / Linux（zsh）
echo 'export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Windows PowerShell：把 `%USERPROFILE%\.cargo\bin` 加进系统环境变量 `Path`。

### 步骤 7：安装前端依赖并启动

```bash
cd /Users/weilingli/Documents/workplace/badouwork/badouworkui   # ← AionUi 仓库
bun install                                                    # 安装依赖（首次几分钟）
bun start                                                      # 启动桌面端
```

启动成功后会自动打开 AionUi 窗口，并自动拉起 aioncore 子进程。

---

## 四、每次新 Shell 需要的前置

```bash
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH" && nvm use 22.23.1
```

如果已在 `~/.zshrc` 中永久配置好，开新 shell 即可直接 `bun start`。

---

## 五、日常开发命令速查

> 完整列表见 [docs/contributing/development.md](docs/contributing/development.md)。

### 开发运行

| 命令                  | 说明                                |
| --------------------- | ----------------------------------- |
| `bun start`           | 启动 Electron 桌面端 dev            |
| `bun run dev`         | 同 `bun start`                      |
| `bun run dev:all`     | 一条命令拉起主应用 + 全部微应用 dev |
| `bun run start:multi` | 多实例模式（同时跑两个 AionUi）     |
| `bun run cli`         | 同 `bun start`                      |

### WebUI 模式（浏览器版，无 Electron 窗口）

| 命令                   | 说明             |
| ---------------------- | ---------------- |
| `bun run webui`        | 启动 WebUI       |
| `bun run webui:remote` | WebUI + 远程访问 |
| `bun run webui:prod`   | WebUI 生产模式   |

### 构建分发包

| 命令                    | 说明                                         |
| ----------------------- | -------------------------------------------- |
| `bun run package`       | 构建 main/preload/renderer 到 `out/`         |
| `bun run dist:mac`      | 打包 macOS 安装包                            |
| `bun run dist:win`      | 打包 Windows 安装包                          |
| `bun run dist:linux`    | 打包 Linux 安装包                            |
| `bun run build`         | 通用构建（等价 `build-mac`，架构由本机决定） |
| `bun run build:all`     | 同 `build`，但把全部微应用一并打进安装包     |
| `bun run build:offline` | 同 `build:all`，但用于连不上 GitHub 的机器   |

`build` / `build:all` 不写死架构，由构建机决定：Intel Mac 只出 x64，Apple Silicon 出 arm64 + x64，Windows 同理（x64 机器只出 x64，ARM 机器出两个）。原因是打包流程要**执行**目标架构的 `aioncore` 二进制去拉架构专属的 Node 运行时，跨不过去会 `EBADARCH`(-86)。要显式指定用 `build-mac:arm64` / `build-mac:x64` / `build-win:arm64` / `build-win:x64`。

**产物落在 `out/`，没有 `release/` 目录。** `electron-builder.yml` 的 `directories.output` 就是 `out`，安装包和 `out/main`、`out/renderer`、`out/preload` 并列。产物名是 `BadouWorklocal-<version>-<os>-<arch>.<ext>`，mac 出 `.dmg` + `.zip`，Windows 出 `.exe`（nsis），Linux 出 `.deb`。后端二进制不进 `out/`——它下载到 `resources/bundled-aioncore/`（gitignored），再经 `extraResources` 进包。

**只想重跑打包那一步**（`out/main`、`out/preload`、`out/renderer` 已经在了，比如 electron-builder 上次失败、或只想改打包选项）就直接调 electron-builder，省掉重新拉 ~100MB 后端运行时：

```bash
bunx electron-builder --config packages/desktop/electron-builder.yml --mac --publish=never
# 指定单架构加 --x64 / --arm64；Windows 换 --win，Linux 换 --linux
```

`--publish=never` 不能省，否则 electron-builder 会往 GitHub Releases 推送。本地包**没有签名**（除非本机装了证书），装的时候右键「打开」，或 `xattr -dr com.apple.quarantine /Applications/BadouWorklocal.app`；调试用 `.zip` 更省事，双击解压直接跑，不触发 Gatekeeper。

**连不上 GitHub 时改用 `bun run build:offline`。** `build:all` 有三处联网：aioncore 后端二进制、AionHub 资源、Electron 发行包。GitHub 不通时这三步会依次失败，`build:offline` 把它们指向可达的源（跳过 AionHub 下载、换 Electron 镜像、复用已缓存的 aioncore）。一个坑：跳过 AionHub 的脚本会先清空 `resources/hub/`，想要离线 hub 兜底得先从已打好的 app 里把 `hub/` 拷回去。细节见 [docs/contributing/development.md](docs/contributing/development.md#building-without-github-access)。

微应用打包链路见 [docs/qiankun/06-build-and-deploy.md](docs/qiankun/06-build-and-deploy.md)，完整命令表和目录布局见 [docs/contributing/development.md](docs/contributing/development.md)。

### 代码质量

| 命令                   | 说明                             |
| ---------------------- | -------------------------------- |
| `bun run lint`         | oxlint 检查                      |
| `bun run lint:fix`     | oxlint 自动修复                  |
| `bun run format`       | oxfmt 自动格式化                 |
| `bun run format:check` | 仅检查不修改                     |
| `bun run i18n:types`   | 生成 i18n key 的 TypeScript 类型 |

### 测试

| 命令                    | 说明                     |
| ----------------------- | ------------------------ |
| `bun run test`          | 跑全部单元测试（vitest） |
| `bun run test:watch`    | watch 模式               |
| `bun run test:coverage` | 带覆盖率                 |
| `bun run test:e2e`      | 端到端测试（Playwright） |

---

## 六、更新本地后端

修改 AionCore 代码后，需重新编译并重启 AionUi：

```bash
cd /path/to/workspace/AionCore
cargo install --path crates/aionui-app --locked --force   # --force 覆盖旧版本

cd /path/to/workspace/AionUi
bun start
```

> AionUi 启动期间持有 aioncore 子进程，必须先关掉 AionUi 再重装。

---

## 七、常见启动失败与排查

### A. `Cannot find "aioncore" binary`

**现象**：`bun start` 后弹窗报 `aioncore startup failed while resolving backend binary`

**排查**：

```bash
# 在启动 AionUi 的同一个 shell 里跑
which aioncore        # 必须输出非空路径
aioncore --help       # 必须输出帮助文本
```

任一失败说明 aioncore 未就绪。回到本文档「步骤 5」重新构建。

**注意**：IDE 内置终端 / GUI 启动的 shell 可能继承不同的 `PATH`，跑 `which aioncore` 在新开的系统终端里试。

### B. `workspace:` 协议相关报错

**现象**：`Unsupported URL Type "workspace:"`

**原因**：用 `npm install` 或 `yarn install` 安装依赖。项目仅支持 bun。

**解决**：

```bash
rm -rf node_modules pnpm-lock.yaml yarn.lock package-lock.json
bun install
```

### C. `bunx: command not found`

**现象**：postinstall 阶段报错。

**原因**：未装 bun，但项目 [scripts/postinstall.js](scripts/postinstall.js) 硬编码 `bunx`。

**解决**：参见「步骤 2」装 bun。

### D. `husky: SyntaxError: Unexpected token '||='`

**现象**：postinstall 中 husky 报错。

**原因**：当前 Node 版本低于 15，`||=` 语法不支持。

**解决**：参见「步骤 3」切到 Node 22。

### E. Electron DevTools 网络超时

**现象**：`[DevTools] Failed to install React DevTools: net::ERR_CONNECTION_TIMED_OUT`

**原因**：开发模式尝试下载 React DevTools，网络受限。

**影响**：仅影响 DevTools 自动安装，不阻塞主流程。需要 DevTools 时手动安装或配置代理。

### F. 登录页点击登录后「一直转圈」

**现象**：登录按钮 spinner 不停，或整个页面卡在 AppLoader。

**原因**：外部 SSO 完成登录后跳回 `aionui://auth/callback?token=...` 的 deep link 未正确触发 AionUi 拉起。

**排查**：

1. 浏览器 DevTools console 是否收到 `externalLoginCompleted` 事件
2. 系统终端跑 `open "aionui://test"`（macOS）看协议是否注册
3. 查看 `~/Library/Logs/AionUi/`（macOS）下 main 日志，确认 `handleDeepLinkUrl` 是否被调用

登录链路详见 [packages/desktop/src/renderer/pages/login/index.tsx](packages/desktop/src/renderer/pages/login/index.tsx) 与 [packages/desktop/src/process/auth/externalLoginManager.ts](packages/desktop/src/process/auth/externalLoginManager.ts)。

#### F-1. 点登录拉起的是「另一个」应用（dev 和已安装应用抢 `aionui://` 协议）

**现象**：本地 `bun run dev:all` 跑着，点「登录」后弹出来的是 `/Applications/BadouWorklocal.app`（或者反过来），dev 这边的登录页一直转圈。

**原因**：`aionui://` 是 macOS 上的**全局自定义协议，只能有一个 handler**，归属按 **bundle id** 记（LaunchServices 里 `aionui` → `com.badouwork.applocal`）。两个应用启动时都会调 `app.setAsDefaultProtocolClient('aionui')`：

| 谁在跑                                                           | 声明的 bundle id                                                      | deep link 归谁 |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- | -------------- |
| `bun run dev:all`（`electron .`，`process.defaultApp === true`） | `com.github.Electron`（dev 下 `process.execPath` 在 Electron.app 里） | dev 实例       |
| `/Applications/BadouWorklocal.app`（打包态）                     | `com.badouwork.applocal`                                              | 已安装的应用   |

`LSSetDefaultHandlerForURLScheme` 是单值映射，**后启动的覆盖先启动的**。所以只要 dev 跑着的时候又启动了已安装的应用，协议就被抢走，SSO 完的回调落到已安装的那个上，dev 的登录页永远等不到 `externalLoginCompleted`。

**解决**：

1. 调试 dev 时别启动已安装的那个。已经启动了 → **重启 `bun run dev:all`**，dev 实例启动时会重新声明把协议抢回来。
2. 不想重启 dev 的话，手动把协议指回 Electron：

   ```bash
   swift - <<'EOF'
   import Foundation
   import CoreServices
   print(LSSetDefaultHandlerForURLScheme("aionui" as CFString, "com.github.Electron" as CFString))
   EOF
   ```

   返回 `0` 即成功。查当前归属：

   ```bash
   lsregister -dump 2>/dev/null | grep -A2 "URL scheme:.*aionui"
   ```

3. 已安装的应用**下次启动**时又会抢回去（它自己也得声明协议），所以调试期间别去动它。

> 两个应用的 userData 目录不同（dev 是 `BadouWork-Dev`，装好的是 `BadouWorklocal`，见 [packages/desktop/src/common/platform/index.ts](packages/desktop/src/common/platform/index.ts)），单实例锁不冲突、可以并存 —— 冲突的只有协议归属。日志也分开放：`~/Library/Logs/BadouWork-Dev/` 和 `~/Library/Logs/BadouWorklocal/`，排查时先确认看的是哪一份。

### G. 启动后弹窗「托管 Node 运行环境 准备失败」

**现象**：AionUi 启动后弹出对话框

> 托管 Node 运行环境 准备失败。请重新打开应用后再试；如果仍然出现，请重新安装应用或重新下载完整安装包。

main 进程日志伴随：

```
managed node runtime validation failed before install
  error=managed node runtime directory missing: data/runtime/node/node-v24.11.0-darwin-x64
managed node runtime install attempt failed; retrying
  error=download archive connect failed for https://nodejs.org/dist/v24.11.0/node-v24.11.0-darwin-x64.tar.gz
```

**原因**：aioncore 启动后会**主动从 [nodejs.org](https://nodejs.org/dist) 下载 Node v24.11.0** 到 `data/runtime/node/`，以便在会话/MCP 等场景里调用 aioncore 自己管理的 Node 子进程。网络访问 `nodejs.org` 受限时下载失败。

> 虽然 [resources/bundled-aioncore/darwin-x64/managed-resources/node/node-v24.11.0-darwin-x64/](resources/bundled-aioncore/darwin-x64/managed-resources/node/node-v24.11.0-darwin-x64/) 目录里已经**自带**完整的 Node 二进制，但 aioncore 启动时的缺省行为是从远端按需下载，而不是优先使用 bundled。

**解决**：手动把 bundled 的 Node 复制到 aioncore 期望的运行时路径：

```bash
# 在 AionUi 仓库根目录下执行
SRC="$PWD/resources/bundled-aioncore/darwin-x64/managed-resources/node/node-v24.11.0-darwin-x64"
DST="$PWD/data/runtime/node/node-v24.11.0-darwin-x64"
mkdir -p "$PWD/data/runtime/node"
cp -R "$SRC" "$DST"
```

**验证**：

```bash
"$DST/bin/node" --version      # 应输出 v24.11.0
file "$DST/bin/node"          # 应为 Mach-O 64-bit executable x86_64 / arm64
```

然后重启 AionUi 即可。

> 若 aioncore 后续又尝试下载（比如版本升级），需要重新执行上述拷贝，或确保 `nodejs.org` 可达。

### H. 启动时 `Another instance is already running`

**现象**：再次 `bun start` 时控制台显示

```
[AionUi] second-instance received with no active main window, recreating main window
[AionUi] Another instance is already running; current process will exit.
```

屏幕上看不到新窗口（或窗口被弹窗挡住）。

**原因**：Electron 单实例锁检测到上一轮 AionUi 主进程未完全退出（之前崩溃、aioncore 报错窗口关闭时 main 没回收、强制结束后残留 helper 进程等）。

**解决**：

```bash
# 1. 列出还活着的 AionUi 主进程（pid 不是 helper）
ps aux | grep "Electron \." | grep "badouwork" | grep -v grep

# 2. 先 SIGTERM，让 aioncore 子进程优雅退出
kill <pid>

# 3. 等 5 秒，再查；若还在，SIGKILL
sleep 5
ps aux | grep "Electron \." | grep "badouwork" | grep -v grep
kill -9 <pid>   # 仅在 SIGTERM 无响应时使用
```

清理完成后重新 `bun start`。

---

## 八、参考链接

- 项目开发指南（英文原版）：[docs/contributing/development.md](docs/contributing/development.md)
- 中文贡献指南：[CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)
- 仓库文件结构：[docs/contributing/file-structure.md](docs/contributing/file-structure.md)
- aioncore 解析逻辑：[packages/desktop/src/process/backend/binaryResolver.ts](packages/desktop/src/process/backend/binaryResolver.ts)
- 启动失败分类：[packages/desktop/src/process/startup/backendStartupFailure.ts](packages/desktop/src/process/startup/backendStartupFailure.ts)
- 登录 deep-link：[packages/desktop/src/process/utils/deepLink.ts](packages/desktop/src/process/utils/deepLink.ts)
- 外部 SSO 管理：[packages/desktop/src/process/auth/externalLoginManager.ts](packages/desktop/src/process/auth/externalLoginManager.ts)
