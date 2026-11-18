/**
 * 业务实体类型 — notes / notebooks 领域对象
 *
 * `fromApi*` mapper 与 `Api*` 原始响应类型在主进程侧 `ipcBridge` 已经处理,
 * 微应用侧拿到的是已转换的业务对象,所以这里只需要业务 shape。
 *
 * History: 之前这文件 re-export `@common/adapter/notebookMapper` 的 fromApi/Api*
 * helper,迁移到 __qiankun__/ipc 之后微应用不再直接处理 raw response,删去。
 */
export interface Notebook {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  title: string;
  notebookId?: string | null;
  filePath: string;
  summary?: string;
  tags: string[];
  star: boolean;
  content?: string;
  createdAt: string;
  updatedAt: string;
}
