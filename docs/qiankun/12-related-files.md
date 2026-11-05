# 12. 相关文件清单

> 适用对象:想直接看源码定位某个类 / 函数的工程师。
>
> 描述性指南见 [02-config.md](02-config.md) / [03-dev-mode.md](03-dev-mode.md) / [05-subapp-guide.md](05-subapp-guide.md),本节是纯文件清单。

## 主应用侧(shell)

| 路径                                                                                                                                                               | 作用                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts)                                 | 注册表 + 端口表 + entry 解析(含 asset base 兜底层)                                    |
| [packages/desktop/src/renderer/micro-app/services/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/services/micro-apps.ts)                             | `startMicroApps` + `buildMicroAppProps` + `isMicroAppEnabled`(只读 `import.meta.env`) |
| [packages/desktop/src/renderer/micro-app/MicroAppBootstrap.tsx](../../packages/desktop/src/renderer/micro-app/MicroAppBootstrap.tsx)                               | 启动 + 主题/语言广播                                                                  |
| [packages/desktop/src/renderer/micro-app/views/MicroAppPlaceholder.tsx](../../packages/desktop/src/renderer/micro-app/views/MicroAppPlaceholder.tsx)               | 容器 + ErrorBoundary                                                                  |
| [packages/desktop/src/renderer/micro-app/components/MicroAppHost.tsx](../../packages/desktop/src/renderer/micro-app/components/MicroAppHost.tsx)                   | `loadMicroApp` 真正驱动                                                               |
| [packages/desktop/src/renderer/micro-app/types.ts](../../packages/desktop/src/renderer/micro-app/types.ts)                                                         | `MicroAppProps` / `MicroAppConfig`                                                    |
| [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-config.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-config.test.ts)   | 注册表配置测试                                                                        |
| [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-service.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-service.test.ts) | `startMicroApps` / `buildMicroAppProps` 单元测试                                      |

## 环境变量与构建配置

渲染进程的 `VITE_*` 变量从哪来、什么时候被烘进 bundle,全在这几个文件里。

| 路径                                                                                                     | 作用                                                                                          |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [packages/desktop/.env.development](../../packages/desktop/.env.development)                             | dev 模式的 env 默认值(`VITE_MICRO_APP_ENABLED=true`);**只有 `envDir` 指向本目录时才生效**     |
| [packages/desktop/.env.production](../../packages/desktop/.env.production)                               | 生产模式的 env 默认值(`VITE_MICRO_APP_ENABLED=true`);CI 注入的 `process.env` 优先级更高       |
| [packages/desktop/electron.vite.config.ts](../../packages/desktop/electron.vite.config.ts)               | 主进程 / 渲染进程构建配置;renderer 段的 `envDir: resolve(__dirname)` 决定 Vite 去哪找 `.env*` |
| [vitest.config.ts](../../vitest.config.ts)                                                               | 根测试配置;含子应用测试的收录范围,以及 `uno.css` 虚拟模块的替身 alias                         |
| [tests/stubs/uno.css](../../tests/stubs/uno.css)                                                         | `import 'uno.css'` 在测试环境里的替身(测试环境没有 UnoCSS 插件)                               |
| [tests/unit/build-scripts/rendererEnvDir.test.ts](../../tests/unit/build-scripts/rendererEnvDir.test.ts) | 回归测试:钉死 `envDir` 指向 `packages/desktop/`,以及 `process.env` 优先于 `.env` 文件         |

