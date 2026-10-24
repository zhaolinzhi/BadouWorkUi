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

细节都在 [`scripts/build-with-builder.js`](../../scripts/build-with-builder.js) 里,两个顺序是硬约束:

- 子应用构建+复制**必须排在 `electron-vite build` 之后** —— 那一步会清空 `out/`,早一步做会被抹掉
- 两个 `VITE_*` **必须在 `electron-vite build` 之前**写进 `process.env` —— 那一步才把 `import.meta.env` 烤进渲染进程 bundle(Vite 里已存在的 `process.env` 优先于 `.env` 文件,所以能盖过 `.env.production` 的占位值)

另外 `MICRO_APP_BUNDLE=1` 会**强制跳过增量构建**。增量缓存按源码 hash 判断,它看不见刚注入的 env 变量 —— 不强制重建的话,「先 `bun run build` 再 `bun run build:all`」会复用上一次的渲染进程 bundle(里面还是 `VITE_MICRO_APP_ENABLED=false`),同时又把子应用拷进去,得到一个装了微应用但永远不会去加载它的安装包。

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

`MICRO_APP_BUNDLE=1` 就是 `build:all` 全部的作用 —— 注入两个 `VITE_*`、构建并复制子应用、强制全量重建渲染进程。所以打完的 exe 和 `build:all` 打出来的 dmg 是等价的,只是少了那层 npm script 的糖。

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

> WebUI 形态(`bun run webui:prod`)的静态根也是 `out/renderer`,所以子应用会自动出现在 `/microapps/<name>/index.html`。但 WebUI 生产默认 `VITE_MICRO_APP_ENABLED=false`,启用它需要另外把 asset base 配成 `${location.origin}/microapps` —— 本轮没有做。

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

---

## 5. 已知约束

- **子应用产物应是单个 JS chunk。** code-split 出来的动态 `import()` 在 qiankun 的 eval 上下文里,相对 specifier 会按 shell 的 document base URL 解析(打包后是 `file://`)而不是子应用 entry,所以会找不到模块。构建脚本检测到多个 chunk 会打黄色警告,不会拦下来。
- **每个子应用自带一份 React / Arco / react-router。** 换取的是 dev / prod 同构,以及不再依赖一个需要 shell 预先挂 `globalThis.React` 的 UMD 全局约定。子应用之间不共享 React Context —— 它们的数据通道是 `window.ipcBridge`,不是 props / context 下钻,所以多份副本不造成功能问题。
- **`VITE_SHELL_VERSION` 目前无处注入**,`buildMicroAppProps()` 一路回落到 `'0.0.0'`。要真的用起来需要在构建时注入。
