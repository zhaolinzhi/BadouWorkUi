# 05. 子应用侧完整指南

> 适用对象:**子应用开发者第一步**该看的内容。涵盖 `vite.config.ts` 必填项、`main.ts` 生命周期、API 约定、standalone 调试、测试模式、检查清单。
>
> 主应用侧的注册表 / entry 注入 / props 构造见 [04-baseurl.md](04-baseurl.md) 和 [10-config-changes.md](10-config-changes.md)。dev 模式 vite-plugin-qiankun + shim 补丁见 [03-dev-mode.md](03-dev-mode.md)。

## 3.6 子应用侧完整指南

### 3.6.1 文件骨架

子应用目录(以 `notes` 为例):

```
packages/microapps/notes/
├── vite.config.ts                    # 必填:Vite 配置(qiankun plugin + CORS + UMD)
├── tsconfig.json                     # 必填:继承根 tsconfig,加路径别名
├── index.html                        # 必填:<div id="root"> + 引用 /src/main.ts
├── package.json                      # 必填:dev / build 脚本
├── src/
│   ├── main.ts                       # 必填:导出 bootstrap/mount/unmount + standalone 守卫
│   ├── App.tsx                       # 根组件
│   ├── AppContext.ts                 # useAppContext() 拿 props(token/baseApi/...)
│   ├── __qiankun__/
│   │   ├── adapter.ts                # 必填:createAppContext(props) — 把 props 落到 localStorage
│   │   ├── auth.ts                   # setActiveProps / clearActiveProps / emitAuthExpired
│   │   └── __tests__/                # adapter / auth 单测
│   ├── api/                          # 业务 API
│   │   ├── client.ts                 # createApiClient({ baseApi, token }) — URL 拼接 + auth header
│   │   ├── notebooks.ts              # 业务 endpoint(注意:不要带 /api 前缀)
│   │   ├── notes.ts
│   │   └── __tests__/                # client.test.ts 锁住 joinUrl 约定
│   ├── hooks/                        # React hooks
│   ├── pages/ 或 components/         # UI
│   ├── styles/global.css             # 全局样式
│   └── __tests__/                    # DOM 测试(jsdom env)
```

### 3.6.2 `vite.config.ts` 必填项

```ts
// packages/microapps/<name>/vite.config.ts
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';
import path from 'node:path';

// ⚠️ 必填:qiankunHeadModuleShim 补丁 + indirect eval 拿真 global window
// 完整实现见 [03-dev-mode.md](03-dev-mode.md),这里只列必要的 plugin 链顺序
const qiankunHeadModuleShim: Plugin = {
  /* ... 见 [03-dev-mode.md](03-dev-mode.md) ... */
};

export default defineConfig({
  plugins: [
    react(),
    qiankun('<name>', { useDevMode: true }), // ← dev 模式必需
    qiankunHeadModuleShim, // ← dev 模式必需,加在 qiankun 之后
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, '../../desktop/src/renderer'),
      '@common': path.resolve(__dirname, '../../desktop/src/common'),
      '@': path.resolve(__dirname, '../../desktop/src'),
      '@aionui/microapp-shared': path.resolve(__dirname, '../shared/src'), // ← 三个子应用都有
    },
  },
  server: {
    port: 7992, // 和 MICRO_APP_DEFAULTS.getDevEntryPort 一致
    strictPort: true, // ← 必需,端口被占时直接失败,不要静默顺延
    cors: true, // ← 必需,否则主应用跨源拉 entry 失败
    headers: {
      'Access-Control-Allow-Origin': '*', // ← 必需,同上
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: '<name>', // ← 必须等于 MICRO_APP_DEFAULTS.<name>.name
      formats: ['umd'],
      fileName: () => '<name>.js',
    },
    rollupOptions: {
      external: [
        // 共享依赖不要打进 bundle
        'react',
        'react-dom',
        'react-router-dom',
        '@arco-design/web-react',
        // 按需加其它共享依赖
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
          '@arco-design/web-react': 'ArcoDesign',
        },
      },
    },
  },
});
```

**易错点**:

