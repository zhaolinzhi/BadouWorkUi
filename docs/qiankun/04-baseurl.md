# 04. API baseUrl 解析(绝对 URL 策略)

> 适用对象:遇到 dev 模式接口 404(`http://localhost:5173/api/...` 或 `/api/api/...` 重复前缀)的开发者。
>
> API client 端到端约定(client.ts 怎么写、endpoint 怎么写)见 [05-subapp-guide.md#36-api-client-约定](05-subapp-guide.md#366-api-client-约定)。

## 3.5 子应用 API baseUrl 解析

子应用**不**走主应用的 `httpRequest`,而是自己 `fetch()`。所以 `MicroAppProps.baseApi` 必须是**绝对 URL** — 否则会解析到主应用 origin(Vite dev server / webui host),这两者都不代理 `/api/*`,请求直接 404。

主应用在 [`micro-apps.ts`](../../packages/desktop/src/renderer/micro-app/services/micro-apps.ts) 用 `getBaseUrl()` 拼出绝对地址:

| 运行环境         | 渲染进程 origin                          | `getBaseUrl()` 返回                              | `baseApi` 最终值             |
| ---------------- | ---------------------------------------- | ------------------------------------------------ | ---------------------------- |
| Electron dev     | `http://localhost:5173`(Vite dev server) | `http://127.0.0.1:<__backendPort>`(preload 注入) | `http://127.0.0.1:13400/api` |
| Electron prod    | `aionui://...` 自定义协议                | `http://127.0.0.1:<__backendPort>`               | `http://127.0.0.1:13400/api` |
| WebUI dev / prod | webui host                               | `''`(同源)                                       | `/api`(依赖 webui host 反代) |
| 单测(node)       | —                                        | `''`                                             | `/api`                       |

**约定**(由 `client.test.ts` 锁住):

- `baseApi` 包含 `/api` 前缀
- endpoint 路径**不**带 `/api`,例如 `client.get('/notebooks')` → 实际 fetch `/api/notebooks`
- endpoint 写 `/api/notebooks` 会变成 `/api/api/notebooks`,参见 [09-faq.md](09-faq.md)

**为什么不让子应用直接读 `import.meta.env`?** 因为 electron-vite 的子应用 dev server 和主应用 dev server 是两个独立 Vite 实例,各自有独立的 `import.meta.env`,子应用没法知道主应用的后端端口。统一由主应用通过 props 注入。

**CORS 依赖**:Electron dev 模式下子应用跨源到 `127.0.0.1:<port>`,依赖 aioncore 已经允许了来自 `localhost:5173` 的跨源请求(主应用 `httpRequest` 走的就是同一组地址,能跑通就说明 CORS 已开)。如果换 aioncore 部署方式导致 CORS 收紧,需要同时给 aioncore 加 `localhost:5173` 白名单,否则子应用 fetch 会被 CORS 拦截。
