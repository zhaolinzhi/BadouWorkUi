# 01. 联调 / Standalone / 临时屏蔽

> 适用对象:第一次跑通主应用 + 子应用,或临时只想跑某个子应用 / 临时关停某个子应用。
>
> 配置 / 注册表 / env 等"要改什么文件"的问题见 [02-config.md](02-config.md)。

## 3.1 主应用 + 所有子应用(联调)

`packages/desktop/.env.development` 默认开启 `VITE_MICRO_APP_ENABLED=true`,所以 `bun run dev` 会直接拉取子应用。最简模式:

```bash
# 终端 1:主应用
cd packages/desktop
bun run dev

# 终端 2/3:子应用(每个子应用独立 dev server)
cd packages/microapps/notes
bun run dev
```

打开 `http://localhost:<主应用dev端口>/<activeRule>`(例:`/notes`)即可看到子应用渲染。

## 3.2 主应用 + 指定子应用

只想跑某个子应用时,启动主应用时只给它注入 entry,其它子应用 entry 留空即可:

```bash
# 例:只想联调 notes,不想要 meeting-recording
VITE_MEETING_RECORDING_APP_ENTRY= bun run dev
```

空 entry 会回退到 `//localhost:7991`,但 dev 端口未启动 → `loadMicroApp` 失败 → `MicroAppErrorBoundary` 渲染降级页,不影响其它子应用。

## 3.3 屏蔽某个子应用(临时调试)

- **临时调试**:shell 临时变量 `VITE_<NAME>_APP_ENTRY=https://invalid.local/<name>.js bun run dev`,改完即生效
- **个人持久覆盖**:`packages/desktop/.env.local`(gitignore)写 `VITE_<NAME>_APP_ENTRY=`
- **生产灰度**:CI 注入 `VITE_<NAME>_APP_ENTRY` 指向 stub / invalid URL

**代码、env 默认文件、测试全部不动**。需要彻底下线走 [07-disable.md](07-disable.md) 或 [11-complete-removal.md](11-complete-removal.md)。
