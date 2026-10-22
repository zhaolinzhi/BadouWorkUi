# 02. 配置(注册表 / 端口 / env / 事件总线)

> 主应用侧"配置在哪改"的总览。改什么 / 改哪里 / 是否要发版的具体动作清单见 [10-config-changes.md](10-config-changes.md)。

## 2.1 子应用注册表

文件:`packages/desktop/src/renderer/micro-app/config/micro-apps.ts`

```ts
export const MICRO_APP_DEFAULTS: Record<string, Omit<MicroAppConfig, 'entry'>> = {
  'meeting-recording': {
    name: 'meeting-recording',
    activeRule: '/meeting-recording',
    container: '#meeting-recording-container',
  },
  notes: {
    name: 'notes',
    activeRule: '/notes',
    container: '#notes-container',
  },
  'knowledge-base': {
    name: 'knowledge-base',
    activeRule: '/knowledge-base',
    container: '#knowledge-base-container',
  },
};
```

每个子应用必须声明:

| 字段         | 含义           | 约束                                                                                        |
| ------------ | -------------- | ------------------------------------------------------------------------------------------- |
| `name`       | qiankun 注册名 | 全局唯一,被用于 container id、子应用 `window[name]` 生命周期注册、localStorage key 命名空间 |
| `activeRule` | 路由前缀       | 与浏览器 URL 一一对应,通常来自后端菜单                                                      |
| `container`  | 挂载点选择器   | 必须是 `#${name}-container` 风格,由 `MicroAppPlaceholder` 提前渲染同名节点                  |

## 2.2 端口约定

文件同上,`getDevEntryPort` 函数:

```ts
const ports: Record<string, number> = {
  'meeting-recording': 7991,
  notes: 7992,
  'knowledge-base': 7993,
};
return ports[name] ?? 7999;
```

每个子应用独立 dev port,避免本地联调冲突。新增子应用时**必须**分配新端口并写进此表。

> 同一个端口还要在子应用自己的 `vite.config.ts` 的 `server.port` 里配一遍,并开 `strictPort: true`。两边不一致时,`strictPort` 会让 vite **直接失败**而不是静默顺延 —— 否则 `getMicroAppConfig()` 仍按约定端口拼 entry,主应用拿到的是一个查不出原因的空白页。

## 2.3 环境变量

| 变量名                             | 作用                                | 默认               | 备注                                            |
| ---------------------------------- | ----------------------------------- | ------------------ | ----------------------------------------------- |
| `VITE_MICRO_APP_ENABLED`           | 总开关                              | `false`            | 仅在 `true` 时主应用会加载 qiankun 并启动子应用 |
| `VITE_MICRO_APP_ASSET_BASE`        | 整批子应用的分发基址                | 空                 | 填了就把 entry 拼成 `<base>/<name>/index.html`  |
| `VITE_MEETING_RECORDING_APP_ENTRY` | meeting-recording 子应用 entry 覆盖 | `//localhost:7991` | 优先级最高,单个应用覆盖;留空走 dev port         |
| `VITE_NOTES_APP_ENTRY`             | notes 子应用 entry 覆盖             | `//localhost:7992` | 同上                                            |
| `VITE_KNOWLEDGE_BASE_APP_ENTRY`    | knowledge-base 子应用 entry 覆盖    | `//localhost:7993` | 同上                                            |

**entry 解析优先级**:`VITE_<NAME>_APP_ENTRY` → `VITE_MICRO_APP_ASSET_BASE` → dev port。asset base 两种分发共用同一个变量:内置安装包是 `app://microapps`,CDN 独立部署是 `https://cdn.example.com/microapps`。完整说明见 [06-build-and-deploy.md](06-build-and-deploy.md)。

**entry 必须是 HTML URL**,不能是裸 `.js` —— qiankun 的 `import-html-entry` 只从 HTML 里解析 script。

**命名规范**:`VITE_<UPPER_SNAKE_NAME>_APP_ENTRY`,由 `getMicroAppConfig` 运行时拼接:

