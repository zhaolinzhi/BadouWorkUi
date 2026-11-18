/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * qiankun 沙箱下的 IPC bridge 解析工厂
 *
 * 背景
 * ====
 * qiankun 2.x 用 import-html-entry 加载子应用,会用 Proxy 包装子应用域的
 * `window` 对象。shell 挂在真实 window 上的 `window.ipcBridge` 因此在子应用侧
 * `window.ipcBridge` 是 undefined(Proxy 不识别 host-installed globals)。
 * 直接 `window.ipcBridge.notebooks.list.invoke()` 在沙箱里解析不到,所有数据
 * 请求会 404。
 *
 * `window.ipcBridge` 由 shell 主动挂载,见
 * `packages/desktop/src/renderer/micro-app/services/expose-ipc-bridge.ts`
 * (在 `MicroAppHost` 调 `loadMicroApp` 之前执行)。
 *
 * 解法
 * ====
 * 间接 eval `'(0, eval)("window")'` 是唯一能在 global scope 而非 caller
 * scope 执行的 eval 形式,qiankun 沙箱 Proxy 拦不住。拿到真正的 global
 * `window` 后就能读到 host 注入的 `ipcBridge`。
 *
 * 同样的间接 eval 模式也被 meeting-recording 的 vite.config.ts 用于
 * 暴露 `$RefreshReg$` 给 React Refresh runtime,参见该文件长注释。
 *
 * 静态 `require('@/common')` fallback 保留下来,以便 vitest 注入
 * `vi.mock('@/common', ...)` 时仍能解析 — jsdom 域没有真 ipcBridge,
 * 间接 eval 分支拿到 undefined,会落到 `require` 分支,`require` 由
 * vitest 在 mock registry 里替换。
 *
 * 工厂形态
 * =======
 * 每个子应用通过 `createIpcResolver<TBridge>(windowKey, validate, errorMessage)`
 * 注册自己的 bridge,共享包内的 `Map<string, unknown>` 缓存保证重复调用
 * 不会重复做间接 eval / require,跨 feature 也只有一个缓存实例。
 */
type ValidateFn<T> = (b: unknown) => b is T;

const cache = new Map<string, unknown>();

/**
 * Resolve the real global window, bypassing qiankun's proxy.
 * Indirect eval is the only form of eval that runs in the global scope and
 * thus is the only form qiankun can't intercept.
 */
function getRealWindow(): Window & typeof globalThis {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (0, eval)('window') as any;
}

/**
 * Build a memoised resolver for one feature bridge.
 *
 * @param windowKey  Property name on `window.ipcBridge` (e.g. `'notebooks'`).
 * @param validate   Type guard validating the resolved object looks like the
 *                   expected bridge (prevents resolving a stale or partial
 *                   object — the indirect-eval path returns `undefined` when
 *                   no `ipcBridge` is installed).
 * @param errorMessage  Thrown message when no path returns a valid bridge.
 *                     Should include the micro-app name + window key so
 *                     errors in the wild are debuggable.
 */
export function createIpcResolver<TBridge extends object>(
  windowKey: string,
  validate: ValidateFn<TBridge>,
  errorMessage: string
): () => TBridge {
  return () => {
    if (cache.has(windowKey)) {
      return cache.get(windowKey) as TBridge;
    }

    // Path 1: indirect-eval → real window.ipcBridge[windowKey]
    try {
      const realWindow = getRealWindow();
      const bridge = (realWindow as { ipcBridge?: Record<string, unknown> } | undefined)?.ipcBridge?.[windowKey];
      if (bridge && validate(bridge)) {
        cache.set(windowKey, bridge);
        return bridge as TBridge;
      }
    } catch {
      // Indirect eval can fail in environments that lock down CSP `unsafe-eval`
      // (some hardened WebUI deployments). Fall through to the static require.
    }

    // Path 2: static require — 仅供 vitest `vi.mock('@/common', ...)` 使用。
    // 用 `require`(同步)而不是 dynamic `import`(异步),调用方才能免 `await`
    // 访问 bridge。生产路径不依赖这条:shell 已经把 ipcBridge 挂到 window 上,
    // Path 1 就会命中。
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const commonModule = require('@/common') as { ipcBridge?: Record<string, unknown> } | undefined;
      const bridge = commonModule?.ipcBridge?.[windowKey];
      if (bridge && validate(bridge)) {
        cache.set(windowKey, bridge);
        return bridge as TBridge;
      }
    } catch {
      // require('@/common') failed (alias not resolvable, or mock not in
      // registry). Fall through to the throw.
    }

    throw new Error(errorMessage);
  };
}

/**
 * Test-only helper: clear the resolver cache between tests so a stale
 * bridge from a previous `vi.mock('@/common', ...)` doesn't leak across
 * `it` blocks. Not part of the public API.
 */
export function __clearIpcResolverCacheForTests(): void {
  cache.clear();
}
