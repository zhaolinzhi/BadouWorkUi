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

| 变量名                             | 作用                                | 留空时                            | 备注                                            |
| ---------------------------------- | ----------------------------------- | --------------------------------- | ----------------------------------------------- |
| `VITE_MICRO_APP_ENABLED`           | 总开关                              | `false`                           | 仅在 `true` 时主应用会加载 qiankun 并启动子应用 |
| `VITE_MICRO_APP_ASSET_BASE`        | 整批子应用的分发基址                | 不分发(走 dev port)               | 填了就把 entry 拼成 `<base>/<name>/index.html`  |
| `VITE_MEETING_RECORDING_APP_ENTRY` | meeting-recording 子应用 entry 覆盖 | 走 asset base(dev 下是 7991 端口) | 优先级最高,单个应用覆盖;留空即"不单独覆盖"      |
| `VITE_NOTES_APP_ENTRY`             | notes 子应用 entry 覆盖             | 走 asset base(dev 下是 7992 端口) | 同上                                            |
| `VITE_KNOWLEDGE_BASE_APP_ENTRY`    | knowledge-base 子应用 entry 覆盖    | 走 asset base(dev 下是 7993 端口) | 同上                                            |

> 这几个变量在 `packages/desktop/.env.production` 里都留空,打包出来却照样能显示 —— 原因见 [2.3.2 为什么这些变量可以留空](#232-为什么这些变量可以留空)。

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

> **envDir 必须是 `packages/desktop/`**。Vite 只在 `envDir` 下找 `.env*` 文件,而 electron-vite 默认把渲染进程的 `envDir` 设成 `options.root || process.cwd()` —— `bun run dev` 的 CLI 没带 `[root]` 位置参数,于是它落在**仓库根**;Vite 自己的 `root` 又是 `packages/desktop/src/renderer`。这两个目录都没有 `.env`,`.env.development` / `.env.production` 就永远读不到,上表里的默认值全部形同虚设。
> 所以 `packages/desktop/electron.vite.config.ts` 里显式写了 `renderer.envDir: resolve(__dirname)`。改这个值之前请先想清楚落在哪 —— 见 `tests/unit/build-scripts/rendererEnvDir.test.ts`。
>
> 另外注意:第 1 条的"Shell 环境变量"指的是 **dev server / 构建进程启动那一刻**的环境变量(`bun run build:all` 注入的那批),不是应用运行时还能读到的。渲染进程运行时读到的 `import.meta.env.VITE_*` 是构建期烘进 bundle 的常量,改完必须重新构建。

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

- `VITE_MICRO_APP_ENABLED` 的大小写不敏感(`TRUE` / `True` / `true` 都触发),但 `1` / `yes` / `on` 这类**不会** —— 代码只认字符串 `'true'`(`raw.toString().toLowerCase() === 'true'`)
- `isMicroAppEnabled()` 只读 `import.meta.env`,不读 `process.env`。打包态 Vite 把 `process.env` 静态替换成 `{}`,dev 态渲染进程的主世界又没有 `process` —— 两条路都拿不到值,所以在 shell 里 `export VITE_MICRO_APP_ENABLED=true` 是**没用**的
- 修改 `.env` 后必须重启 dev server(Vite 在启动时读取 env,不会 hot reload)
- 浏览器端访问的 `import.meta.env.VITE_*` 是构建时常量,不是运行时变量,改完必须重新 `bun run build`

### 2.3.2 为什么这些变量可以留空

`packages/desktop/.env.production` 里 `VITE_MICRO_APP_ASSET_BASE` 和三个 `VITE_<NAME>_APP_ENTRY` **都是空的**,但 `bun run build:all` 打出来的包照样能正常显示子应用。原因有两层。

**第一层:打包时这些变量不是空的 —— 构建脚本会覆盖。**

[`scripts/build-with-builder.js`](../../scripts/build-with-builder.js) 在 `electron-vite build` **之前**往 `process.env` 写:

```js
const bundleMicroApps = process.env.MICRO_APP_BUNDLE === '1';
if (bundleMicroApps) {
  process.env.VITE_MICRO_APP_ENABLED = 'true';
  process.env.VITE_MICRO_APP_ASSET_BASE = 'app://microapps';
}
```

Vite 里 `process.env` 优先级**高于** `.env` 文件,所以 `.env.production` 里的 `false` 和空串被直接盖掉。产物 `out/renderer/assets/index-*.js` 里烘进去的实际值就是 `app://microapps` 和 `true`。

**第二层:单应用 entry 留空 = "不单独覆盖",让位给 asset base。**

`getMicroAppConfig()` 的解析链里,`VITE_<NAME>_APP_ENTRY` 虽然排第一,但它只是**覆盖项**:留空 → `''.trim()` 是 falsy → 落到 `VITE_MICRO_APP_ASSET_BASE` → 拼成 `app://microapps/<name>/index.html`。

它的定位是"**只把某一个子应用指到别处**"(比如只有 notes 要上 CDN、版本号还不一样)。批量分发交给 asset base 统一管,所以默认留空。

**最后一环:`app://microapps/...` 的文件从哪来。**

| 环节                                                | 位置                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 子应用 dist 复制到 `out/renderer/microapps/<name>/` | [`scripts/build-micro-apps.mjs`](../../scripts/build-micro-apps.mjs) 的 `fs.cpSync(dist, target)`                         |
| 主进程把该目录注册成 `app://microapps/<name>/...`   | [`microApps/index.ts`](../../packages/desktop/src/process/resources/microApps/index.ts) 的 `protocol.handle('app', ...)`  |
| 资源根从 `app.getAppPath()` 推导                    | [`microApps/assets.ts`](../../packages/desktop/src/process/resources/microApps/assets.ts) 的 `resolveMicroAppAssetRoot()` |

必须走自定义协议:打包后渲染进程在 `file://` origin 上,fetch 不到 asar 里的本地文件。

**dev 与打包的差别**

| 场景                | `VITE_MICRO_APP_ASSET_BASE` 实际值 | entry 落到                     |
| ------------------- | ---------------------------------- | ------------------------------ |
| `bun run dev`       | `''`(`.env.development` 也是空)    | dev port,如 `//localhost:7992` |
| `bun run build:all` | `app://microapps`(脚本注入)        | asar 里的子应用产物            |

**那 `.env.production` 为什么还要写 `false` 和空值**

它是**兜底默认值**。普通 `bun run build`(不跑 `build:all`)时,子应用产物根本不在包里 —— 这时若 `VITE_MICRO_APP_ENABLED` 是 true,主应用会去 fetch `app://microapps/...` 拿到 404,直接白屏。写 `false` 让"没带微应用的包"默认不启用微应用。

这也正是 `MICRO_APP_BUNDLE=1` 要**强制跳过增量构建**的原因:增量缓存按源码 hash 判断,看不见刚注入的 env 变量,否则会复用上一次的 bundle(里面还是 `false`),装出一个"有子应用文件但永远不去加载"的包。

> **一句话**:`.env.*` 里留空的是"默认值",实际生效的值由构建脚本注入;`VITE_<NAME>_APP_ENTRY` 留空表示"不单独覆盖",交给 asset base 统一分发。
>
> 这些全是**构建期常量** —— 改完必须重新 `bun run build`。

## 2.4 跨应用事件总线

主应用 `MicroAppBootstrap` 广播:

- `theme:change` → `{ theme: 'light' | 'dark' }`
- `locale:change` → `{ locale: string }`

子应用通过 `props.on('theme:change', (next) => ...)` 订阅,**payload 是对象,不是裸值**。
