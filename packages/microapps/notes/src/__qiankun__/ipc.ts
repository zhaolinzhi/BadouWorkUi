/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * notes micro-app → 主进程 IPC bridge 访问层
 *
 * 走 `(0, eval)('window')` 绕过 qiankun 沙箱 Proxy,拿到 host 注入的
 * `window.ipcBridge.notebooks` / `window.ipcBridge.notes`,与 meeting-recording
 * 同样的间接 eval 模式(参见 `packages/microapps/shared/src/qiankun/ipc.ts` 顶部
 * 长注释)。
 *
 * 数据通道
 * ========
 * 直接复用主进程已有的 HTTP `ipcBridge.notebooks` / `ipcBridge.notes` ——
 * `httpRequest` 内部用 `getBaseUrl()` 解析,Electron 模式下走
 * `http://127.0.0.1:<__backendPort>/api/...` 直连后端;WebUI 浏览器模式(无
 * `__backendPort`)下走 `''` 相对路径,行为与 monolithic 时代一致。
 *
 * 关键设计:不再让微应用自己 fetch + `baseApi`。原因见 plan:
 * Electron 模式下 `MicroAppBootstrap` 不跑 `startMicroApps` → `props.baseApi`
 * 是 undefined → 微应用 fetch 打到 Vite dev server → **404**。改用本桥接后,
 * 数据走主进程 HTTP client,绕开 `baseApi` 依赖。
 *
 * 类型对齐
 * ========
 * 14 个方法(`notebooks` 7 + `notes` 7)的参数 / 返回 shape 与主进程
 * `ipcBridge.notebooks` / `ipcBridge.notes` 100% 对齐;`fromApi*` mapping
 * 在主进程侧已完成,微应用侧拿到的已经是 `Notebook` / `NoteItem` 业务类型。
 */
import { createIpcResolver } from '@aionui/microapp-shared';
import type { Notebook, NoteItem } from '../api/types';

type InvokeFn<TParams, TResult> = (params: TParams) => Promise<TResult>;

/** Align with `ipcBridge.notebooks` in `packages/desktop/src/common/adapter/ipcBridge.ts`. */
export interface NotebooksBridge {
  list: { invoke: InvokeFn<void, Notebook[]> };
  get: { invoke: InvokeFn<{ id: string }, { notebook: Notebook; notes: NoteItem[] }> };
  create: { invoke: InvokeFn<{ name: string; description?: string }, Notebook> };
  update: { invoke: InvokeFn<{ id: string; name?: string; description?: string | null }, Notebook> };
  delete: { invoke: InvokeFn<{ id: string }, void> };
  listNotes: { invoke: InvokeFn<{ id: string }, NoteItem[]> };
  createNote: {
    invoke: InvokeFn<
      { notebook_id: string; title: string; content?: string; tags?: string[]; summary?: string },
      NoteItem
    >;
  };
}

/** Align with `ipcBridge.notes` in `packages/desktop/src/common/adapter/ipcBridge.ts`. */
export interface NotesBridge {
  list: { invoke: InvokeFn<ListNotesBridgeParams, NoteItem[]> };
  get: { invoke: InvokeFn<{ id: string }, NoteItem> };
  /** Full Markdown body. Returns '' on orphan rows. */
  raw: { invoke: InvokeFn<{ id: string }, string> };
  create: { invoke: InvokeFn<CreateNoteBridgeParams, NoteItem> };
  /** `params` is `UpdateNoteParams & { id: string }` — id is required by the IPC path. */
  update: { invoke: InvokeFn<UpdateNoteBridgeParams, NoteItem> };
  delete: { invoke: InvokeFn<{ id: string }, void> };
  star: { invoke: InvokeFn<{ id: string }, boolean> };
}

// ---------------------------------------------------------------------------
// Bridge param types — flat shape that matches the IPC channel signatures
// ---------------------------------------------------------------------------

export interface ListNotesBridgeParams {
  notebook_id?: string;
  tag?: string;
  starred?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface CreateNoteBridgeParams {
  title: string;
  notebook_id?: string | null;
  content?: string;
  tags?: string[];
  summary?: string;
}

export interface UpdateNoteBridgeParams {
  id: string;
  title?: string;
  content?: string;
  notebook_id?: string | null;
  summary?: string | null;
  tags?: string[];
  star?: boolean;
}

// ---------------------------------------------------------------------------
// Resolver factories — bridge-shape guards match what meeting-recording uses
// (a method that *looks* like an invoke ensures we're not matching a stale
// partial object).
// ---------------------------------------------------------------------------

const looksLikeNotebooksBridge = (b: unknown): b is NotebooksBridge => {
  if (typeof b !== 'object' || b === null) return false;
  const candidate = b as { list?: { invoke?: unknown } };
  return typeof candidate.list?.invoke === 'function';
};

const looksLikeNotesBridge = (b: unknown): b is NotesBridge => {
  if (typeof b !== 'object' || b === null) return false;
  const candidate = b as { list?: { invoke?: unknown } };
  return typeof candidate.list?.invoke === 'function';
};

const resolveNotebooks = createIpcResolver<NotebooksBridge>(
  'notebooks',
  looksLikeNotebooksBridge,
  '[notes microapp] ipcBridge.notebooks is unavailable. ' +
    'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
);

const resolveNotes = createIpcResolver<NotesBridge>(
  'notes',
  looksLikeNotesBridge,
  '[notes microapp] ipcBridge.notes is unavailable. ' +
    'This microapp must run inside the AionUi Electron shell (or be mocked in tests).'
);

/**
 * Convenience accessor mirroring the static-import shape. Property access
 * (`ipcBridge.notebooks.list.invoke(...)`) is preserved through the getter
 * so callers don't need to know about the resolver function.
 */
export const ipcBridge = {
  get notebooks(): NotebooksBridge {
    return resolveNotebooks();
  },
  get notes(): NotesBridge {
    return resolveNotes();
  },
};

// Re-export types so callers can `import type { Notebook } from '.../ipc'`
// instead of reaching into ../api/types directly.
export type { Notebook, NoteItem };
