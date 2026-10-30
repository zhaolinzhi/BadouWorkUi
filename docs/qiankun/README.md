# Qiankun 微前端指南

> 适用对象:给 AionUi 接入新子应用 / 维护已有子应用 / 排查 dev 与 prod 联调问题的工程师。
>
> 适用版本:AionUi 主应用接入 qiankun shell 之后(2026-10 起的所有变更)。
>
> 相关约定:[`AGENTS.md`](../../AGENTS.md) 进程边界 / 路径别名 / 命名规范 / 测试。

## 目录

| 主题                                   | 文档                                             |
| -------------------------------------- | ------------------------------------------------ |
| 联调 / standalone / 临时屏蔽           | [01-quickstart.md](01-quickstart.md)             |
| 配置(注册表 / 端口 / env / 事件总线)   | [02-config.md](02-config.md)                     |
| dev 模式子应用配置(必装 shim)          | [03-dev-mode.md](03-dev-mode.md)                 |
| API baseUrl 解析(绝对 URL 策略)        | [04-baseurl.md](04-baseurl.md)                   |
| 子应用侧完整指南(进入子应用项目第一步) | [05-subapp-guide.md](05-subapp-guide.md)         |
| 构建与部署                             | [06-build-and-deploy.md](06-build-and-deploy.md) |
| 屏蔽(下线)某个子应用                   | [07-disable.md](07-disable.md)                   |
| 新增子应用检查清单                     | [08-checklist.md](08-checklist.md)               |
| 常见问题排查                           | [09-faq.md](09-faq.md)                           |
| 配置变更指南(改什么文件)               | [10-config-changes.md](10-config-changes.md)     |
| 完全移除子应用(项目不需要该功能)       | [11-complete-removal.md](11-complete-removal.md) |
| 相关文件清单                           | [12-related-files.md](12-related-files.md)       |

## 阅读路径

- **第一次接入新子应用**:[01](01-quickstart.md) → [02](02-config.md) → [03](03-dev-mode.md) → [05](05-subapp-guide.md) → [08](08-checklist.md)
- **排查 dev 模式问题**(import 报错 / React Refresh 报错 / 路由跳错):[03](03-dev-mode.md) + [09-faq](09-faq.md)
- **排查 API 404**(`/api/api/...` / 跨域 / 绝对地址问题):[04](04-baseurl.md) + [09-faq](09-faq.md)
- **临时关停 / 灰度子应用**:[07](07-disable.md) + [10.4](10-config-changes.md#104-临时屏蔽某个子应用无需发版)
- **新增 / 改 name / 改 dev 端口 / 改 entry URL**:`[10](10-config-changes.md)` 表格
- **从代码仓库彻底删掉某个子应用**:[11](11-complete-removal.md)(8 阶段 + 提交拆分)
- **只想知道某个文件在哪**:`[12](12-related-files.md)`

## 架构总览

AionUi 采用 **qiankun 微前端** 架构。主应用(Electron + WebUI 双形态)只负责 shell 与公共能力,具体业务页面按子应用划分,每个子应用是独立的 Vite 项目,通过 `loadMicroApp` 在运行时挂载到主应用提供的容器节点。

```
┌─────────────────────────────────────────────────────────────┐
│                    AionUi 主应用 (shell)                     │
│  packages/desktop/src/renderer/micro-app/                   │
│  ┌────────────────────┐    ┌──────────────────────────────┐  │
│  │ MICRO_APP_DEFAULTS │ -> │ startMicroApps               │  │
│  │ + getDevEntryPort  │    │  - registerMicroApps         │  │
│  └────────────────────┘    │  - start() with sandbox      │  │
│           │                 └──────────────────────────────┘  │
│           ▼                                │                  │
│  MicroAppBootstrap  (启动 + 主题/语言广播)  │                  │
│  MicroAppPlaceholder (容器 + ErrorBoundary) │                  │
│  MicroAppHost (loadMicroApp 真正驱动挂载)   ▼                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ 运行时通过 entry 拉取 HTML/JS
   ┌───────────────────┬───────┴────────┬──────────────┐
   ▼                   ▼                ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐  ┌─────────────┐
│ meeting-    │ │   notes     │ │ knowledge-  │  │  (future)   │
│ recording   │ │             │ │ base        │  │   子应用     │
│             │ │             │ │             │  │             │
│ :7991       │ │ :7992       │ │ :7993       │  │             │
└─────────────┘ └─────────────┘ └─────────────┘  └─────────────┘
```

对应的 workspace 包(`packages/microapps/` 下):

| 目录                 | npm 包名                             | 子应用 |
| -------------------- | ------------------------------------ | ------ |
| `meeting-recording/` | `@aionui/microapp-meeting-recording` | 是     |
| `notes/`             | `@aionui/microapp-notes`             | 是     |
| `knowledge-base/`    | `@aionui/microapp-knowledge-base`    | 是     |
| `shared/`            | `@aionui/microapp-shared`            | 否     |

`shared` **不是子应用**,只是 `createIpcResolver` / `adapter` / `auth` 等跨应用公共代码的载体。它没有 `dev` script,所以根目录 `bun run dev:all` 的扫描会自动跳过。

界面上要跨主应用与子应用复用的组件(图标、空状态、异步边界)放在另一个包 `@aionui/ui`(`packages/ui/`),它同样不是子应用,只负责界面层,不依赖主应用。子应用怎么用它见 [公共组件使用手册](../contributing/ui-components/)。

**关键不变量**:

- `name` 在所有出现处必须一致(qiankun 注册名 == `main.ts` 里 `window[name]` 生命周期注册名 == 子应用内部状态 key)
- dev port 在 `getDevEntryPort()` 和子应用 `vite.config.ts` 的 `server.port` 两处必须一致,且子应用要开 `strictPort`
- 子应用独立运行(`window.__POWERED_BY_QIANKUN__` 为 false)时,使用 mock props 直接 `render()`
- 主应用未开启微应用时(`VITE_MICRO_APP_ENABLED` 转小写后不等于 `'true'`),`startMicroApps` 直接 return,qiankun 不会被加载

## 常用命令

| 命令                                            | 起什么                                   |
| ----------------------------------------------- | ---------------------------------------- |
| `bun run dev`                                   | 只起主应用(electron-vite dev),不拉子应用 |
| `bun run dev:all`                               | 根目录:主应用 + 全部子应用一条命令拉起   |
| `cd packages/microapps/<name> && bun run dev`   | 单独起一个子应用                         |
| `bun run build:all`                             | 打包主应用 + 把全部子应用打进安装包      |
| `cd packages/microapps/<name> && bun run build` | 单独构建一个子应用,产物可直接传 CDN      |

> `bun run dev` 下访问 `/knowledge-base` 会报 `ERR_CONNECTION_REFUSED` —— 子应用 dev server 没起,这是预期行为。要联调子应用就用 `bun run dev:all`。

子应用产物是标准 HTML(`dist/index.html`),不是 UMD;一份产物同时支持「打进安装包」和「独立部署到 CDN」两种形态,详见 [06-build-and-deploy.md](06-build-and-deploy.md)。`build` / `build:all` 打几个架构由构建机决定(Intel Mac 只出 x64,Apple Silicon 出 arm64 + x64),原因和 CI 的对应关系见 [06 的架构一节](06-build-and-deploy.md#方式一内置安装包bun-run-buildall)。联调见 [01-quickstart.md](01-quickstart.md)。