> **`envDir` 为什么必须显式设**:electron-vite 默认把渲染进程的 `envDir` 设成 `options.root || process.cwd()` —— `bun run dev` / `bun run build` 的 CLI 没带 `[root]` 位置参数,于是它落在仓库根;Vite 自己的 `root` 又是 `packages/desktop/src/renderer`。两个目录都没有 `.env`,`packages/desktop/.env.*` 夹在中间永远读不到。详见 [02-config.md#231-vite_micro_app_enabled-在哪里设置](02-config.md#231-vite_micro_app_enabled-在哪里设置)。

## 子应用侧

三个子应用目录结构一致:`vite.config.ts`(相对 `base` + CORS + dev-only qiankun plugin/shim + `server.port` + UnoCSS 插件)、`uno.config.ts`(自己的 UnoCSS 配置)、`src/main.ts`(qiankun 生命周期 + `window[name]` 兜底注册 + 独立运行守卫)、`src/__qiankun__/standaloneMock.ts`(独立运行时的内存假 bridge)。

| 路径                                                                                                                                                                                         | 作用                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [packages/microapps/meeting-recording/vite.config.ts](../../packages/microapps/meeting-recording/vite.config.ts)                                                                             | meeting-recording 子应用构建配置(`server.port` 7991,装了 UnoCSS)                                |
| [packages/microapps/meeting-recording/uno.config.ts](../../packages/microapps/meeting-recording/uno.config.ts)                                                                               | meeting-recording 自己的 UnoCSS 配置(与 shell 共用 token,**不带 preflight**)                    |
| [packages/microapps/meeting-recording/src/main.ts](../../packages/microapps/meeting-recording/src/main.ts)                                                                                   | meeting-recording qiankun 生命周期 + 独立运行守卫                                               |
| [packages/microapps/meeting-recording/src/**qiankun**/ipc.ts](../../packages/microapps/meeting-recording/src/__qiankun__/ipc.ts)                                                             | `(0, eval)('window')` 间接 eval 拿主进程 ipcBridge,绕过 qiankun 沙箱 proxy                      |
| [packages/microapps/meeting-recording/src/**qiankun**/standaloneMock.ts](../../packages/microapps/meeting-recording/src/__qiankun__/standaloneMock.ts)                                       | 独立运行(dev)时装到 `window.ipcBridge` 上的内存假 bridge(录音列表 / 转写 / 读分片音频)          |
| [packages/microapps/meeting-recording/src/**qiankun**/**tests**/standaloneMock.dom.test.ts](../../packages/microapps/meeting-recording/src/__qiankun__/__tests__/standaloneMock.dom.test.ts) | 上面那份假 bridge 的单测(语义 + 装上后 resolver 能真的拿到它)                                   |
| [packages/microapps/notes/vite.config.ts](../../packages/microapps/notes/vite.config.ts)                                                                                                     | notes 子应用构建配置(`server.port` 7992,装了 UnoCSS + Vditor 资源中间件)                        |
| [packages/microapps/notes/uno.config.ts](../../packages/microapps/notes/uno.config.ts)                                                                                                       | notes 自己的 UnoCSS 配置(与 shell 共用 token,**不带 preflight**)                                |
| [packages/microapps/notes/src/main.ts](../../packages/microapps/notes/src/main.ts)                                                                                                           | notes qiankun 生命周期 + 独立运行守卫                                                           |
| [packages/microapps/notes/src/**qiankun**/standaloneMock.ts](../../packages/microapps/notes/src/__qiankun__/standaloneMock.ts)                                                               | 独立运行(dev)时装到 `window.ipcBridge` 上的内存假 bridge                                        |
| [packages/microapps/notes/src/**tests**/](../../packages/microapps/notes/src/__tests__)                                                                                                      | notes 子应用的单测;`useNotebookList` / `useNotesEditor` 是从主应用搬过来的,跟着代码一起搬       |
| [packages/microapps/knowledge-base/vite.config.ts](../../packages/microapps/knowledge-base/vite.config.ts)                                                                                   | knowledge-base 子应用构建配置(`server.port` 7993,装了 UnoCSS)                                   |
| [packages/microapps/knowledge-base/uno.config.ts](../../packages/microapps/knowledge-base/uno.config.ts)                                                                                     | knowledge-base 自己的 UnoCSS 配置(与 shell 共用 token,**不带 preflight**)                       |
| [packages/microapps/knowledge-base/src/main.ts](../../packages/microapps/knowledge-base/src/main.ts)                                                                                         | knowledge-base qiankun 生命周期 + 独立运行守卫                                                  |
| [packages/microapps/knowledge-base/src/utils/ipc.ts](../../packages/microapps/knowledge-base/src/utils/ipc.ts)                                                                               | knowledge-base 的 IPC 访问层(用 shared 的 `createIpcResolver`)                                  |
| [packages/microapps/knowledge-base/src/**qiankun**/standaloneMock.ts](../../packages/microapps/knowledge-base/src/__qiankun__/standaloneMock.ts)                                             | 独立运行(dev)时装到 `window.ipcBridge` 上的内存假 bridge(取文件 / 读图 / 打开外链 / agent 目录) |
| [packages/microapps/knowledge-base/src/**qiankun**/**tests**/standaloneMock.dom.test.ts](../../packages/microapps/knowledge-base/src/__qiankun__/__tests__/standaloneMock.dom.test.ts)       | 上面那份假 bridge 的单测                                                                        |

## 共享包(不是子应用)

| 路径                                                                                                                                               | 作用                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packages/microapps/shared/package.json](../../packages/microapps/shared/package.json)                                                             | `@aionui/microapp-shared`,**无 `dev` script**,`dev:all` 会跳过                                                                                                                           |
| [packages/microapps/shared/src/qiankun/ipc.ts](../../packages/microapps/shared/src/qiankun/ipc.ts)                                                 | `createIpcResolver<TBridge>` 工厂:间接 eval 拿真实 window 的 ipcBridge                                                                                                                   |
| [packages/microapps/shared/src/qiankun/adapter.ts](../../packages/microapps/shared/src/qiankun/adapter.ts)                                         | 把 `token / userInfo / baseApi` 落到 `${systemCode}_` 前缀的 localStorage                                                                                                                |
| [packages/microapps/shared/src/qiankun/auth.ts](../../packages/microapps/shared/src/qiankun/auth.ts)                                               | `emitAuthExpired()`,401 统一上报,子应用不自己跳登录页                                                                                                                                    |
| [packages/microapps/shared/src/qiankun/mount.ts](../../packages/microapps/shared/src/qiankun/mount.ts)                                             | `createMicroAppRenderer()`:qiankun 生命周期 → React root 的挂载/卸载;含"打包态样式丢失"的修复                                                                                            |
| [packages/microapps/shared/src/standalone/theme.ts](../../packages/microapps/shared/src/standalone/theme.ts)                                       | `resolveStandaloneTheme()` / `applyStandaloneTheme()`:独立运行时把明暗外观写到 `html[data-theme]` / `body[arco-theme]`                                                                   |
| [packages/microapps/shared/src/standalone/styles.ts](../../packages/microapps/shared/src/standalone/styles.ts)                                     | `loadStandaloneStyles()`:独立运行时**动态 `import()`** 加载 `styles/standalone.css`(只能在 dev 加载,见 [05-subapp-guide.md#367-standalone-调试](05-subapp-guide.md#367-standalone-调试)) |
| [packages/microapps/shared/src/styles/standalone.css](../../packages/microapps/shared/src/styles/standalone.css)                                   | 独立运行才加载的样式(Arco 基础样式 + 主题 CSS 变量 + 主题覆盖 + 挂载点布局)                                                                                                              |
| [packages/microapps/shared/src/standalone/**tests**/theme.dom.test.ts](../../packages/microapps/shared/src/standalone/__tests__/theme.dom.test.ts) | 主题解析 / 应用的单测                                                                                                                                                                    |

## 微应用资产服务(主进程)

打包后子应用落在 asar 里,渲染进程在 `file://` origin 上 fetch 不到,主进程用 `app://` 协议把 `out/renderer/microapps/` 映射成可 fetch 的 URL。详见 [06-build-and-deploy.md](06-build-and-deploy.md)。

| 路径                                                                                                                                                         | 作用                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [packages/desktop/src/process/resources/microApps/scheme.ts](../../packages/desktop/src/process/resources/microApps/scheme.ts)                               | 导出 `registerMicroAppSchemePrivileges()`:声明 `app` 的特权 scheme(standard / secure / supportFetchAPI / corsEnabled / stream),**必须在 `initSentry()` 之后调用** |
| [packages/desktop/src/process/resources/microApps/assets.ts](../../packages/desktop/src/process/resources/microApps/assets.ts)                               | 纯函数:MIME 映射 + 路径解析(拒绝 `..` 穿越 / 越界 / 非法百分号编码)                                                                                               |
| [packages/desktop/src/process/resources/microApps/index.ts](../../packages/desktop/src/process/resources/microApps/index.ts)                                 | `registerMicroAppAssetProtocol()`:`protocol.handle('app')` 处理器,统一带 CORS 头                                                                                  |
| [packages/desktop/src/process/resources/microApps/**tests**/assets.test.ts](../../packages/desktop/src/process/resources/microApps/__tests__/assets.test.ts) | 上面两个纯函数的单元测试                                                                                                                                          |
| [packages/desktop/src/process/resources/microApps/**tests**/scheme.test.ts](../../packages/desktop/src/process/resources/microApps/__tests__/scheme.test.ts) | 特权声明的单元测试;并把「注册必须排在 `initSentry()` 之后」钉成断言(排错了只有装包才暴露)                                                                         |

## 编排脚本

| 路径                                                                                                                             | 作用                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [scripts/dev-all.mjs](../../scripts/dev-all.mjs)                                                                                 | 根目录 `bun run dev:all` 的入口:扫描子应用、端口预检、并发拉起、统一收尾                         |
| [scripts/build-micro-apps.mjs](../../scripts/build-micro-apps.mjs)                                                               | 构建全部子应用并复制到 `out/renderer/microapps/<name>/`;导出 `discoverMicroApps` 给 dev 脚本复用 |
| [scripts/build-with-builder.js](../../scripts/build-with-builder.js)                                                             | 打包编排;`MICRO_APP_BUNDLE=1`(`bun run build:all`)时注入 `app://microapps` 基址并调用上一个脚本  |
| [packages/shared-scripts/src/resolve-auto-arch-args.js](../../packages/shared-scripts/src/resolve-auto-arch-args.js)             | `auto` 模式下按构建机能力决定架构(Intel Mac 只出 x64,Apple Silicon 出 arm64 + x64)               |
| [packages/shared-scripts/src/prune-stale-aioncore-bundles.js](../../packages/shared-scripts/src/prune-stale-aioncore-bundles.js) | 打包前删掉不属于本次构建目标的后端架构目录(`extraResources` 整目录复制,残骸会进每个安装包)       |
| [packages/shared-scripts/src/assert-node-version.js](../../packages/shared-scripts/src/assert-node-version.js)                   | node 版本闸门:按根 `package.json` 的 `engines.node` 卡版本,避免旧版 node 的隐晦失败              |
| [packages/shared-scripts/src/micro-app-env.js](../../packages/shared-scripts/src/micro-app-env.js)                               | 微应用环境指纹:`.env*` 文件 + `VITE_*` 覆盖;增量构建的缓存 key 靠它区分形态                      |
| [justfile](../../justfile)                                                                                                       | 本地构建 recipe;顶部一条全局 `export MICRO_APP_BUNDLE := "1"`,所有 `build-*` 都内置微应用        |

## CI 流水线

| 路径                                                                                                           | 作用                                                                              |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [.github/workflows/\_build-reusable.yml](../../.github/workflows/_build-reusable.yml)                          | 发布流水线(六平台矩阵);构建步骤统一带 `MICRO_APP_BUNDLE=1`,把子应用打进每个安装包 |
| [.github/workflows/build-and-release.yml](../../.github/workflows/build-and-release.yml)                       | `dev` 分支 / tag 触发,调用上面的可复用流水线并创建 Release                        |
| [.github/workflows/build-manual.yml](../../.github/workflows/build-manual.yml)                                 | 手动触发,可选单个平台或 `all`                                                     |
| [.github/workflows/pr-checks.yml](../../.github/workflows/pr-checks.yml)                                       | PR 的 build-test:与发布同一条路径(同样带 `MICRO_APP_BUNDLE=1`)                    |
| [tests/unit/build-scripts/ciMicroAppBundle.test.ts](../../tests/unit/build-scripts/ciMicroAppBundle.test.ts)   | 回归测试:钉死 CI 必须带 `MICRO_APP_BUNDLE=1`,以及发布矩阵仍是六个平台/架构组合    |
| [tests/unit/build-scripts/assertNodeVersion.test.ts](../../tests/unit/build-scripts/assertNodeVersion.test.ts) | 回归测试:node 版本闸门的边界与报错文案                                            |

## 设计 spec

| 路径                                                               | 作用                      |
| ------------------------------------------------------------------ | ------------------------- |
| `docs/superpowers/specs/2026-10-13-aionui-qiankun-shell-design.md` | shell 接入设计 spec       |
| `docs/superpowers/specs/2026-10-15-notes-microapp-design.md`       | notes 子应用迁移设计 spec |
