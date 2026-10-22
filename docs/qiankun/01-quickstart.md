# 01. 联调 / Standalone / 临时屏蔽

> 适用对象:第一次跑通主应用 + 子应用,或临时只想跑某个子应用 / 临时关停某个子应用。
>
> 配置 / 注册表 / env 等"要改什么文件"的问题见 [02-config.md](02-config.md)。

## 3.1 主应用 + 所有子应用(联调)

`packages/desktop/.env.development` 默认开启 `VITE_MICRO_APP_ENABLED=true`,所以主应用会直接拉取子应用。**在仓库根目录跑一条命令就够了**:

```bash
bun run dev:all
```

它等价于同时启动:

| 进程       | 命令                                                | 说明                                            |
| ---------- | --------------------------------------------------- | ----------------------------------------------- |
| shell      | `bun run dev`(根目录)                               | electron-vite dev,起 Electron 主应用            |
| 子应用 × N | `packages/microapps/*` 里每个有 `dev` script 的目录 | 逐个 `bun run dev`,`shared` 没有 dev 会自动跳过 |

- 每路输出带彩色前缀(`[shell]` / `[app:notes]`),Ctrl-C 一次全停;任何一路挂了会把其余几路一起收掉,不留孤儿 vite 占端口。
- 新增子应用只要在它的 `package.json` 里写了 `dev` script,就会被自动带上,不用改这个脚本。
- 启动前会先检查子应用端口(7991 / 7992 / 7993)是否被占着。**手动开过子应用是最常见的冲突来源**,脚本会直接把占着的端口和 pid 打印出来并让你先停掉,而不是等 vite 起了一半才报错。子应用的 `vite.config.ts` 同时开了 `strictPort`,端口漂移会直接失败而不是静默顺延 —— 否则主应用仍按约定端口拼 entry,结果是一个查不出原因的空白页。

打开 `http://localhost:<主应用dev端口>/<activeRule>`(例:`/notes`)即可看到子应用渲染。

当前子应用与端口:

| 子应用              | activeRule           | dev 端口 |
| ------------------- | -------------------- | -------- |
| `meeting-recording` | `/meeting-recording` | 7991     |
| `notes`             | `/notes`             | 7992     |
| `knowledge-base`    | `/knowledge-base`    | 7993     |

> **只想起主应用**(`bun run dev`):子应用 dev server 不会启动,访问 `/knowledge-base` 这类子应用路由会报 `ERR_CONNECTION_REFUSED` —— entry 指向 `//localhost:7993` 但那里没有服务。这是有意的:调试主应用本身(路由、布局、非微应用的业务)时不需要背三个 vite 的内存开销。
>
> 需要单独调试某一个子应用(改代码、不用带 Electron)时,可以在它自己的目录里 `bun run dev` 独立跑。

## 3.2 主应用 + 指定子应用

只想跑某个子应用时,启动主应用时只给它注入 entry,其它子应用 entry 留空即可:

```bash
# 终端 1:主应用(等价于根目录的 bun run dev)
VITE_MEETING_RECORDING_APP_ENTRY= bun run dev

# 终端 2:只起要联调的那个子应用
cd packages/microapps/notes && bun run dev
```

空 entry 会回退到 `//localhost:7991`,但 7991 上没有服务 → `loadMicroApp` 失败 → `MicroAppErrorBoundary` 渲染降级页,不影响 notes。

## 3.3 屏蔽某个子应用(临时调试)

- **临时调试**:shell 临时变量 `VITE_<NAME>_APP_ENTRY=https://invalid.local/<name>/index.html bun run dev`,改完即生效
- **个人持久覆盖**:`packages/desktop/.env.local`(gitignore)写 `VITE_<NAME>_APP_ENTRY=`
- **生产灰度**:CI 注入 `VITE_<NAME>_APP_ENTRY` 指向 stub / invalid URL

**代码、env 默认文件、测试全部不动**。需要彻底下线走 [07-disable.md](07-disable.md) 或 [11-complete-removal.md](11-complete-removal.md)。
