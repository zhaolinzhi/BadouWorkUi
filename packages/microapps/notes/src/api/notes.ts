/**
 * Notes API — ipcBridge 薄包装
 *
 * 行为契约与上一版(createApiClient + fromApi* 链)等价,数据通道换成
 * `__qiankun__/ipc.ts` 拿到的 `ipcBridge.notes` 间接 eval 桥接。
 *
 * 历史:之前本文件自己 fetch + `fromApiNoteList` 转换。`fromApi*` 已在
 * 主进程 `withResponseMap` 中处理,微应用侧不再做。
 */
import { ipcBridge } from '../__qiankun__/ipc';
import type { NoteItem } from './types';

export interface ListNotesParams {
  notebook_id?: string;
  tag?: string;
  starred?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface CreateNoteParams {
  title: string;
  notebook_id?: string | null;
  content?: string;
  tags?: string[];
  summary?: string;
}

export interface UpdateNoteParams {
  title?: string;
  content?: string;
  notebook_id?: string | null;
  summary?: string | null;
  tags?: string[];
  star?: boolean;
}

export interface NotesApi {
  list(params?: ListNotesParams): Promise<NoteItem[]>;
  get(id: string): Promise<NoteItem>;
  raw(id: string): Promise<string>;
  create(params: CreateNoteParams): Promise<NoteItem>;
  update(id: string, params: UpdateNoteParams): Promise<NoteItem>;
  delete(id: string): Promise<void>;
  star(id: string): Promise<boolean>;
}

export function createNotesApi(_opts: { baseApi: string; token: string }): NotesApi {
  const bridge = ipcBridge.notes;
  return {
    list: (params = {}) => bridge.list.invoke(params),
    get: (id) => bridge.get.invoke({ id }),
    raw: (id) => bridge.raw.invoke({ id }),
    create: (params) => bridge.create.invoke(params),
    // bridge 把 id 合并到 params 对象里,因为 IPC 路径的 path 模板要从 params 取 id
    update: (id, params) => bridge.update.invoke({ ...params, id }),
    delete: (id) => bridge.delete.invoke({ id }),
    star: (id) => bridge.star.invoke({ id }),
  };
}
