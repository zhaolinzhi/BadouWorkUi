# 11. 完全移除子应用(项目不需要该功能)

> 适用对象:项目从一开始就不需要某个 qiankun 子应用,要从代码仓库里**彻底删除**(主应用业务代码、i18n、测试、文档)。
>
> 与 [07-disable.md](07-disable.md) 的区别:§6 是「项目已经接入了子应用,只想关停它(代码保留)」;本节是「项目从一开始就不需要这个功能」。后者改动面比前者大得多。

## 11.1 适用场景

| 场景                                       | 用 §7 屏蔽 | 用 §11 移除 |
| ------------------------------------------ | ---------- | ----------- |
| 临时调试,排查主应用问题                    | ✅         | ❌(改太多)  |
| 生产紧急回滚某个子应用                     | ✅         | ❌          |
| 功能做完了不再用,但想保留可恢复性          | ✅         | ❌          |
| 项目从一开始就不需要这个功能(需求规划阶段) | ❌         | ✅          |
| 某个功能要换成新方案(旧方案先全删)         | ❌         | ✅          |
| 子应用代码有严重问题,先全删重新接入        | ❌         | ✅          |

## 11.2 决策树:子应用处于哪种状态?

**先判断子应用是「完整迁移」还是「半迁移」**,因为决定要删多少东西。

| 状态                          | 标志                                              | 阶段 1-2 是否必做        |
| ----------------------------- | ------------------------------------------------- | ------------------------ |
| **A:完整迁移**                | `Router.tsx` 中路由指向 `MicroAppPlaceholder`     | 跳过(无主应用业务代码)   |
| **B:半迁移 / 主应用原生功能** | `Router.tsx` 中路由指向 `React.lazy` 的主应用页面 | 必做(主应用业务代码要清) |

判断方法:看 [packages/desktop/src/renderer/components/layout/Router.tsx](../../packages/desktop/src/renderer/components/layout/Router.tsx) 的 `path='/<name>'` 行:

- `element={<MicroAppPlaceholder microAppName='<name>' />}` → 状态 A
- `element={withRouteFallback(XxxPage)}` → 状态 B(主应用页面还在用)

## 11.3 完整删除清单(8 阶段)

按依赖关系排,前一阶段没删干净后一阶段会编译失败 / 测试挂。

### 阶段 1:主应用业务代码(状态 B 必做,状态 A 跳过)

```
packages/desktop/src/renderer/pages/<name>/                 # 路由对应的页面
packages/desktop/src/renderer/components/<name>/            # 子应用专属组件
packages/desktop/src/renderer/hooks/<name>/                 # 专属 hooks
packages/desktop/src/renderer/shared/<name>/                # 业务逻辑 + API + components + __tests__
packages/desktop/src/process/services/<name>/               # 主进程服务
packages/desktop/src/process/bridge/<name>Bridge.ts         # IPC 桥
packages/desktop/src/process/bridge/index.ts                # 去掉 import + registerXxxBridge() 调用
packages/desktop/src/common/types/<name>.ts                 # 公共类型(如有)
```

### 阶段 2:零散的 main app 引用

```bash
grep -rn "<name>\|<Name>\|<NAME>" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  packages/desktop/src/renderer/main.tsx \
  packages/desktop/src/renderer/types.d.ts \
  packages/desktop/src/renderer/utils/ui/ \
  packages/desktop/electron.vite.config.ts
```

常见位置:

| 位置                         | 常见引用                                   |
| ---------------------------- | ------------------------------------------ |
| `main.tsx`                   | 路由注册、Sider 菜单的菜单项、运行时副作用 |
| `types.d.ts`                 | module declaration、全局 type              |
| `utils/ui/runtimePatches.ts` | 与该功能相关的运行时补丁                   |
| `electron.vite.config.ts`    | 主进程额外的打包配置                       |

### 阶段 3:测试

```bash
grep -rl "<name>\|<Name>\|<NAME>" tests/
```

通常至少包括:

- 渲染层:组件 / hook / page 的 `*.test.tsx`
- 主进程层:service / bridge 的 `*.test.ts`
- shared 内的 `__tests__/` 子目录(随阶段 1 整体删除)

### 阶段 4:i18n

```bash
grep -l "<name>\|<Name>\|<NAME>" \
  packages/desktop/src/renderer/services/i18n/locales/*/index.ts
```

`packages/desktop/src/renderer/services/i18n/locales/<lang>/index.ts` 每个受影响的语言都要删。删完后跑:

```bash
bun run i18n:types
node scripts/check-i18n.js   # 校验所有语言对齐
```

### 阶段 5:微应用脚手架

```
packages/microapps/<name>/    # 整个删
```

