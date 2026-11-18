/**
 * Notebooks API — ipcBridge 薄包装
 *
 * 通过 `__qiankun__/ipc.ts` 拿到主进程 `ipcBridge.notebooks`,绕过 qiankun
 * 沙箱 + 消除 `baseApi` 依赖(Electron 模式下的 404 链路)。参数 shape 与
 * bridge 类型严格对齐(参见 `ipc.ts` 的 `NotebooksBridge`),从 `fromApi*`
 * 业务对象反序列化已由主进程 `withResponseMap(fromApiNotebook, ...)` 完成。
 *
 * `_opts` 保留以保持工厂签名兼容(consumer 是 `useNotebookList`,不改它的
 * useMemo 依赖);内部不再读 `baseApi` / `token`。
 */
import { ipcBridge } from '../__qiankun__/ipc';
import type { Notebook, NoteItem } from './types';

export interface NotebookApi {
  list(): Promise<Notebook[]>;
  get(id: string): Promise<{ notebook: Notebook; notes: NoteItem[] }>;
  create(name: string, description?: string): Promise<Notebook>;
  update(id: string, params: { name?: string; description?: string | null }): Promise<Notebook>;
  delete(id: string): Promise<void>;
  listNotes(id: string): Promise<NoteItem[]>;
  createNote(params: {
    notebook_id: string;
    title: string;
    content?: string;
    tags?: string[];
    summary?: string;
  }): Promise<NoteItem>;
}

export function createNotebookApi(_opts: { baseApi: string; token: string }): NotebookApi {
  const bridge = ipcBridge.notebooks;
  return {
    list: () => bridge.list.invoke(),
    get: (id) => bridge.get.invoke({ id }),
    create: (name, description) => bridge.create.invoke({ name, description }),
    update: (id, params) => bridge.update.invoke({ id, name: params.name, description: params.description }),
    delete: (id) => bridge.delete.invoke({ id }),
    listNotes: (id) => bridge.listNotes.invoke({ id }),
    createNote: (params) => bridge.createNote.invoke(params),
  };
}
