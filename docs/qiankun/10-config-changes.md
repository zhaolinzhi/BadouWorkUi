# 10. 配置变更指南(改什么文件 / 是否要发版)

> 适用对象:要改"配置 / 端口 / 名称 / entry URL" 等具体某个东西的工程师。
>
> 配套阅读:[08-checklist.md](08-checklist.md) 是定性 checklist,本节是定量「要碰哪些文件 / 要不要发版」。
>
> 想临时关停某个子应用,见 [07-disable.md](07-disable.md);想从仓库彻底删某个子应用,见 [11-complete-removal.md](11-complete-removal.md)。

## 10.1 新增微应用

| 改动点       | 文件                                                                                                                                                             | 内容                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 注册表       | [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts)                               | `MICRO_APP_DEFAULTS` 加新条目;`getDevEntryPort` 加端口映射                        |
| 路由         | [packages/desktop/src/renderer/components/layout/Router.tsx](../../packages/desktop/src/renderer/components/layout/Router.tsx)                                   | 加 `<Route path='/前缀' element={<MicroAppPlaceholder microAppName='名字' />} />` |
| 开发环境变量 | [packages/desktop/.env.development](../../packages/desktop/.env.development)                                                                                     | 加 `VITE_<NAME>_APP_ENTRY=`                                                       |
| 生产环境变量 | [packages/desktop/.env.production](../../packages/desktop/.env.production)                                                                                       | 加 `VITE_<NAME>_APP_ENTRY=`(默认留空)                                             |
| 注册表测试   | [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-config.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-config.test.ts) | 加新子应用的 describe 块                                                          |
| 新建子应用   | `packages/microapps/<name>/`                                                                                                                                     | 完整子项目(`package.json` / `vite.config.ts` / `src/main.ts` / `index.html`)      |

> [08-checklist.md](08-checklist.md)「新增子应用检查清单」已经列了 9 个一致点,按那个走最稳。

## 10.2 修改 dev 端口

| 文件                                                                                                                               | 改什么                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts) | `getDevEntryPort` 中对应条目 |
| `packages/microapps/<name>/vite.config.ts`                                                                                         | `server.port`                |

> 顺便检查根目录 `package.json` 的 scripts 是否有引用该端口(如 `dev:<name>` 脚本),有则同步改。

## 10.3 修改生产 entry URL(CDN 域名 / 版本号)

