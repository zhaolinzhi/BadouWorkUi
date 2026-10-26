# 07. 屏蔽(下线)某个子应用

> 适用对象:想临时关停 / 灰度 / 永久下线某个子应用,但**保留**子应用代码和注册表条目的工程师。
>
> 如果要从代码仓库**彻底删除**该子应用(主应用业务代码、i18n、测试、文档一起清),见 [11-complete-removal.md](11-complete-removal.md)。

有 **4 种** 方式,按推荐顺序排列,适用场景不同。

## 方式 A:运行时关停(最快,无需发版)

把环境变量 `VITE_<NAME>_APP_ENTRY` 指向一个**不可达**的地址(主应用加载失败但不影响主应用)。**推荐做法**:

```bash
# 把 notes 指向一个无效地址,等同于"屏蔽"
VITE_NOTES_APP_ENTRY=https://invalid.local/notes-not-deployed.js
```

> ⚠️ **单纯把它置空不算屏蔽**。空值只表示"不单独覆盖",entry 会落到 `VITE_MICRO_APP_ASSET_BASE`(打包态是 `app://microapps`,子应用照样能加载)—— 解析链见 [02-config.md#232-为什么这些变量可以留空](02-config.md#232-为什么这些变量可以留空)。要真正让它加载失败,必须给一个**不可达**的地址。

> 注意:这不会从 MICRO_APP_DEFAULTS 移除条目,只是让 `loadMicroApp` 加载失败。主路由访问 `/notes` 时,`MicroAppHost` 会 catch error 并在 `MicroAppErrorBoundary` 中渲染降级页面。

**适用范围**:临时屏蔽、紧急回滚、A/B 实验。

## 方式 B:环境变量总开关(全部屏蔽)

```bash
# 作用在构建进程上 —— 渲染进程读的是构建期烘进 bundle 的常量,不是运行时环境
VITE_MICRO_APP_ENABLED=false bun run build
```

dev 下则写进 `packages/desktop/.env.local`(gitignore,优先级高于 `.env.development`):

```
VITE_MICRO_APP_ENABLED=false
```

`isMicroAppEnabled()` 返回 false 时,`startMicroApps` 第一行就 return,子应用不会自动注册到路由,qiankun 也不会被动态 import。

> ⚠️ **只管 WebUI 路径**。Electron 桌面端(`window.electronAPI` 存在)`MicroAppBootstrap` 里那道守卫直接跳过,压根不调 `startMicroApps` —— 桌面端的子应用是**按路由**由 `Router.tsx` → `MicroAppPlaceholder` → `MicroAppHost` → `loadMicroApp` 加载的,**不受这个开关影响**。桌面端要屏蔽某个子应用,用方式 A;要整个关掉微前端,得把 `Router.tsx` 里的 `<MicroAppPlaceholder>` 路由摘掉。

**适用范围**:WebUI 形态下完全关闭微前端模式、紧急排障。

## 方式 C:从注册表移除(完全下线单个子应用)

编辑 `packages/desktop/src/renderer/micro-app/config/micro-apps.ts`,删除对应条目:

```diff
 export const MICRO_APP_DEFAULTS: Record<string, Omit<MicroAppConfig, 'entry'>> = {
   'meeting-recording': { ... },
-  notes: {
-    name: 'notes',
-    activeRule: '/notes',
-    container: '#notes-container',
-  },
 };
```

同时清理:

- `getDevEntryPort` 中的 `notes: 7992` 一行
- 主应用路由中 `<MicroAppPlaceholder microAppName="notes" />` 的引用
- `packages/desktop/src/renderer/micro-app/__tests__/micro-apps-config.test.ts` 中 notes 的 describe 块

**适用范围**:永久下线。需要发版,迁移成本高于 A / B。

> 本节是「屏蔽」视角,只列最少改动。如果要从代码仓库**完全删除**该子应用(包括主应用业务代码、i18n、测试、文档),改动面比这里大得多,见 [11-complete-removal.md](11-complete-removal.md)。

## 方式 D:子应用发布空 stub(优雅降级)

部署一个返回 200 的 HTML stub(内含一段注册了空 `bootstrap / mount / unmount` 的脚本),URL 指向该 stub。`loadMicroApp` 成功但页面空白,主应用菜单项仍可见但点击后无内容。

**适用范围**:需要保留菜单入口、避免 404 报错、对用户保留"功能即将上线"占位的场景。

## 推荐组合

| 场景                                               | 方式                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| 紧急回滚                                           | A                                                                  |
| 临时关停某个实验性子应用                           | A 或 D                                                             |
| 主应用桌面端(不需要微前端)                         | A(单个)/ 摘掉 `Router.tsx` 里的 `<MicroAppPlaceholder>` 路由(全部) |
| 永久下线某个子应用(只动配置)                       | C                                                                  |
| 从代码仓库**完全删除**某个子应用(项目不需要该功能) | 见 [11-complete-removal.md](11-complete-removal.md)                |
| 用户可见"功能下线"提示                             | C + 路由层 redirect 404                                            |
