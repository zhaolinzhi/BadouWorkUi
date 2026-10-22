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
- [ ] 子应用 `vite.config.ts` 中 `lib.name`
- [ ] 子应用 `getDevEntryPort(name)` 分配的端口

**子应用侧**(详细见 [05-subapp-guide.md](05-subapp-guide.md)):

- [ ] `vite.config.ts` 装 `vite-plugin-qiankun` + `qiankunHeadModuleShim`,plugins 顺序 `react → qiankun → qiankunHeadModuleShim`(详见 [03-dev-mode.md](03-dev-mode.md))
- [ ] `vite.config.ts` 有 `cors: true` + `Access-Control-Allow-Origin: '*'`
- [ ] `vite.config.ts` 的 `build.lib` external 含 `react / react-dom / react-router-dom / @arco-design/web-react`
- [ ] `main.ts` 导出 `bootstrap / mount / unmount`,`unmount` 清 React root + 容器 DOM + `${systemCode}_` 前缀的 localStorage
- [ ] `main.ts` 的 `__POWERED_BY_QIANKUN__` 分支注册 `window.moudleQiankunAppLifeCycles['<name>']`(详见 [03-dev-mode.md](03-dev-mode.md))
- [ ] `main.ts` 的 standalone 兜底有 mockProps + try/catch
- [ ] `__qiankun__/adapter.ts` 把 `token / userInfo / baseApi` 落到 `${systemCode}_` 前缀的 localStorage
- [ ] `__qiankun__/auth.ts` 提供 `emitAuthExpired()`,业务侧 401 走它,**不要**自己跳登录页
- [ ] API endpoint 路径不带 `/api` 前缀(由 `client.ts:joinUrl` 拼,详见 [04-baseurl.md](04-baseurl.md))
- [ ] 直接 fetch(Vditor 上传 / 图片 base64)用 `ctx.baseApi`,不要硬编码 `localhost:<port>`
- [ ] `App.tsx` 用 `useAppContext()` 拿 `baseApi / token / systemCode / userInfo`,不读 `import.meta.env`
- [ ] 业务代码不 `import` `qiankun` / 主应用 `ipcBridge` / 主应用组件

**主应用侧 / 跨应用**:

- [ ] `VITE_<NAME>_APP_ENTRY` 命名严格符合规范
- [ ] `index.html` 包含 `<div id="root">` + 引用 `src/main.ts`
- [ ] 子应用新增 `micro-app/__tests__/micro-apps-config.test.ts` 条目(端口、entry、container)
- [ ] 主应用路由中加 `<MicroAppPlaceholder microAppName={name} />`
- [ ] 不在主应用 import 子应用业务代码(仅 type 引用 `MicroAppProps`)
- [ ] 不在主应用保留子应用兜底页面(spec 决策:完全迁移)
