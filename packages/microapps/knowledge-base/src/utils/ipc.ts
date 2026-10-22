/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * knowledge-base micro-app → 主进程 IPC bridge 访问层
 *
 * 背景
 * ====
 * qiankun 2.x 用 Proxy 包装子应用域的 `window`,host 安装的全局(`window.ipcBridge`)
 * 在沙箱里读不到。shell 在 `MicroAppHost` 调 `loadMicroApp` 之前把 `ipcBridge`
 * 挂到真实 window 上,见
 * `packages/desktop/src/renderer/micro-app/services/expose-ipc-bridge.ts`。
 *
 * 解法与 notes / meeting-recording 完全一致:间接 eval `(0, eval)('window')` 拿
 * 到真正的 global window。工厂 `createIpcResolver` 来自
 * `@aionui/microapp-shared`(见该文件顶部长注释),共享包内的 Map 缓存保证
 * 重复调用不会重复 eval。
 *
 * 类型对齐
 * ========
 * 这里只声明 knowledge-base 真正调用的方法,参数 / 返回 shape 与主进程
 * `packages/desktop/src/common/adapter/ipcBridge.ts` 中同名 provider 100% 对齐:
 *
 * - `dialog.showOpen`           → `bridge.buildProvider<string[]|undefined, ShowOpenOptions>('show-open')`
 * - `fs.getImageBase64`         → `httpPost<string|null, { path; workspace? }>('/api/fs/image-base64')`
 * - `shell.openExternal`        → `httpPost<void, string>('/api/shell/open-external')`
 * - `acpConversation.getManagedAgents` → `httpGet<ManagedAgent[], void>('/api/agents/management')`
 *
 * 注意:agent 目录的真实 window key 是 `acpConversation`(不是 `agents`),这里
 * 保留同名以便从 shell 复制过来的 `agentTypes` / `agentLogo` 调用形状不变。
 */

import { createIpcResolver } from '@aionui/microapp-shared';

type InvokeFn<TParams, TResult> = (params: TParams) => Promise<TResult>;

/**
 * `dialog.showOpen` 的入参。这里不用 Electron 的 `OpenDialogOptions`(微应用不
 * 依赖 electron 类型),改为等价的结构化窄类型;shell 侧的 provider 是
 * `as typeof nativeShowOpen.invoke` 强转过的,运行时不做校验。
 */
export type ShowOpenOptions = {
  defaultPath?: string;
  properties?: string[];
  filters?: Array<{ name: string; extensions: string[] }>;
};

/** Align with `ipcBridge.dialog` in `packages/desktop/src/common/adapter/ipcBridge.ts`. */
export interface DialogBridge {
  showOpen: { invoke: (options?: ShowOpenOptions) => Promise<string[] | undefined> };
}

/** Align with `ipcBridge.fs` in `packages/desktop/src/common/adapter/ipcBridge.ts`. */
export interface FsBridge {
  getImageBase64: { invoke: InvokeFn<{ path: string; workspace?: string }, string | null> };
}

/** Align with `ipcBridge.shell` in `packages/desktop/src/common/adapter/ipcBridge.ts`. */
export interface ShellBridge {
  openExternal: { invoke: InvokeFn<string, void> };
}

/**
 * Align with `ipcBridge.acpConversation` in
 * `packages/desktop/src/common/adapter/ipcBridge.ts`.
 *
 * 返回类型刻意保持 `unknown[]`:shell 侧声明的是
 * `ManagedAgent[]`(定义在 `@/renderer/utils/model/agentTypes`,属于 shell 模块),
 * 微应用不能 import 它。`agentTypes.fetchManagedAgents` / `agentLogo.fetchAgentLogos`
 * 本来就自己做 `as ManagedAgent[]` 强转,这里保持一致的宽松形状。
 */
export interface AcpConversationBridge {
  /** 无参数 GET `/api/agents/management`。 */
  getManagedAgents: { invoke: (params?: void) => Promise<unknown[]> };
}

// ---------------------------------------------------------------------------
// Bridge-shape guards —— 一个「看起来像 invoke 的方法」就足以确认没有命中
// 过期 / 半初始化的对象(间接 eval 分支在无 ipcBridge 时返回 undefined)。
// ---------------------------------------------------------------------------

const looksLikeDialogBridge = (b: unknown): b is DialogBridge => {
  if (typeof b !== 'object' || b === null) return false;
  return typeof (b as { showOpen?: { invoke?: unknown } }).showOpen?.invoke === 'function';
};

