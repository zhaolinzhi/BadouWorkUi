# 06. 构建与部署

> 适用对象:运维 / 发布工程师,或要改子应用构建产物、决定子应用怎么分发的人。
>
> "只改配置不动代码"的下线 / 屏蔽流程见 [07-disable.md](07-disable.md)。完全从仓库删子应用见 [11-complete-removal.md](11-complete-removal.md)。

## 4. 构建与部署

### 4.1 子应用产物形态

子应用构建出的是**标准 Vite HTML 产物**,不是 UMD:

```
dist/
├── index.html                 # qiankun 的 entry 就是这个文件
└── assets/
    ├── index-<hash>.js
    ├── index-<hash>.css
    └── ...(字体、图片等)
```

对应 `vite.config.ts` 里唯一一处关键配置:

```ts
// packages/microapps/notes/vite.config.ts
export default defineConfig(({ command }) => ({
  base: './', // ← 相对 base,整节只有这一行是分发相关的
  plugins: [
    react(),
    // vite-plugin-qiankun 和它的 shim 只装在 dev server 上,原因见文件里的注释
    ...(command === 'serve' ? [qiankun('notes', { useDevMode: true }), qiankunHeadModuleShim] : []),
  ],
}));
```

**entry 必须是 HTML,不能是裸 `.js`**。qiankun 的 `import-html-entry` 只从 HTML 里解析 `<script>` / `<link>`;喂一个 `.js` URL 会解析出零个 script,子应用表现为「加载了但什么都不渲染」,控制台没有任何报错。

**`base: './'` 是两种分发方式共用的关键**。相对 base 让产物里的资源路径写成 `./assets/xxx.js`,由 entry HTML 自己解析。因为 entry 永远是 `<base>/<name>/index.html`,同一份 `dist/` 既能被安装包内的 `app://microapps/notes/index.html` 消费,也能被 CDN 的 `https://cdn.example.com/…/notes/v1.0.0/index.html` 消费 —— **不需要为两种分发各打一遍**。

构建命令:

```bash
cd packages/microapps/notes && bun run build
```

**打包后 CSS 的落点和 dev 完全不同** —— 这是「打包态没样式」这类问题的根源:

| 形态 | CSS 从哪来                                       | 在 DOM 里的位置                                         |
| ---- | ------------------------------------------------ | ------------------------------------------------------- |
| dev  | Vite 运行时用 JS 注入                            | 真实 `document.head`,在 qiankun wrapper **之外**        |
| 打包 | `import-html-entry` 把 `<link>` 内联成 `<style>` | wrapper 内的 `<qiankun-head>`,**在 React 挂载容器里面** |

React 的 `createRoot(container).render()` 在首次提交时会清空容器(普通 div 容器走
`textContent = ''`,`<style>` 也不豁免),打包态下 `<qiankun-head>` 连同里面的 `<style>`
会被一起删掉 —— 子应用从此一条样式都没有(侧栏塌陷、按钮不居中、高度撑不满),而 dev
因为 CSS 在容器之外,完全不受影响。

`packages/microapps/shared/src/qiankun/mount.ts` 在 `createRoot` **之前**把容器里的样式节点
搬到真实 `document.head`,让两种形态的 DOM 结构保持一致。详见 [09-faq.md](09-faq.md)。

### 4.2 两种分发方式

子应用和主应用有两种配合方式,**按版本二选一**,不做运行时回退:

|            | 命令                                    | 产物落在哪                               | 适合                       |
| ---------- | --------------------------------------- | ---------------------------------------- | -------------------------- |
| 内置安装包 | 根目录 `bun run build:all`              | `out/renderer/microapps/<name>/`,进 asar | 离线 / 内网 / 不方便挂 CDN |
| 独立部署   | 各子应用目录 `bun run build`,产物传 CDN | 任意静态托管                             | 子应用要独立升级、灰度     |

#### 方式一:内置安装包(`bun run build:all`)

```bash
# 根目录
bun run build:all
```

