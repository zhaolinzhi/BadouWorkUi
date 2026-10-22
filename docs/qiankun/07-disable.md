# 07. 屏蔽(下线)某个子应用

> 适用对象:想临时关停 / 灰度 / 永久下线某个子应用,但**保留**子应用代码和注册表条目的工程师。
>
> 如果要从代码仓库**彻底删除**该子应用(主应用业务代码、i18n、测试、文档一起清),见 [11-complete-removal.md](11-complete-removal.md)。

有 **4 种** 方式,按推荐顺序排列,适用场景不同。

## 方式 A:运行时关停(最快,无需发版)

设置环境变量 `VITE_<NAME>_APP_ENTRY` 为空字符串(主应用会回退到 dev port,但生产环境通常 dev port 不可达 → 子应用加载失败但不影响主应用)。**推荐做法**:

```bash
# 把 notes 指向一个无效地址,等同于"屏蔽"
VITE_NOTES_APP_ENTRY=https://invalid.local/notes-not-deployed.js
```

> 注意:这不会从 MICRO_APP_DEFAULTS 移除条目,只是让 `loadMicroApp` 加载失败。主路由访问 `/notes` 时,`MicroAppHost` 会 catch error 并在 `MicroAppErrorBoundary` 中渲染降级页面。

**适用范围**:临时屏蔽、紧急回滚、A/B 实验。

## 方式 B:环境变量总开关(全部屏蔽)

```bash
VITE_MICRO_APP_ENABLED=false
```

整个 `startMicroApps` 直接 return,**所有**子应用都不加载。qiankun 也不会动态 import。

**适用范围**:完全关闭微前端模式(例如 Electron 桌面端,菜单全走后端驱动)、紧急排障。

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

| 场景                                               | 方式                                                |
| -------------------------------------------------- | --------------------------------------------------- |
| 紧急回滚                                           | A                                                   |
| 临时关停某个实验性子应用                           | A 或 D                                              |
| 主应用桌面端(不需要微前端)                         | B                                                   |
| 永久下线某个子应用(只动配置)                       | C                                                   |
| 从代码仓库**完全删除**某个子应用(项目不需要该功能) | 见 [11-complete-removal.md](11-complete-removal.md) |
| 用户可见"功能下线"提示                             | C + 路由层 redirect 404                             |