- 路径别名必须和主应用一致(都用 `@renderer` / `@common`),因为子应用常 import 共享的 `notebookMapper.ts` 等
- `lib.name` 改名 = 整个微应用改名,见 [10.7](10-config-changes.md#107-修改子应用-name高风险)
- dev 端口改了要在 `MICRO_APP_DEFAULTS.getDevEntryPort` 同步,见 [10.2](10-config-changes.md#102-修改-dev-端口)
- `cors: true` + `Access-Control-Allow-Origin: *` 二选一都不够,**两个都加**

### 3.6.3 `main.ts` 必填模式

```ts
// packages/microapps/<name>/src/main.ts
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MicroAppProps } from '@renderer/micro-app/types';
import { App } from './App';
import { createAppContext } from './__qiankun__/adapter';
import { setActiveProps, clearActiveProps } from './__qiankun__/auth';
import './styles/global.css';

interface RenderProps extends MicroAppProps {
  container?: string; // qiankun 模式下是 '#<name>-container',standalone 时不要传
}

let rootInstance: Root | null = null;

function render(props: RenderProps) {
  // 容器选择:qiankun 模式用 container prop(避免和主应用 DOM 冲突),standalone 用 #root
  const container = props.container ? document.querySelector(props.container) : document.getElementById('root');
  if (!container) throw new Error(`Container not found: ${props.container ?? '#root'}`);

  // ⚠️ 必填:重复 mount 要先 unmount,否则 React 18 会双实例警告
  if (rootInstance) rootInstance.unmount();

  // 把 props 落到 localStorage,业务代码可以从 useAppContext 读(见 adapter.ts)
  const context = createAppContext(props);
  setActiveProps(context);

  rootInstance = createRoot(container as HTMLElement);
  rootInstance.render(React.createElement(App, { context, routerBase: '/' }));
}

export async function bootstrap() {
  // 一次性初始化(preload、注册全局事件等);主应用首次 mount 之前调一次
}

export async function mount(props: RenderProps) {
  render(props);
}

export async function unmount(props: RenderProps) {
  if (rootInstance) {
    rootInstance.unmount();
    rootInstance = null;
  }
  clearActiveProps();
  // ⚠️ 必填:清空容器,否则下次 mount 会渲染到上次的 DOM 上
  const container = props.container ? document.querySelector(props.container) : document.getElementById('root');
  if (container) container.innerHTML = '';
  // ⚠️ 推荐:清掉本次 mount 写入的 localStorage 键(避免下次 mount 读到过期值)
  const prefix = `${props.systemCode}_`;
  Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => localStorage.removeItem(k));
}

// Standalone run(独立运行时走这里,qiankun 模式下 vite-plugin-qiankun 跳过此分支)
const w = window as any;
if (w.__POWERED_BY_QIANKUN__) {
  // dev 模式:把生命周期挂到 vite-plugin-qiankun 注入的全局对象
  // UMD 构建路径不走这里(UMD 直接 window.<name>.mount(props))
  w.moudleQiankunAppLifeCycles = w.moudleQiankunAppLifeCycles || {};
  w.moudleQiankunAppLifeCycles['<name>'] = { bootstrap, mount, unmount };
} else {
  try {
    // ⚠️ 必填:standalone mock props,字段必须和 MicroAppProps 对齐
    const mockProps: RenderProps = {
      token: localStorage.getItem('aionui_token') ?? '',
      userInfo: { id: '', username: 'dev', permissions: [], tenantId: 'dev' },
      systemCode: 'aionui',
      baseApi: '/api', // standalone 模式没有主应用注入,走相对路径(配合 vite proxy 或后端)
      shellVersion: '0.0.0',
      theme: (localStorage.getItem('aionui_theme') as 'light' | 'dark') ?? 'light',
      locale: localStorage.getItem('aionui_locale') ?? 'zh-CN',
      on: () => () => {}, // standalone 没有事件总线,给 noop
      emit: () => {},
      navigate: (path) => window.history.pushState({}, '', path),
      navigateExternal: (path) => {
        window.location.href = path;
      },
    };
    render(mockProps);
  } catch (err) {
    // standalone 失败(测试环境无 #root 等)静默跳过,主应用通过 mount() 调进来
    console.warn('[<name>] standalone bootstrap skipped:', err);
  }
}
```

### 3.6.4 `__qiankun__/adapter.ts` — 把 props 落 localStorage

主应用通过 props 注入 `token / userInfo / baseApi` 等。子应用业务代码通常用 React Context,但有些非 React 场景(axios 拦截器、CDN 上传配置)需要从非组件代码里读 — 这时用 localStorage 兜底,key 用 `${systemCode}_` 前缀避免冲突:

```ts
// packages/microapps/<name>/src/__qiankun__/adapter.ts
import type { MicroAppProps } from '@renderer/micro-app/types';

export function createAppContext(props: MicroAppProps): MicroAppProps {
  // token 写入:axios 拦截器 / 第三方 SDK 兜底读取
  if (props.token) {
    localStorage.setItem(`${props.systemCode}_token`, props.token);
  }
  // userInfo 写入:路由守卫 / 权限判断兜底
  if (props.userInfo.username) {
    localStorage.setItem(`${props.systemCode}_userInfo`, JSON.stringify(props.userInfo));
  }
  // baseApi 写入:非 React 代码(fetch wrapper)兜底
  // ⚠️ 注意:baseApi 每次 mount 都要刷,即使之前有值(token 不变时也不复用旧的)
  localStorage.setItem(`${props.systemCode}_baseApi`, props.baseApi);

  return props;
}
```

### 3.6.5 `__qiankun__/auth.ts` — 401 事件上报

主应用统一处理 token 过期(主应用收到 401 后清会话、跳登录),子应用不要自己跳。子应用只负责**发现** token 过期后通知主应用:

```ts
// packages/microapps/<name>/src/__qiankun__/auth.ts
import type { MicroAppProps } from '@renderer/micro-app/types';

let currentProps: MicroAppProps | null = null;

export function setActiveProps(props: MicroAppProps) {
  currentProps = props;
}

export function clearActiveProps() {
  currentProps = null;
}

/** 业务代码发现 token 过期时调用,主应用 emit 监听 'auth:expired' */
export function emitAuthExpired(reason: string = 'token_invalid') {
  currentProps?.emit('auth:expired', { reason });
}
```

业务侧在 fetch wrapper 捕获 401 时调 `emitAuthExpired('token_invalid')`,主应用收到后统一处理。

### 3.6.6 API client 约定

`packages/microapps/<name>/src/api/client.ts` 是子应用唯一的网络边界,职责:

1. 拼接 `baseApi + path`(自动处理尾斜杠、前导斜杠、绝对 URL 直传)
2. 自动加 `Authorization: Bearer <token>` header
3. JSON 序列化 / 解析
4. 错误归一化(抛 `ApiError`,带 status + body)

约定(**`client.test.ts` 必须锁住**):

| 字段          | 内容                                                         |
| ------------- | ------------------------------------------------------------ |
| `baseApi`     | 包含 `/api` 前缀(主应用注入的绝对 URL)                       |
| endpoint 路径 | **不**带 `/api` 前缀,例如 `/notebooks` 不是 `/api/notebooks` |

**反面例子**(endpoint 重复 `/api`):

```ts
// ❌ 错:baseApi='/api' 时,joinUrl 后变成 /api/api/notebooks
client.get('/api/notebooks');
// ✅ 对:joinUrl 后是 /api/notebooks
client.get('/notebooks');
```

VditorEditor / 图片上传等**不走 client.ts 直接 fetch** 的地方,也要用 `ctx.baseApi`(绝对地址)拼,不要硬编码 `localhost:端口`:

```ts
// packages/microapps/notes/src/components/VditorEditor.tsx
const baseApi = ctx.baseApi;  // ← 从 useAppContext 拿,不要 import.meta.env
// 传给 Vditor:
upload: { url: `${baseApi}/fs/upload`, ... }
// 拿图片 base64:
fetch(`${baseApi}/fs/image-base64`, { ... })
```

### 3.6.7 Standalone 调试

子应用可以脱离主应用单独跑(`cd packages/microapps/<name> && bun --bun run dev`):

- `__POWERED_BY_QIANKUN__` 为 false,走 standalone 分支,`main.ts` 用 mock props 直接 render
- mock props 的 `baseApi='/api'`(相对路径),standalone dev server 没有后端,**API 请求会失败**(404) — 调 UI 可以,调接口不行
- 想联调后端:把 `mockProps.baseApi` 改成 `http://127.0.0.1:13400/api` 之类的绝对地址
- standalone 模式不经过 qiankun 沙箱,HMR / React Refresh **正常工作**(子应用 dev 端口是独立的 Vite 实例)

### 3.6.8 测试

- **业务逻辑 / API client**:`*.test.ts`,node 环境,跟主应用一致(`tests/unit/` 路径,或子应用内 `src/api/__tests__/`)
- **React 组件 / hook / 整个 App**:`*.dom.test.tsx`,jsdom 环境,放 `src/__tests__/`
- **`main.ts` 集成测试**:jsdom,跑 `mount(mockProps)` 后断言 DOM:
  ```ts
  // packages/microapps/<name>/src/__tests__/main.dom.test.tsx
  it('mount writes token + baseApi to localStorage via adapter', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const { mount } = await import('../main');
    await mount({
      container: undefined, // 走 #root
      token: 'test-token',
      userInfo: { id: 'u1', username: 'tester', permissions: [], tenantId: 't1' },
      systemCode: 'notes-test',
      baseApi: 'http://localhost:0/api', // 故意不可达,只验证落库
      // ...
    });
    expect(localStorage.getItem('notes-test_token')).toBe('test-token');
    expect(localStorage.getItem('notes-test_baseApi')).toBe('http://localhost:0/api');
  });
  ```
- **vitest config**:根 `vitest.config.ts` 已包含 `packages/microapps/**/*.test.ts` / `*.dom.test.tsx`,子应用不用自己配
- **不要 mock 整个 qiankun** — 子应用不直接 import qiankun,业务代码只调 `mount(props)`。如果测试里想模拟主应用调度,直接在 test 里 await `mount(mockProps)` 即可

### 3.6.9 子应用侧检查清单(开发期间自查)

新建 / 改动子应用时,以下每项都要确认:

- [ ] `vite.config.ts` 装了 `vite-plugin-qiankun` + `qiankunHeadModuleShim`,plugin 顺序 `react → qiankun → qiankunHeadModuleShim`
- [ ] `vite.config.ts` 有 `cors: true` + `Access-Control-Allow-Origin: '*'`
- [ ] `vite.config.ts` 的 `lib.name` 等于 `MICRO_APP_DEFAULTS.<name>.name`
- [ ] `vite.config.ts` 的 server.port 等于 `getDevEntryPort(name)`
- [ ] `vite.config.ts` 的 `build.lib` external 含 `react` / `react-dom` / `react-router-dom` / `@arco-design/web-react`
- [ ] `main.ts` 导出 `bootstrap / mount / unmount`,三个都正确清理 React root + 容器 DOM
- [ ] `main.ts` 的 `unmount` 清掉 `${systemCode}_` 前缀的 localStorage 键
- [ ] `main.ts` 的 `__POWERED_BY_QIANKUN__` 分支注册了 `window.moudleQiankunAppLifeCycles['<name>']`
- [ ] `main.ts` 的 `else` 分支(standalone)有 mockProps,**且捕获 try/catch**(测试环境无 #root 时静默跳过)
- [ ] `__qiankun__/adapter.ts` 把 `token / userInfo / baseApi` 都写到 localStorage(用 `${systemCode}_` 前缀)
- [ ] `__qiankun__/auth.ts` 提供 `emitAuthExpired()`,业务侧 401 走它,**不要**自己跳登录页
- [ ] 所有 API endpoint **不**带 `/api` 前缀(由 `client.ts:joinUrl` 拼)
- [ ] 直接 fetch 的地方(Vditor 上传 / 图片 base64)用 `ctx.baseApi`,**不要**硬编码 `localhost:<port>`
- [ ] `App.tsx` 用 `useAppContext()` 拿 `baseApi / token / systemCode / userInfo`,不要 import.meta.env
- [ ] 业务代码不 import `qiankun` / 主应用 `ipcBridge` / 主应用组件