```ts
const envKey = `VITE_${name.toUpperCase().replace(/-/g, '_')}_APP_ENTRY`;
const entry =
  envEntry.trim() || // 1. 单个应用覆盖
  (assetBase && `${assetBase}/${name}/index.html`) || // 2. 整批分发基址
  `${DEFAULT_DEV_ENTRY_BASE}${getDevEntryPort(name)}`; // 3. dev port 兜底
```

子应用自身的 `.env.development` / `.env.production` 仅供子应用独立运行时使用,主应用通过 `VITE_<NAME>_APP_ENTRY` 或 `VITE_MICRO_APP_ASSET_BASE` 注入 entry URL。

### 2.3.1 `VITE_MICRO_APP_ENABLED` 在哪里设置

主应用在 `packages/desktop/` 下提供**已提交**的 env 默认值,按 mode 自动加载:

| 文件                                | mode          | 默认值                         | 说明                                                 |
| ----------------------------------- | ------------- | ------------------------------ | ---------------------------------------------------- |
| `packages/desktop/.env.development` | `development` | `VITE_MICRO_APP_ENABLED=true`  | dev 模式默认开,`bun run dev` 直接生效                |
| `packages/desktop/.env.production`  | `production`  | `VITE_MICRO_APP_ENABLED=false` | 生产构建默认关,防止未配置 entry 时尝试加载 localhost |

**Vite / electron-vite 加载优先级**(高优先级覆盖低优先级):

1. **Shell 环境变量**(进程级,最高,需重启 dev server)
2. `packages/desktop/.env.local`(本地,gitignore,所有环境)
3. `packages/desktop/.env.[mode]`(按 mode 加载,例如 `bun run dev` 时加载 `.env.development`)
4. `packages/desktop/.env`(公共,默认不创建)

**典型工作流**:

- 开发者跑 `bun run dev` → 加载 `.env.development` → `VITE_MICRO_APP_ENABLED=true` → 子应用自动加载
- 个人想覆盖 → 创建 `packages/desktop/.env.local`,写自己的 entry URL(Vite 会优先读)
- 生产部署 → 默认从 `.env.production` 读 `false` → CI 注入 `VITE_MICRO_APP_ENABLED=true` 才启用
- CI/CD 注入(覆盖默认):

```yaml
# GitHub Actions 示例
env:
  VITE_MICRO_APP_ENABLED: ${{ vars.MICRO_APP_ENABLED }}
  VITE_MICRO_APP_ASSET_BASE: ${{ vars.MICRO_APP_ASSET_BASE }}
  VITE_NOTES_APP_ENTRY: ${{ vars.NOTES_APP_ENTRY }}
```

**判断生效与否**:

- 主应用启动后,在 DevTools console 输入 `import.meta.env.VITE_MICRO_APP_ENABLED`,应返回 `true`
- `MicroAppBootstrap` 会在 `useEffect` 内 `startMicroApps` → 浏览器 Network 面板应出现对 `VITE_<NAME>_APP_ENTRY` URL 的请求
- 若 `isMicroAppEnabled()` 返回 false,`startMicroApps` 第一行就 return,qiankun 不会被加载

**常见坑**:

- `VITE_MICRO_APP_ENABLED=TRUE` / `True` / `1` 都不生效,只有小写字符串 `'true'` 才会触发(代码:`raw.toString().toLowerCase() === 'true'`)
- 修改 `.env` 后必须重启 dev server(Vite 在启动时读取 env,不会 hot reload)
- 浏览器端访问的 `import.meta.env.VITE_*` 是构建时常量,不是运行时变量,改完必须重新 `bun run build`

## 2.4 跨应用事件总线

主应用 `MicroAppBootstrap` 广播:

- `theme:change` → `{ theme: 'light' | 'dark' }`
- `locale:change` → `{ locale: string }`

子应用通过 `props.on('theme:change', (next) => ...)` 订阅,**payload 是对象,不是裸值**。