**推荐走 CI 注入,不改代码仓库**。具体做法参见 [06-build-and-deploy.md#52-主应用部署配置](06-build-and-deploy.md#52-主应用部署配置)。

如果一定要在仓库里改默认值:

| 文件                                                                       | 改什么                        |
| -------------------------------------------------------------------------- | ----------------------------- |
| [packages/desktop/.env.production](../../packages/desktop/.env.production) | `VITE_<NAME>_APP_ENTRY=新URL` |

> 改完后必须 `bun run build` 重新构建。`import.meta.env.VITE_*` 是构建时常量,改 env 文件后浏览器读到的还是旧值。

## 10.4 临时屏蔽某个子应用(无需发版)

走 [07-disable.md](07-disable.md) 方式 A:把 `VITE_<NAME>_APP_ENTRY` 指向一个无效 URL,`loadMicroApp` 加载失败但不影响主应用,MicroAppErrorBoundary 会渲染降级页面。

| 场景         | 做法                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------ |
| 临时调试     | shell 临时变量 `VITE_<NAME>_APP_ENTRY=https://invalid.local/<name>/index.html bun run dev` |
| 个人持久覆盖 | [packages/desktop/.env.local](../../packages/desktop/.env.local)(gitignore)写一条          |
| 生产灰度     | CI 注入 `VITE_<NAME>_APP_ENTRY` 指向 stub / invalid URL                                    |

**代码、env 默认文件、测试全部不动**。

## 10.5 永久下线某个子应用

反向做 [10.1](#101-新增微应用) 的五个文件位置 + 视情况删子应用目录:

1. [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts):删 `MICRO_APP_DEFAULTS.<name>` 条目 + `getDevEntryPort.<name>`
2. [packages/desktop/src/renderer/components/layout/Router.tsx](../../packages/desktop/src/renderer/components/layout/Router.tsx):删对应 `<Route>`
3. [packages/desktop/.env.development](../../packages/desktop/.env.development) / [.env.production](../../packages/desktop/.env.production):删 `VITE_<NAME>_APP_ENTRY=`
4. [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-config.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-config.test.ts):删对应 describe 块
5. 视情况删 `packages/microapps/<name>/` 目录

> 如果该子应用是后端菜单下发的,需要同步通知后端下线该菜单项,否则后端菜单还在推 activeRule 进来会 404。

> 本节只覆盖「完整迁移」的子应用(路由指向 `MicroAppPlaceholder`)。如果子应用还有主应用业务代码(半迁移状态)、i18n、测试、文档要一起清,见 [11-complete-removal.md](11-complete-removal.md)。

## 10.6 修改 activeRule(URL 前缀)

| 文件                                                                                                                               | 改什么                                 |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts) | `MICRO_APP_DEFAULTS.<name>.activeRule` |
| [packages/desktop/src/renderer/components/layout/Router.tsx](../../packages/desktop/src/renderer/components/layout/Router.tsx)     | `path='/新前缀'`                       |
| 后端菜单                                                                                                                           | 如果菜单由后端下发,后端同步改          |

子应用内部 router base 一般不需要动(qiankun 通过 activeRule 匹配的是浏览器 URL,子应用自己管自己的内部路由)。

## 10.7 修改子应用 name(高风险)

`name` 是全局唯一标识,出现在多处,**改名 ≈ 重新接入**。如果只是想改 URL 前缀,请走 [10.6](#106-修改-activeruleurl-前缀) 而不是这一节。

涉及位置:

| 文件                                                                                                                                     | 改什么                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts)       | `MICRO_APP_DEFAULTS` 的 key、name 字段、container 选择器(`#${name}-container`) |
| [packages/desktop/src/renderer/components/layout/Router.tsx](../../packages/desktop/src/renderer/components/layout/Router.tsx)           | `microAppName='新名'`                                                          |
| `packages/microapps/<name>/src/main.ts`                                                                                                  | `window['新名']` 生命周期注册的键名(必须严格一致)                              |
| [packages/desktop/.env.development](../../packages/desktop/.env.development) / [.env.production](../../packages/desktop/.env.production) | 改 `VITE_<NAME>_APP_ENTRY=...` 的变量名                                        |
| 子应用内部                                                                                                                               | `qiankun lifecycle`、state key、localStorage 命名空间等所有引用 name 的地方    |
| 外部系统                                                                                                                                 | localStorage / API 路径中用到旧 name 的地方                                    |

> container 选择器是 `#${name}-container` 形式,改名后旧的 DOM 节点 id 也会变。如果有外部代码靠 id 查找(测试、e2e 脚本、文档),需要同步更新。

## 10.8 配置改动总览

| 改动类型                               | 涉及文件数           | 是否需要发版     |
| -------------------------------------- | -------------------- | ---------------- |
| 新增微应用                             | 5-6 个               | 是               |
| 修改 dev 端口                          | 2 个                 | 否(只影响 dev)   |
| 修改生产 entry URL(走 CI)              | 0(只改 CI 变量)      | 否(可灰度)       |
| 修改生产 entry URL(改 .env.production) | 1 个                 | 是(需重新 build) |
| 临时屏蔽子应用(方式 A)                 | 0                    | 否               |
| 永久下线子应用(方式 C)                 | 4-5 个               | 是               |
| 修改 activeRule                        | 2-3 个(含后端)       | 是               |
| 修改 name(高风险)                      | 5+ 个 + 子应用内多处 | 是               |