> 状态 A(已完整迁移)时这个目录是子应用本体,必须删。状态 B(半迁移)时这个目录可能是死代码,删了不影响运行。

### 阶段 6:配置注册

| 文件                                                                                                                                                             | 改什么                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [packages/desktop/src/renderer/micro-app/config/micro-apps.ts](../../packages/desktop/src/renderer/micro-app/config/micro-apps.ts)                               | 删 `MICRO_APP_DEFAULTS[name]` + `getDevEntryPort` 中的端口 |
| [packages/desktop/src/renderer/components/layout/Router.tsx](../../packages/desktop/src/renderer/components/layout/Router.tsx)                                   | 删 `<Route path='/<name>' ...>` + 对应 lazy import         |
| [packages/desktop/src/renderer/micro-app/**tests**/micro-apps-config.test.ts](../../packages/desktop/src/renderer/micro-app/__tests__/micro-apps-config.test.ts) | 删对应 describe 块                                         |
| [packages/desktop/.env.development](../../packages/desktop/.env.development) / [.env.production](../../packages/desktop/.env.production)                         | 删 `VITE_<NAME>_APP_ENTRY=`                                |

详细步骤参见 [10.5](10-config-changes.md#105-永久下线某个子应用)。

### 阶段 7:文档

| 文件                                  | 改什么                                                      |
| ------------------------------------- | ----------------------------------------------------------- |
| `docs/features/<name>.md`             | 整个删(如有)                                                |
| `docs/qiankun/`(本目录)               | 架构图 / 端口表 / 示例 / 屏蔽方式例子 都要去掉该子应用      |
| `docs/superpowers/specs/*-<name>*.md` | 设计 spec 归档到 `docs/superpowers/specs-archive/` 或直接删 |

### 阶段 8:校验

```bash
# 1. 类型 / 格式 / lint
bunx tsc --noEmit
bun run lint:fix
bun run format

# 2. 测试
bun run test

# 3. i18n 一致性
bun run i18n:types
node scripts/check-i18n.js

# 4. 全局扫一遍残留
grep -r "<name>\|<Name>\|<NAME>" \
  --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git
# 期望:0 条命中(或仅命中已归档的 spec)
```

## 11.4 建议的提交拆分

不要一次性大爆炸。按 8 个阶段分 7-8 个 commit,每个 commit 跑完校验,出问题好回滚:

| #   | Commit message                                                  | 涉及阶段 |
| --- | --------------------------------------------------------------- | -------- |
| 1   | `chore(<scope>): remove main app pages/components/hooks/shared` | 1        |
| 2   | `chore(<scope>): clean up process/bridge/common references`     | 1 续     |
| 3   | `chore(<scope>): drop scattered main app references`            | 2        |
| 4   | `test: drop <name> test files`                                  | 3        |
| 5   | `i18n: drop <name> keys`                                        | 4        |
| 6   | `chore: remove <name> microapp package`                         | 5        |
| 7   | `chore(micro-app): unregister <name>`                           | 6        |
| 8   | `docs: drop <name> feature doc & docs updates`                  | 7        |

> `<scope>` 建议用主应用 `desktop` 或 `core`,按 monorepo 实际约定来。

## 11.5 速查:本仓库 `meeting-recording` 案例

本仓库 `meeting-recording` **已全量迁移为 qiankun 微应用**:

- 路由在主应用 `Router.tsx` 通过 `MicroAppPlaceholder microAppName='meeting-recording'` 挂载
- 组件 / hook / page / 测试 全部位于 `packages/microapps/meeting-recording/src/`
- 主应用 `pages/components/hooks/shared/meeting-recording/` 4 个目录已删除
- `tests/unit/renderer/` 下的 7 个 meeting-recording 测试已迁移到微应用内
- `__qiankun__/ipc.ts` 封装 `(0, eval)('window')` indirect eval 解决 qiankun 沙箱访问主进程 `ipcBridge.meetingRecording` 的问题

如果新项目不需要该功能,完整流程涉及:

- 阶段 1:7 个目录 + 2 个 process 文件 + 1 个 types 文件
- 阶段 2:`main.tsx` / `types.d.ts` / `runtimePatches.ts` / `electron.vite.config.ts` 4 处零散引用
- 阶段 3:9 个测试文件 + 1 个 `__tests__` 子目录
- 阶段 4:13 个 locale 文件
- 阶段 5:`packages/microapps/meeting-recording/` 整个
- 阶段 6:5 个文件(配置 + 路由 + 测试 + 2 个 env)
- 阶段 7:`docs/features/meeting-recording.md` + `docs/qiankun/` 全文更新
- 阶段 8:校验
