# 08. 新增子应用检查清单

> 适用对象:**第一次接入**一个新子应用的总览 checklist。
>
> 子应用侧实施细节见 [05-subapp-guide.md](05-subapp-guide.md)(覆盖 vite 配置、main.ts 生命周期、API 约定、测试模式等)。本节是**总览**,按主应用侧 / 子应用侧 / 跨应用三组列。
>
> 改什么文件 / 是否要发版 见 [10-config-changes.md](10-config-changes.md)。

每接入一个新子应用,以下四方必须完全一致:

- [ ] `MICRO_APP_DEFAULTS[name].name`
- [ ] `MICRO_APP_DEFAULTS[name].activeRule`(= 浏览器 URL 前缀)
- [ ] `MICRO_APP_DEFAULTS[name].container`(= `<div id="${name}-container" />`)
- [ ] 子应用 `main.ts` 里 `window['<name>']` 生命周期注册的键名
- [ ] 子应用 `getDevEntryPort(name)` 分配的端口

**子应用侧**(详细见 [05-subapp-guide.md](05-subapp-guide.md)):

- [ ] `vite.config.ts` 装 `vite-plugin-qiankun` + `qiankunHeadModuleShim`,plugins 顺序 `react → qiankun → qiankunHeadModuleShim`,**且只在 `command === 'serve'` 时装**(详见 [03-dev-mode.md](03-dev-mode.md))
- [ ] `vite.config.ts` 有 `cors: true` + `Access-Control-Allow-Origin: '*'`
- [ ] `vite.config.ts` 的 `server.port` 与 `getDevEntryPort` 一致,且开了 `strictPort: true`(端口被占时直接失败,别静默顺延成空白页)
- [ ] `vite.config.ts` 的 alias 里有 `@aionui/microapp-shared` → `../shared/src`
- [ ] `vite.config.ts` 配了 `base: './'`(相对 base,两种分发方式共用同一份产物的前提)
- [ ] `vite.config.ts` **没有** `build.lib` —— 要的是标准 HTML 产物,不是 UMD(详见 [06-build-and-deploy.md](06-build-and-deploy.md))
- [ ] `bun run build` 后 `dist/index.html` **存在**;`dist/assets/*.js` **只有 1 个 chunk**(多 chunk 会打黄色警告,qiankun eval 环境下动态 `import()` 的相对路径解析不到)
- [ ] 构建机的 node **>= 22**(`bun run build` 用的是 PATH 上的 node;旧版 node 会让子应用的 vite 构建抛 `||=` 语法错,却仍返回退出码 0 —— 失败被吞掉)
- [ ] 新增/改动子应用后重新 `bun install` 并提交 `bun.lock`(子应用是 `packages/microapps/*` 下的 workspace;lock 里缺条目会让 CI 的 `bun install --frozen-lockfile` 直接失败)
- [ ] 依赖版本号在 npm 上**真实存在**(写一个没发过的版本号,`bun install` 会在解析阶段就失败,CI 全线挂)
- [ ] `main.ts` 导出 `bootstrap / mount / unmount`,`unmount` 清 React root + 容器 DOM + `${systemCode}_` 前缀的 localStorage
- [ ] `main.ts` 的 `__POWERED_BY_QIANKUN__` 分支注册 `window.moudleQiankunAppLifeCycles['<name>']` **和** `window['<name>']`(前者 dev 走,后者生产 HTML 产物走)
- [ ] `main.ts` 的 standalone 兜底有 mockProps + try/catch
- [ ] `adapter` / `auth` / `createIpcResolver` 从 `@aionui/microapp-shared` 引,**不要**在子应用里复制一份(详见 [12-related-files.md](12-related-files.md)「共享包」)
- [ ] API endpoint 路径不带 `/api` 前缀(由 `client.ts:joinUrl` 拼,详见 [04-baseurl.md](04-baseurl.md))
- [ ] 直接 fetch(Vditor 上传 / 图片 base64)用 `ctx.baseApi`,不要硬编码 `localhost:<port>`
- [ ] `App.tsx` 用 `useAppContext()` 拿 `baseApi / token / systemCode / userInfo`,不读 `import.meta.env`
- [ ] 业务代码不 `import` `qiankun` / 主应用 `ipcBridge` / 主应用组件

**从主应用迁代码进子应用时**:

- [ ] **测试跟着代码一起搬**,并改掉 mock 目标 —— 主应用的测试 mock 的是 `@/common` 的
      `ipcBridge`,子应用走的是 `__qiankun__/ipc` 的间接 eval 桥接,mock 不换掉就直接
      import 失败(参见 `packages/microapps/notes/src/__tests__/useNotebookList.dom.test.ts`)
- [ ] 搬进来的 hook 若调 `useAppContext()`,测试要用 `AppContext.Provider` 包一层 ——
      没有 Provider 时 `useAppContext()` 直接抛

**主应用侧 / 跨应用**:

- [ ] `VITE_<NAME>_APP_ENTRY` 命名严格符合规范
- [ ] entry URL **以 `.html` 结尾**(`import-html-entry` 只认 HTML entry,喂 `.js` 会静默渲染空白)
- [ ] `index.html` 包含 `<div id="root">` + 引用 `src/main.ts`
- [ ] 子应用新增 `micro-app/__tests__/micro-apps-config.test.ts` 条目(端口、entry、container)
- [ ] 主应用路由中加 `<MicroAppPlaceholder microAppName={name} />`
- [ ] 不在主应用 import 子应用业务代码(仅 type 引用 `MicroAppProps`)
- [ ] 不在主应用保留子应用兜底页面(spec 决策:完全迁移)
- [ ] CI 的构建步骤带 `MICRO_APP_BUNDLE=1`(否则装好的包是「开关开着但 entry 指向 localhost」的坏包,本地完全看不出来 —— 详见 [06-build-and-deploy.md#45-ci-打包ci-流水线](06-build-and-deploy.md#45-ci-打包ci-流水线))
- [ ] 本地构建走 `just build*` 或 `bun run build:all`(`justfile` 顶部已有全局 `export MICRO_APP_BUNDLE := "1"`);**不要**用裸 `bun run build`
- [ ] 改了 `packages/desktop/.env.production` 或切换分发形态(内置 / CDN)后,渲染进程 bundle 要重建 —— 增量构建的缓存 key 靠「微应用环境指纹」区分形态(见 [06-build-and-deploy.md#45-ci-打包ci-流水线](06-build-and-deploy.md#45-ci-打包ci-流水线))