它等于 `bun run build` 再加一步:构建全部子应用并复制到 `out/renderer/microapps/<name>/`,同时给渲染进程注入 `VITE_MICRO_APP_ENABLED=true` 和 `VITE_MICRO_APP_ASSET_BASE=app://microapps`。

> 注入的是**构建进程**的环境变量 —— Vite 里 `process.env` 优先于 `.env` 文件,所以 `packages/desktop/.env.production` 里那两项留空也照样打得出正确的包。完整推导见 [02-config.md#232-为什么这些变量可以留空](02-config.md#232-为什么这些变量可以留空)。

细节都在 [`scripts/build-with-builder.js`](../../scripts/build-with-builder.js) 里,两个顺序是硬约束:

- 子应用构建+复制**必须排在 `electron-vite build` 之后** —— 那一步会清空 `out/`,早一步做会被抹掉
- 两个 `VITE_*` **必须在 `electron-vite build` 之前**写进 `process.env` —— 那一步才把 `import.meta.env` 烤进渲染进程 bundle(Vite 里已存在的 `process.env` 优先于 `.env` 文件,所以能盖过 `.env.production` 的占位值)

另外 `MICRO_APP_BUNDLE=1` **不会**让增量构建失效 —— 增量缓存的 key 里已经包含「微应用环境指纹」(见 [4.5](#45-ci-打包ci-流水线)),形态不变时缓存照常命中,形态变了(内置 ↔ CDN ↔ 普通构建)才会重建。

**打几个架构由本机决定。** `bun run build:all` 等价于 `build-with-builder.js auto --mac`,不带硬编码的架构参数;脚本按 `process.arch` 选:

| 构建机            | 打出来的架构 | 原因                         |
| ----------------- | ------------ | ---------------------------- |
| Intel Mac         | 只有 x64     | 跑不了 arm64 二进制          |
| Apple Silicon Mac | arm64 + x64  | Rosetta 2 能跑 x86_64 二进制 |
| x64 Windows       | 只有 x64     | 跑不了 arm64 exe             |
| Windows on ARM    | arm64 + x64  | 系统级 x64 模拟              |

这是硬约束,不是偏好:`prepareAioncore` 会 `execFileSync` **目标架构**的 aioncore 二进制去拉 managed-resources(里面是那个架构专属的 Node 运行时,如 `node-v24.11.0-darwin-x64`),本机跑不动就 `EBADARCH`(-86)失败。逻辑在 [`resolve-auto-arch-args.js`](../../packages/shared-scripts/src/resolve-auto-arch-args.js),和 CI 用的是同一套判据 —— `build-and-release.yml` 里 macos-arm64 和 macos-x64 两个 job 都跑在 arm64 的 `macos-14` 上。

需要显式指定架构时用 `bun run build-mac:arm64` / `bun run build-mac:x64`(这两个不受本机限制,CI 就是这么调的)。

**`build:all` 只打 mac 包。** 它固定等价于 `build-with-builder.js auto --mac`,Windows / Linux 上没有对应的 script,要打带微应用的 exe / deb 得自己设环境变量:

```bash
# Windows(PowerShell 或 cmd)
set MICRO_APP_BUNDLE=1 && bun run build-win

# macOS / Linux
MICRO_APP_BUNDLE=1 bun run build-deb
```

用 `just build-win` / `just build-linux` 就不用手动设 —— `justfile` 已经全局导出了这个变量。

`MICRO_APP_BUNDLE=1` 就是 `build:all` 全部的作用 —— 注入两个 `VITE_*`、构建并复制子应用。所以打完的 exe 和 `build:all` 打出来的 dmg 是等价的,只是少了那层 npm script 的糖。

**`justfile` 的所有 `build-*` recipe 默认带这个变量。** 根目录 `justfile` 顶部有一条全局 `export MICRO_APP_BUNDLE := "1"`,`just build` / `just build-quick` / `just build-mac` 等一律生效 —— 不需要每个 recipe 手动加。

```bash
just build          # 等价于 MICRO_APP_BUNDLE=1 bun run build
just build-mac-arm64
```

> 用 `just` 时**不要**再手动 `export MICRO_APP_BUNDLE=1`(重复设值无害,但没必要)。
> 反过来,`bun run build`(不带这个变量)出的仍然是「开关开着但指向 localhost」的坏包。

**产物落在 `out/`,没有 `release/`。** `electron-builder.yml` 的 `directories.output` 就是 `out`,安装包和 `out/main`、`out/renderer`、`out/preload` 并列躺在同一个目录里 —— 找包时别去翻 `release/`。文件名是 `BadouWorklocal-<version>-<os>-<arch>.<ext>`,例如 `BadouWorklocal-1.0.0-mac-arm64.dmg`。

```
out/
├── main/  preload/  renderer/     # 编译产物
├── renderer/microapps/<name>/     # build:all 才有
├── mac/                          # 解包的 .app（单架构时叫 mac,多架构叫 mac-<arch>）
└── BadouWorklocal-<version>-mac-<arch>.dmg / .zip
```

Windows 出 `.exe`(nsis)、Linux 出 `.deb`。**后端二进制不在 `out/`** —— `prepareAioncore` 把它下载到 `resources/bundled-aioncore/<platform>-<arch>/`(gitignored),再经 electron-builder 的 `extraResources` 进包,装好后落在 `Contents/Resources/bundled-aioncore/`(macOS)或 `resources/bundled-aioncore/`(Windows)。

两个坑:`out/` 和 `out-fast-builds/` 都在 gitignore 里,不会误提交;`electron-vite build` 每次会清空 `out/`,所以上一次打的安装包不会残留 —— 但 `build:all` 拷进去的微应用也会被下一次普通 `bun run build` 一起抹掉。

**本机打出来的 mac 包只有 ad-hoc 签名。** 构建机没有 Developer ID 证书时
(`security find-identity -v -p codesigning` 显示 `0 valid identities found`),
electron-builder 会退化成 `codesign --sign -`。这种包通过微信 / 邮件 / 浏览器发出去,
对方的 macOS 会弹「无法打开,因为它来自身份不明的开发者」—— 构建机上完全看不出来,
只有收包的人会撞上。处置:对方右键「打开」,或 `xattr -cr /Applications/BadouWorklocal.app`。
要在 CI 里出**免弹窗**的包,得把签名证书和公证凭据配成 secret
(`BUILD_CERTIFICATE_BASE64` / `P12_PASSWORD` / `IDENTITY` / `APPLE_ID` /
`APPLE_ID_PASSWORD` / `TEAM_ID`)。构建脚本会在检测到 ad-hoc 签名时打一条警告。

**构建机连不上 GitHub 时改用 `bun run build:offline`。** `build:all` 有三处联网:aioncore 后端二进制、AionHub 资源、Electron 发行包。GitHub 不通(`curl https://github.com` 直接超时)时这三步会依次失败,构建停在第一步;`build:offline` 是等价命令,只是把联网点指向可达的源:

```bash
bun run build:offline
```

它实际带的是 `MICRO_APP_BUNDLE=1 AIONUI_HUB_SKIP=1 ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`,**微应用那部分一点不少** —— 两个 `VITE_*` 照常注入,子应用照常构建并复制到 `out/renderer/microapps/`。

两个坑:

- `prepareHubResources.js` 是**先清空 `resources/hub/` 再下载**的,跳过下载就等于把它清空。想要离线 hub 兜底,得先从已打好的 app(比如 `/Applications/BadouWorklocal.app/Contents/Resources/hub/`)把文件拷回 `resources/hub/`。
- aioncore 不用管:`resources/bundled-aioncore/<platform>-<arch>/aioncore` 已存在时会跳过下载(`AIONUI_BACKEND_LOCAL_BUNDLE_DIR` 可以指定一份现成的整包)。

**`app://` 协议从哪来。** 打包后渲染进程跑在 `file://` origin 上,而 Chromium 里 `fetch('file://…')` 必然抛 `TypeError`,asar 内的路径也没有 URL 形态。所以主进程注册了一个 `app://` scheme 把 `out/renderer/microapps/` 映射成可 fetch 的 URL,实现在 [`process/resources/microApps/`](../../packages/desktop/src/process/resources/microApps/index.ts)。dev 下没有这个目录时干净地回 404,不影响 `bun run dev`。

> **特权声明必须排在 `initSentry()` 之后。** `@sentry/electron` 的 `init()` 自己也会调一次 `protocol.registerSchemesAsPrivileged([sentry-ipc])`,而 Electron 是按**这次调用传入的 scheme 列表**重建 `--fetch-schemes` / `--secure-schemes` / `--cors-schemes` 等命令行开关的,后写的覆盖先写的。所以 [`registerMicroAppSchemePrivileges()`](../../packages/desktop/src/process/resources/microApps/scheme.ts) 放在 `src/index.ts` 里紧跟 `initSentry()`,而不是做成 side-effect import —— 排错了 `app://` 会被削成只剩 `standard` / `stream`,渲染进程拉 entry 直接报 `URL scheme "app" is not supported`。**这个坑 dev 看不见**(dev 的 entry 是 localhost),只有装包后才暴露,所以 `scheme.test.ts` 把调用顺序钉成了断言。

> WebUI 形态(`bun run webui:prod`)的静态根也是 `out/renderer`,所以子应用会自动出现在 `/microapps/<name>/index.html`。但 WebUI 生产虽然默认 `VITE_MICRO_APP_ENABLED=true`(开关是开的),asset base 仍然是空的 —— 要让它真的从 `/microapps` 拉子应用,还得另外把 asset base 配成 `${location.origin}/microapps`,本轮没有做。

#### 方式二:独立部署(CDN)

```bash
cd packages/microapps/notes && bun run build
# 整个 dist/ 传到 CDN,例如
# https://cdn.example.com/microapps/notes/v1.2.3/index.html
```

然后在主应用构建时指定基址:

```bash
VITE_MICRO_APP_ENABLED=true \
VITE_MICRO_APP_ASSET_BASE=https://cdn.example.com/microapps \
bun run build
```

> ⚠️ **这里必须用普通 `bun run build`,不能用 `bun run build:all`**。`build:all` 会无条件把 `VITE_MICRO_APP_ASSET_BASE` 覆写成 `app://microapps`(见 [4.2 方式一](#方式一内置安装包bun-run-buildall)),CDN 地址会被盖掉 —— 而 `app://microapps` 指向的是打进包里的子应用产物,和"子应用在 CDN 上独立升级"是两回事。

拼出来是 `https://cdn.example.com/microapps/notes/index.html`。用基址而不是逐个 entry,是因为三个子应用通常同批发布;要单独覆盖某个应用再用 `VITE_<NAME>_APP_ENTRY`(优先级更高)。

**CORS 要求**:主应用 origin 拉取子应用资源属于跨源请求,CDN 必须返回 `Access-Control-Allow-Origin`。打包态主应用在 `file://` 上,同样需要 CORS 头 —— `app://` 那一侧由协议 handler 统一带上。

### 4.3 entry 解析顺序

`getMicroAppConfig()` 依次尝试,先命中先用:

| 顺序 | 来源                        | 用途                                 |
| ---- | --------------------------- | ------------------------------------ |
| 1    | `VITE_<NAME>_APP_ENTRY`     | 单个应用覆盖(灰度、指向预发)         |
| 2    | `VITE_MICRO_APP_ASSET_BASE` | 整批分发基址,内置和 CDN 共用这个变量 |
| 3    | `//localhost:<dev port>`    | 本地联调兜底                         |

前两个都留空时回落到 dev port。**生产环境不要留空** —— 生产那个端口没有服务,会走到 `MicroAppErrorBoundary` 降级页。

### 4.4 主应用构建

主应用在 `startMicroApps` 中通过 `import('qiankun')` 动态加载 qiankun,只有 `VITE_MICRO_APP_ENABLED=true` 时才会真正进入该路径,默认构建不会把 qiankun 拉进主 bundle。

```bash
# 只编译到 out/,不跑 electron-builder(调试用)
bun run package

# 打主应用安装包 —— 微应用走 CDN 或干脆不启用
bun run build

# 打主应用安装包 + 把子应用嵌进去
bun run build:all

# 同 build:all,但构建机连不上 GitHub 时用
bun run build:offline
```

注意 `build` 和 `build:all` **都会出安装包**,区别只在微应用是否随包分发;只编译不打包的是 `package`。`build:offline` 的差别只在联网的三步,微应用部分与 `build:all` 完全一致。

### 4.5 CI 打包(CI 流水线)

CI 与本地走的是**同一条构建路径**,唯一的差别是环境变量:CI 的构建步骤统一带 `MICRO_APP_BUNDLE=1`,效果等价于本地的 `bun run build:all` —— 注入 `VITE_MICRO_APP_ENABLED=true` + `VITE_MICRO_APP_ASSET_BASE=app://microapps`,并把子应用产物拷进 `out/renderer/microapps/`。

| workflow                                  | 作用                             | 微应用形态 |
| ----------------------------------------- | -------------------------------- | ---------- |
| `.github/workflows/build-and-release.yml` | `dev` 分支 / tag 触发,六平台矩阵 | 内置       |
| `.github/workflows/build-manual.yml`      | 手动触发,可选单个平台            | 内置       |
| `.github/workflows/pr-checks.yml`         | PR 的 build-test                 | 内置       |

> **CI 千万别漏掉 `MICRO_APP_BUNDLE=1`。** 不设它的话:`.env.production` 里
> `VITE_MICRO_APP_ENABLED=true` 照旧生效,但 `VITE_MICRO_APP_ASSET_BASE` 是空的 ——
> entry 解析回落到 `//localhost:7991/7992/7993`,装好的包里那三个端口没人监听,
> 子应用必然加载失败。也就是说 CI 不设这个变量,出来的包是「开关开着但指向
> localhost」的坏包,而且**本地完全看不出来** —— 只有装了才知道。
>
> 走 CDN 形态的话,改成注入 `VITE_MICRO_APP_ASSET_BASE=<cdn 根>` 并且**不要**设
> `MICRO_APP_BUNDLE`(它会无条件把 asset base 覆写成 `app://microapps`)。

**本地也是同一个开关。** 根目录 [`justfile`](../../justfile) 顶部有一条全局
`export MICRO_APP_BUNDLE := "1"`,所有 `build-*` recipe 都被它覆盖;`package.json`
里的 `build:all` / `build:offline` 则用 `cross-env` 带同一个变量。三条路
(`just build` / `bun run build:all` / CI 的 build step)打出来的包是等价的。

**增量构建:形态变了才会重建。** 渲染进程 bundle 里的微应用接线来自
`packages/desktop/.env*` 和 `process.env` 两处,两处都不在源码树里 —— 所以
增量缓存的 key 里额外算了「微应用环境指纹」
([`micro-app-env.js`](../../packages/shared-scripts/src/micro-app-env.js)):
`.env*` 文件的内容 + 环境里 `VITE_*MICRO_APP*` / `VITE_*_APP_ENTRY` 的值。

| 场景                                        | 缓存 | 结果                                      |
| ------------------------------------------- | ---- | ----------------------------------------- |
| 源码没变,形态没变,再打一次                  | 命中 | 复用上一次的渲染进程 bundle               |
| 源码没变,但从普通构建切到内置形态(反之亦然) | 失效 | 重建 —— 渲染进程 bundle 里带着 asset base |
| 改了 `packages/desktop/.env.production`     | 失效 | 重建                                      |
| 改了 `packages/microapps/*/src`             | 失效 | 重建(子应用产物本来也要重打)              |

> 子应用的构建产物 `packages/microapps/*/dist/` **不参与** hash —— 它每次构建都会变,
> 算进去的话缓存永远命中不了。

**CI 的两个硬前提:**

- **node >= 22。** 构建脚本跑在 PATH 上的 `node` 上(`bun run` 不会把 node 换成
  bun),而子应用的 vite 构建在旧版 node 上会以很难懂的方式失败:unocss /
  vite-plugin-qiankun 的 ESM 用了 ES2021 的 `||=`,node 14 上直接抛
  `SyntaxError: Unexpected token '||='`,**而 `bun run build` 依然返回退出码 0** ——
  失败被吞掉,要等到「产物里没有 dist/index.html」才暴露。仓库的 `engines` 要求
  `node >=22 <25`,`scripts/build-with-builder.js`、`scripts/build-micro-apps.mjs`
  和 `scripts/postinstall.js` 都会先卡一道版本闸门,直接报「node 太旧」。
- **`bun.lock` 必须包含全部子应用 workspace。** 子应用是 `packages/microapps/*`
  下的 workspace,新增子应用后要重新 `bun install` 并提交 `bun.lock`,否则 CI 的
  `bun install --frozen-lockfile` 会因为 lock 与 `package.json` 不一致而失败。
  依赖版本号也必须真实存在 —— `@icon-park/react` 在 npm 上的 latest 是 `1.4.2`,
  写 `^1.5.1` 这类不存在的版本会让 frozen 安装直接解析失败。

**架构不受 CI 影响。** 微应用是纯前端资源,跟架构无关,六个平台的包里
`out/renderer/microapps/` 内容完全相同。CI 的平台矩阵由
[`build-and-release.yml`](../../.github/workflows/build-and-release.yml) 定义,
与本地的 `resolveAutoArchArgs` 是同一套判据。

### 4.6 打包 job 被 code-quality 卡住(比微应用本身更要命)

上面两条前提只保证「进了 build job 之后能打出来」。但 `build` job 在此之前还有一道
关卡 —— `_build-reusable.yml` 里:

```yaml
build:
  needs: code-quality
  if: ${{ always() && (inputs.skip_code_quality || needs.code-quality.result == 'success') }}
```

`code-quality` job 跑 `bun run lint` / `bun run format:check` / `bunx tsc --noEmit` /
`bunx vitest run` 四道检查。**任何一道红,整个六平台矩阵的 build job 会被跳过** ——
一个安装包都出不来,而且失败信息指向的是 lint/tsc/单测,跟「打包」毫无关系,很容易
误判成 qiankun 的锅。

> **当前状态(2026-10-27 实测):这四道闸门在 `origin/feature-work` 上就已经是红的。**
> 与 qiankun 无关的既有债务,别记到微应用头上:
>
> | 检查                   | 失败原因                                                                                            |
> | ---------------------- | --------------------------------------------------------------------------------------------------- |
> | `bun run lint`         | oxlint 1.78.0 没有 `no-await-thenable` 规则,`.oxlintrc.json` 引用它 → 配置解析就失败,一个文件都没扫 |
> | `bun run format:check` | oxfmt 解析不了 `tests/unit/renderer/useContainerWidth.dom.test.ts`(`.ts` 文件里写了 JSX)            |
> | `bunx tsc --noEmit`    | 10 个错误,全在 `ipcBridge.ts` / `kbChatBridge.ts` / `autoUpdaterService.ts`                         |
> | `bunx vitest run`      | 22 个文件失败,含已失效的测试(import 了被删掉的模块、JSX 写进 `.ts`)与超时                           |
>
> 临时放行:调用方给 `skip_code_quality: true` 就能跳过这道关卡(仅用于打通发布,
> 别当成常态 —— 红着的测试闸门迟早会咬人)。长期解法是把上面四道闸门逐个修绿。

---

## 5. 已知约束

- **子应用产物应是单个 JS chunk。** code-split 出来的动态 `import()` 在 qiankun 的 eval 上下文里,相对 specifier 会按 shell 的 document base URL 解析(打包后是 `file://`)而不是子应用 entry,所以会找不到模块。构建脚本检测到多个 chunk 会打黄色警告,不会拦下来。
- **每个子应用自带一份 React / Arco / react-router。** 换取的是 dev / prod 同构,以及不再依赖一个需要 shell 预先挂 `globalThis.React` 的 UMD 全局约定。子应用之间不共享 React Context —— 它们的数据通道是 `window.ipcBridge`,不是 props / context 下钻,所以多份副本不造成功能问题。
- **`VITE_SHELL_VERSION` 目前无处注入**,`buildMicroAppProps()` 一路回落到 `'0.0.0'`。要真的用起来需要在构建时注入。
