import type { MicroAppProps } from '../types';
import { getMicroAppConfig, MICRO_APP_DEFAULTS } from '../config/micro-apps';
import { getBaseUrl } from '@/common/adapter/httpBridge';
import { getEventBus, type MicroAppEventBus } from './event-bus';

/**
 * Build the absolute API base URL for sub-apps.
 *
 * Sub-apps do their own `fetch()` instead of using the main app's `httpRequest`,
 * so they need a fully-qualified URL. The main app's `getBaseUrl()` already
 * resolves the right base across runtimes:
 *
 * - Electron (renderer at `aionui://...` or `http://localhost:5173` in dev):
 *   `http://127.0.0.1:<__backendPort>` — aioncore's listening port, injected
 *   by the preload bridge.
 * - WebUI browser (renderer at webui host): `''` — same-origin; webui host
 *   has a reverse proxy to aioncore.
 * - Tests (no `__backendPort`): `''` — same-origin; tests stub fetch globally.
 *
 * Without this, a sub-app's `fetch('/api/notebooks')` would resolve to the
 * renderer's own origin (the Vite dev server in dev, or the webui host in
 * prod) and 404 because neither proxies `/api/*` to aioncore automatically.
 *
 * `MicroAppHost` 也用这个函数兜底 —— Electron 下微应用是由 `MicroAppHost`
 * 挂载的(不是 `startMicroApps`),那里曾经硬编码相对路径 `/api`,于是
 * 子应用自己发的请求全部打到 renderer 自己的源(dev 下是 Vite dev server)。
 */
export function resolveBaseApi(): string {
  const base = getBaseUrl();
  return `${base}/api`;
}

export function isMicroAppEnabled(): boolean {
  // 只认 import.meta.env —— 那是构建期烘进 bundle 的常量,dev 与打包态是同一套语义。
  //
  // 之前这里还有一条 process.env 分支,但它在两种形态下都取不到值:
  // - 打包态:Vite 把 `process.env` 静态替换成 `{}`,第一个操作数恒为 undefined
  // - dev 态:Vite 不替换 `process.env`,读的是渲染进程运行时的 process.env,而那里
  //   只有 electron.vite.config.ts 的 define 列出的那几个键(NODE_ENV / env /
  //   AIONUI_MULTI_INSTANCE / SENTRY_DSN),不含 VITE_*。
  // 留着它只会让人误以为在 shell 里 export 一个同名变量就能开/关微应用。
  const raw = import.meta.env.VITE_MICRO_APP_ENABLED ?? '';
  return raw.toString().toLowerCase() === 'true';
}

interface BuildPropsInput {
  navigate: (path: string) => void;
  navigateExternal: (path: string) => void;
  on: MicroAppEventBus['on'];
  emit: MicroAppEventBus['emit'];
}

export function buildMicroAppProps(input: BuildPropsInput): MicroAppProps {
  // shell version：优先从 import.meta.env 取（dev/prod），fallback 到全局注入
  const shellVersion =
    (import.meta.env.VITE_SHELL_VERSION as string | undefined) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as any).__AIONUI_SHELL_VERSION__ as string | undefined) ??
    '0.0.0';

  return {
    // 用户态：实际值由调用方在 startMicroApps 时覆盖（这里先给空值/默认值）
    token: '',
    userInfo: { id: '', username: '', permissions: [], tenantId: '' },
    // 配置
    systemCode: 'aionui',
    baseApi: resolveBaseApi(),
    shellVersion,
    theme: 'light',
    locale: 'zh-CN',
    // WebUI 模式的 registerMicroApps 路径不经过 MicroAppHost,拿不到 LayoutContext,
    // 视口判定只能兜底为桌面宽度。真正按视口布局的子应用走 MicroAppHost 路径。
    isMobile: false,
    // 通信与导航由调用方注入
    on: input.on,
    emit: input.emit,
    navigate: input.navigate,
    navigateExternal: input.navigateExternal,
  };
}

export async function startMicroApps(input: BuildPropsInput): Promise<void> {
  if (!isMicroAppEnabled()) {
    return;
  }

  // Dynamic-import qiankun (and its transitive deps single-spa, import-html-entry)
  // so they are only loaded when micro apps are actually enabled. Importing
  // qiankun statically pulls single-spa into the bundle, and single-spa will
  // emit "minified message #1" 5s after load if start() is never called —
  // flooding the console in the default-disabled case.
  const { registerMicroApps, start } = await import('qiankun');

  const bus = getEventBus();
  const props = buildMicroAppProps({
    on: bus.on,
    emit: bus.emit,
    navigate: input.navigate,
    navigateExternal: input.navigateExternal,
  });

  const apps = Object.keys(MICRO_APP_DEFAULTS).map((name) => {
    const config = getMicroAppConfig(name);
    return {
      name: config.name,
      entry: config.entry,
      container: config.container,
      activeRule: config.activeRule,
      props: { ...props },
    };
  });

  // 默认 lifecycle：qiankun 加载时调用；这里用 noop。
  // qiankun 运行时支持传入函数或 FrameworkLifeCycles 对象，这里传空函数 noop。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerMicroApps(apps, (() => {}) as any);

  start({
    sandbox: {
      experimentalStyleIsolation: true,
    },
  });
}
