# 06. 构建与发布 / 部署

> 适用对象:运维 / 发布工程师,或改 `VITE_<NAME>_APP_ENTRY` 默认值 / 上 CDN 的人。
>
> "只改配置不动代码"的下线 / 屏蔽流程见 [07-disable.md](07-disable.md)。完全从仓库删子应用见 [11-complete-removal.md](11-complete-removal.md)。

## 4. 构建与发布

### 4.1 子应用构建(UMD)

每个子应用的 `vite.config.ts` 声明 UMD 输出:

```ts
// packages/microapps/notes/vite.config.ts
build: {
  lib: {
    entry: path.resolve(__dirname, 'src/main.ts'),
    name: 'notes',  // UMD global 名,必须与 MICRO_APP_DEFAULTS.name 一致
    formats: ['umd'],
    fileName: () => 'notes.js',
  },
  rollupOptions: {
    external: ['react', 'react-dom', 'react-router-dom', '@arco-design/web-react'],
    output: {
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        'react-router-dom': 'ReactRouterDOM',
        '@arco-design/web-react': 'ArcoDesign',
      },
    },
  },
}
```

构建命令:

```bash
cd packages/microapps/notes
bun run build
# 产物在 dist/notes.js(UMD)
```

**关键约束**:

- `name` 必须与 `MICRO_APP_DEFAULTS.name` 严格一致
- `react / react-dom / react-router-dom / @arco-design/web-react` 等主应用已有的依赖必须 external,避免重复打包
- externals 的 globals 名称要写对(`React` / `ReactDOM` / `ReactRouterDOM` / `ArcoDesign`)

### 4.2 主应用构建

```bash
cd packages/desktop
bun run build
```

主应用在 `startMicroApps` 中通过 `import('qiankun')` 动态加载 qiankun,只有 `VITE_MICRO_APP_ENABLED=true` 时才会真正进入该路径,因此默认构建不会把 qiankun 拉进主 bundle。

### 4.3 发布流程

子应用与主应用**独立发版**:

1. **子应用发版**:
   - `bun run build` 产出 `dist/notes.js`
   - 上传至 CDN / 静态资源服务
   - 记录公网 URL,例如 `https://cdn.example.com/microapps/notes/v1.2.3/notes.js`
   - 通过环境变量 `VITE_NOTES_APP_ENTRY` 在主应用部署配置中覆盖(见第 5 节)

2. **主应用发版**:
   - `bun run build` 产出桌面 / WebUI 产物
   - 部署时设置 `VITE_MICRO_APP_ENABLED=true` 以及各个 `VITE_<NAME>_APP_ENTRY`
   - 灰度策略:先灰度环境变量(URL 指向新版本子应用),再灰度主应用

**版本不绑定**:子应用可独立升级 / 回滚,主应用无需重新发版。

---

## 5. 部署

### 5.1 子应用静态资源

子应用构建产物是单个 UMD 文件(`dist/notes.js`),可部署到:

- CDN(阿里云 / 腾讯云 / Cloudflare)
- 对象存储 + CDN(OSS / COS / S3)
- 任意能托管静态 JS 的 Web 服务器

**CORS 要求**:子应用 dev server 必须返回 `Access-Control-Allow-Origin: *`(见 `vite.config.ts` 的 `server.headers`),否则主应用 origin 拉取会被浏览器拒绝。生产 CDN 一般也需配置 CORS。

### 5.2 主应用部署配置

主应用在 `electron.vite.config.ts` / `.env.*` 中读取 `VITE_*` 变量。生产环境典型配置:

```bash
# .env.production 或 CI 注入
VITE_MICRO_APP_ENABLED=true
VITE_MEETING_RECORDING_APP_ENTRY=https://cdn.example.com/microapps/meeting-recording/v2.1.0/meeting-recording.js
VITE_NOTES_APP_ENTRY=https://cdn.example.com/microapps/notes/v1.0.0/notes.js
VITE_KNOWLEDGE_BASE_APP_ENTRY=https://cdn.example.com/microapps/knowledge-base/v1.0.0/knowledge-base.js
VITE_SHELL_VERSION=1.5.0  # 透传给子应用,子应用可基于此做兼容性判断
```

> 只发布其中一个子应用时,其余的 entry **留空即可**,不必指向 invalid URL —— 留空会回退到 `//localhost:<port>`,生产环境那个端口没有服务,`loadMicroApp` 同样失败并走 `MicroAppErrorBoundary` 降级页。

### 5.3 容器占位

主应用通过 `<MicroAppPlaceholder microAppName="notes" />` 在主路由中渲染容器节点 `<div id="notes-container" />`。**容器 ID 与 `MICRO_APP_DEFAULTS.container` 必须严格一致**。

主应用菜单(通常由后端下发)命中 `activeRule` 时,路由指向占位组件,占位组件加载 `MicroAppHost`,后者调用 `qiankun.loadMicroApp` 把子应用挂到该容器。

### 5.4 灰度与回滚

- **子应用灰度**:切换 `VITE_<NAME>_APP_ENTRY` 指向新版本 URL,主应用无需重启
- **子应用回滚**:把环境变量改回旧版本 URL 即可
- **主应用灰度**:常规蓝绿 / 灰度发布策略,环境变量随主应用配置走