const looksLikeFsBridge = (b: unknown): b is FsBridge => {
  if (typeof b !== 'object' || b === null) return false;
  return typeof (b as { getImageBase64?: { invoke?: unknown } }).getImageBase64?.invoke === 'function';
};

const looksLikeShellBridge = (b: unknown): b is ShellBridge => {
  if (typeof b !== 'object' || b === null) return false;
  return typeof (b as { openExternal?: { invoke?: unknown } }).openExternal?.invoke === 'function';
};

const looksLikeAcpConversationBridge = (b: unknown): b is AcpConversationBridge => {
  if (typeof b !== 'object' || b === null) return false;
  return typeof (b as { getManagedAgents?: { invoke?: unknown } }).getManagedAgents?.invoke === 'function';
};

const resolveDialog = createIpcResolver<DialogBridge>(
  'dialog',
  looksLikeDialogBridge,
  '[knowledge-base microapp] ipcBridge.dialog is unavailable. ' +
    'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
);

const resolveFs = createIpcResolver<FsBridge>(
  'fs',
  looksLikeFsBridge,
  '[knowledge-base microapp] ipcBridge.fs is unavailable. ' +
    'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
);

const resolveShell = createIpcResolver<ShellBridge>(
  'shell',
  looksLikeShellBridge,
  '[knowledge-base microapp] ipcBridge.shell is unavailable. ' +
    'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
);

const resolveAcpConversation = createIpcResolver<AcpConversationBridge>(
  'acpConversation',
  looksLikeAcpConversationBridge,
  '[knowledge-base microapp] ipcBridge.acpConversation is unavailable. ' +
    'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
);

/**
 * 便捷访问器,保持 shell 的静态 import 形状。属性访问
 * (`ipcBridge.dialog.showOpen.invoke(...)`)通过 getter 保留,调用方无需知道
 * resolver 工厂的存在。
 */
export const ipcBridge = {
  get dialog(): DialogBridge {
    return resolveDialog();
  },
  get fs(): FsBridge {
    return resolveFs();
  },
  get shell(): ShellBridge {
    return resolveShell();
  },
  get acpConversation(): AcpConversationBridge {
    return resolveAcpConversation();
  },
};

// ---------------------------------------------------------------------------
// 后端 base url —— `platform.resolveBackendAssetUrl` 需要把后端相对路径
// (`/api/...` / `/assets/...`)展开成绝对地址。逻辑与 shell 侧
// `packages/desktop/src/common/adapter/httpBridge.ts` 的 `getBaseUrl()` 保持一致:
// Electron 走 `http://127.0.0.1:<__backendPort>`,WebUI 浏览器模式走同源空串。
// ---------------------------------------------------------------------------

/** Fallback port — 与 httpBridge 的 `getBackendPort()` 保持一致。 */
const FALLBACK_BACKEND_PORT = 13400;

/**
 * 取到「真正的」global window(绕过 qiankun Proxy)。
 * 间接 eval 是唯一在 global scope 执行的 eval 形式,qiankun 拦不住。
 */
function getRealWindow(): (Window & typeof globalThis) | undefined {
  try {
    // eslint-disable-next-line no-eval
    return (0, eval)('window') as Window & typeof globalThis;
  } catch {
    return undefined;
  }
}

/**
 * 优先返回真实 global window;间接 eval 被 CSP `unsafe-eval` 锁死时退回沙箱
 * window(此时 shell 本来就没注入 ipcBridge,后续调用会照常报错)。
 */
export function getShellWindow(): (Window & typeof globalThis) | undefined {
  return getRealWindow() ?? (typeof window !== 'undefined' ? window : undefined);
}

function getBackendPortFromWindow(): number | undefined {
  return (getShellWindow() as { __backendPort?: number } | undefined)?.__backendPort;
}

function getBackendPort(): number {
  const port = getBackendPortFromWindow();
  if (port) return port;
  return (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort ?? FALLBACK_BACKEND_PORT;
}

/**
 * WebUI(浏览器)模式判定:没有 Electron preload,`window.__backendPort` 不存在,
 * 请求必须走同源(静态服务器负责把 `/api/*` 反代到后端)。
 */
function isWebUiBrowserMode(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined' && !getBackendPortFromWindow();
}

/** 后端 HTTP 根地址。与 shell `httpBridge.getBaseUrl()` 语义一致。 */
export function getBaseUrl(): string {
  if (isWebUiBrowserMode()) {
    return '';
  }
  return `http://127.0.0.1:${getBackendPort()}`;
}
