# 12. 相关文件清单

> 适用对象:想直接看源码定位某个类 / 函数的工程师。
>
> 描述性指南见 [02-config.md](02-config.md) / [03-dev-mode.md](03-dev-mode.md) / [05-subapp-guide.md](05-subapp-guide.md),本节是纯文件清单。

## 主应用侧(shell)

| 路径                                                                                                                                                               | 作用                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts)                                 | 注册表 + 端口表 + entry 解析                                  |
| [packages/desktop/src/renderer/micro-app/services/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/services/micro-apps.ts)                             | `startMicroApps` + `buildMicroAppProps` + `isMicroAppEnabled` |
| [packages/desktop/src/renderer/micro-app/MicroAppBootstrap.tsx](../../packages/desktop/src/renderer/micro-app/MicroAppBootstrap.tsx)                               | 启动 + 主题/语言广播                                          |
| [packages/desktop/src/renderer/micro-app/views/MicroAppPlaceholder.tsx](../../packages/desktop/src/renderer/micro-app/views/MicroAppPlaceholder.tsx)               | 容器 + ErrorBoundary                                          |
| [packages/desktop/src/renderer/micro-app/components/MicroAppHost.tsx](../../packages/desktop/src/renderer/micro-app/components/MicroAppHost.tsx)                   | `loadMicroApp` 真正驱动                                       |
| [packages/desktop/src/renderer/micro-app/types.ts](../../packages/desktop/src/renderer/micro-app/types.ts)                                                         | `MicroAppProps` / `MicroAppConfig`                            |
| [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-config.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-config.test.ts)   | 注册表配置测试                                                |
| [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-service.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-service.test.ts) | `startMicroApps` / `buildMicroAppProps` 单元测试              |

## 子应用侧

三个子应用目录结构一致:`vite.config.ts`(UMD + CORS + qiankun plugin + shim + `server.port`)、`src/main.ts`(qiankun 生命周期 + 独立运行守卫)。

| 路径                                                                                                                             | 作用                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [packages/microapps/meeting-recording/vite.config.ts](../../packages/microapps/meeting-recording/vite.config.ts)                 | meeting-recording 子应用构建配置(`server.port` 7991)                       |
| [packages/microapps/meeting-recording/src/main.ts](../../packages/microapps/meeting-recording/src/main.ts)                       | meeting-recording qiankun 生命周期 + 独立运行守卫                          |
| [packages/microapps/meeting-recording/src/**qiankun**/ipc.ts](../../packages/microapps/meeting-recording/src/__qiankun__/ipc.ts) | `(0, eval)('window')` 间接 eval 拿主进程 ipcBridge,绕过 qiankun 沙箱 proxy |
| [packages/microapps/notes/vite.config.ts](../../packages/microapps/notes/vite.config.ts)                                         | notes 子应用构建配置(`server.port` 7992)                                   |
| [packages/microapps/notes/src/main.ts](../../packages/microapps/notes/src/main.ts)                                               | notes qiankun 生命周期 + 独立运行守卫                                      |
| [packages/microapps/knowledge-base/vite.config.ts](../../packages/microapps/knowledge-base/vite.config.ts)                       | knowledge-base 子应用构建配置(`server.port` 7993,额外装了 UnoCSS)          |
| [packages/microapps/knowledge-base/src/main.ts](../../packages/microapps/knowledge-base/src/main.ts)                             | knowledge-base qiankun 生命周期 + 独立运行守卫                             |
| [packages/microapps/knowledge-base/src/utils/ipc.ts](../../packages/microapps/knowledge-base/src/utils/ipc.ts)                   | knowledge-base 的 IPC 访问层(用 shared 的 `createIpcResolver`)             |

## 共享包(不是子应用)

| 路径                                                                                                       | 作用                                                                      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [packages/microapps/shared/package.json](../../packages/microapps/shared/package.json)                     | `@aionui/microapp-shared`,**无 `dev` script**,`dev:all` 会跳过            |
| [packages/microapps/shared/src/qiankun/ipc.ts](../../packages/microapps/shared/src/qiankun/ipc.ts)         | `createIpcResolver<TBridge>` 工厂:间接 eval 拿真实 window 的 ipcBridge    |
| [packages/microapps/shared/src/qiankun/adapter.ts](../../packages/microapps/shared/src/qiankun/adapter.ts) | 把 `token / userInfo / baseApi` 落到 `${systemCode}_` 前缀的 localStorage |
| [packages/microapps/shared/src/qiankun/auth.ts](../../packages/microapps/shared/src/qiankun/auth.ts)       | `emitAuthExpired()`,401 统一上报,子应用不自己跳登录页                     |

## 编排脚本

| 路径                                             | 作用                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| [scripts/dev-all.mjs](../../scripts/dev-all.mjs) | 根目录 `bun run dev:all` 的入口:扫描子应用、端口预检、并发拉起、统一收尾 |

## 设计 spec

| 路径                                                               | 作用                      |
| ------------------------------------------------------------------ | ------------------------- |
| `docs/superpowers/specs/2026-10-13-aionui-qiankun-shell-design.md` | shell 接入设计 spec       |
| `docs/superpowers/specs/2026-10-15-notes-microapp-design.md`       | notes 子应用迁移设计 spec |
