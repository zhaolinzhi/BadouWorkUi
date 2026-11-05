/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * standalone(直接 `vite dev` 打开 7992)时的内存假 bridge
 *
 * 背景
 * ====
 * notes 的数据通道是宿主注入的 `window.ipcBridge.notebooks` / `.notes`。
 * 独立运行时没有宿主(也没有 Electron 主进程),bridge 根本不存在 ——
 * `__qiankun__/ipc.ts` 的 resolver 会直接抛错。而 `useNotebookList` 在
 * **渲染期**就取 bridge(`api/notebooks.ts` 里的 `const bridge = ipcBridge.notebooks`),
 * 于是整页被 React error boundary 接管,报 "Unexpected Application Error!"。
 *
 * 做法
 * ====
 * 独立运行时由 `main.ts` 把这份假 bridge 装到 `window.ipcBridge` 上 ——
 * 相当于「自己当自己的宿主」。装完之后 resolver 的间接 eval 分支照样命中,
 * 页面正常渲染,增删改查都作用在内存数据上,调 UI 不需要起 Electron + 后端。
 *
 * 边界
 * ====
 * - 只在 dev 装(见 `main.ts` 里的 `import.meta.env.DEV` 判断):生产产物由宿主
 *   提供真 bridge,万一脱离宿主直接打开,宁可报错也不要拿假数据糊弄人。
 * - 宿主已经注入过 bridge 时不覆盖(见 `installStandaloneMockBridge`)。
 * - 数据只在内存里:刷新页面即回到种子数据,不会写进用户的真实笔记本。
 */
import type {
  CreateNoteBridgeParams,
  ListNotesBridgeParams,
  NotebooksBridge,
  NotesBridge,
  UpdateNoteBridgeParams,
} from './ipc';
import type { NoteItem, Notebook } from '../api/types';

/** 内存里的假数据。notebooks / notes 一一对应,靠 `notebookId` 关联。 */
interface MockData {
  notebooks: Notebook[];
  notes: NoteItem[];
}

/** 种子数据:两本笔记本 + 三条笔记,够把侧栏 / 编辑器 / 空状态都点一遍。 */
function createSeedData(): MockData {
  const createdAt = '2026-01-01T00:00:00.000Z';
  const updatedAt = '2026-01-01T00:00:00.000Z';

  const notebooks: Notebook[] = [
    {
      id: 'nb_mock_1',
      name: 'Inbox',
      description: 'Standalone dev mock notebook',
      createdAt,
      updatedAt,
    },
    {
      id: 'nb_mock_2',
      name: 'Work',
      description: '',
      createdAt,
      updatedAt,
    },
  ];

  const notes: NoteItem[] = [
    {
      id: 'nt_mock_1',
      title: 'Standalone dev',
      notebookId: 'nb_mock_1',
      filePath: 'notes/nt_mock_1.md',
      summary: 'How the mock bridge works',
      tags: ['mock'],
      star: false,
      content: '# Standalone dev\n\nThis note is served by the in-memory mock bridge.\n',
      createdAt,
      updatedAt,
    },
    {
      id: 'nt_mock_2',
      title: 'Try me',
      notebookId: 'nb_mock_1',
      filePath: 'notes/nt_mock_2.md',
      summary: '',
      tags: [],
      star: true,
      content: 'Rename me, star me, delete me — the mock keeps it all in memory.\n',
      createdAt,
      updatedAt,
    },
    {
      id: 'nt_mock_3',
      title: 'Meeting notes',
      notebookId: 'nb_mock_2',
      filePath: 'notes/nt_mock_3.md',
      summary: '',
      tags: ['mock', 'work'],
      star: false,
      content: '## Agenda\n\n- item 1\n- item 2\n',
      createdAt,
      updatedAt,
    },
  ];

  return { notebooks, notes };
}

const cloneNotebook = (notebook: Notebook): Notebook => ({ ...notebook });

const cloneNote = (note: NoteItem): NoteItem => ({ ...note, tags: [...note.tags] });

const now = (): string => new Date().toISOString();

/**
 * 造一份内存 bridge。方法签名与 `__qiankun__/ipc.ts` 声明的
 * `NotebooksBridge` / `NotesBridge` 严格对齐(宿主那侧由
 * `withResponseMap(fromApi*)` 完成的反序列化,这里直接产出业务对象)。
 */
export function createStandaloneMockBridge(): { notebooks: NotebooksBridge; notes: NotesBridge } {
  const data = createSeedData();
  let sequence = 100;
  const nextId = (prefix: string): string => `${prefix}_mock_${++sequence}`;

  const findNotebook = (id: string): Notebook | undefined => data.notebooks.find((nb) => nb.id === id);
  const findNote = (id: string): NoteItem | undefined => data.notes.find((note) => note.id === id);
  const notesOf = (notebookId: string): NoteItem[] => data.notes.filter((note) => note.notebookId === notebookId);

  const makeNote = (params: {
    notebook_id?: string | null;
    title: string;
    content?: string;
    tags?: string[];
    summary?: string;
  }): NoteItem => {
    const id = nextId('nt');
    const timestamp = now();
    return {
      id,
      title: params.title,
      notebookId: params.notebook_id ?? null,
      filePath: `notes/${id}.md`,
      summary: params.summary ?? '',
      tags: params.tags ? [...params.tags] : [],
      star: false,
      content: params.content ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };

  const notebooks: NotebooksBridge = {
    list: {
      invoke: async () => data.notebooks.map(cloneNotebook),
    },
    get: {
      invoke: async ({ id }) => {
        const notebook = findNotebook(id);
        if (!notebook) throw new Error(`[notes standalone mock] notebook "${id}" not found`);
        return { notebook: cloneNotebook(notebook), notes: notesOf(id).map(cloneNote) };
      },
    },
    create: {
      invoke: async ({ name, description }) => {
        const timestamp = now();
        const notebook: Notebook = {
          id: nextId('nb'),
          name,
          description: description ?? '',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        data.notebooks.push(notebook);
        return cloneNotebook(notebook);
      },
    },
    update: {
      invoke: async ({ id, name, description }) => {
        const notebook = findNotebook(id);
        if (!notebook) throw new Error(`[notes standalone mock] notebook "${id}" not found`);
        if (name !== undefined) notebook.name = name;
        // `description: null` 的语义是「清空」,对应成 undefined(字段可选)。
        if (description !== undefined) notebook.description = description ?? undefined;
        notebook.updatedAt = now();
        return cloneNotebook(notebook);
      },
    },
    delete: {
      invoke: async ({ id }) => {
        data.notebooks = data.notebooks.filter((nb) => nb.id !== id);
        data.notes = data.notes.filter((note) => note.notebookId !== id);
      },
    },
    listNotes: {
      invoke: async ({ id }) => notesOf(id).map(cloneNote),
    },
    createNote: {
      invoke: async (params: CreateNoteBridgeParams) => {
        const note = makeNote(params);
        data.notes.push(note);
        return cloneNote(note);
      },
    },
  };

  const notes: NotesBridge = {
    list: {
      invoke: async (params?: ListNotesBridgeParams) => {
        const { notebook_id, tag, starred, q, limit, offset } = params ?? {};
        let result = data.notes;
        if (notebook_id !== undefined) {
          result = result.filter((note) => note.notebookId === notebook_id);
        }
        if (tag !== undefined) {
          result = result.filter((note) => note.tags.includes(tag));
        }
        if (starred !== undefined) {
          result = result.filter((note) => note.star === starred);
        }
        if (q !== undefined && q !== '') {
          const needle = q.toLowerCase();
          result = result.filter(
            (note) => note.title.toLowerCase().includes(needle) || (note.content ?? '').toLowerCase().includes(needle)
          );
        }
        const start = offset ?? 0;
        const page = limit === undefined ? result.slice(start) : result.slice(start, start + limit);
        return page.map(cloneNote);
      },
    },
    get: {
      invoke: async ({ id }) => {
        const note = findNote(id);
        if (!note) throw new Error(`[notes standalone mock] note "${id}" not found`);
        return cloneNote(note);
      },
    },
    raw: {
      invoke: async ({ id }) => findNote(id)?.content ?? '',
    },
    create: {
      invoke: async (params: CreateNoteBridgeParams) => {
        const note = makeNote(params);
        data.notes.push(note);
        return cloneNote(note);
      },
    },
    update: {
      invoke: async ({ id, ...params }: UpdateNoteBridgeParams) => {
        const note = findNote(id);
        if (!note) throw new Error(`[notes standalone mock] note "${id}" not found`);
        if (params.title !== undefined) note.title = params.title;
        if (params.content !== undefined) note.content = params.content;
        if (params.notebook_id !== undefined) note.notebookId = params.notebook_id;
        if (params.summary !== undefined) note.summary = params.summary ?? undefined;
        if (params.tags !== undefined) note.tags = [...params.tags];
        if (params.star !== undefined) note.star = params.star;
        note.updatedAt = now();
        return cloneNote(note);
      },
    },
    delete: {
      invoke: async ({ id }) => {
        data.notes = data.notes.filter((note) => note.id !== id);
      },
    },
    star: {
      invoke: async ({ id }) => {
        const note = findNote(id);
        if (!note) throw new Error(`[notes standalone mock] note "${id}" not found`);
        note.star = !note.star;
        note.updatedAt = now();
        return note.star;
      },
    },
  };

  return { notebooks, notes };
}

/**
 * 当前是否装着内存假 bridge。
 *
 * UI 用它决定要不要显示「演示数据」提示条 —— 假数据和真数据长得一模一样
 * (同样是 Inbox / Work 两本笔记本),不标出来的话很容易被当成真实笔记本,
 * 也会让人误以为「嵌到主应用里数据丢了」。
 */
let standaloneMockActive = false;

/**
 * 内存假 bridge 是否正在生效。
 *
 * 只在**独立运行 + dev**下为 true(见 `main.ts`):此时没有宿主、也没有后端,
 * 页面上的一切都是内存里的种子数据。被 shell 托管时恒为 false。
 */
export function isStandaloneMockActive(): boolean {
  return standaloneMockActive;
}

/**
 * 把内存假 bridge 装到 `window.ipcBridge` 上。
 *
 * 宿主(shell)已经注入过 bridge 时**不覆盖** —— 真数据优先。
 *
 * @returns 是否真的装上了(没装 = 宿主已经有真 bridge,或不在浏览器环境)。
 */
export function installStandaloneMockBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const carrier = window as unknown as { ipcBridge?: Record<string, unknown> };
  const existing = carrier.ipcBridge;
  if (existing && existing.notebooks) return false;

  const bridge = createStandaloneMockBridge();
  // `...existing`:existing 是 undefined 时展开也不会报错(等价于展开空对象)
  carrier.ipcBridge = { ...existing, notebooks: bridge.notebooks, notes: bridge.notes };
  standaloneMockActive = true;
  // eslint-disable-next-line no-console
  console.info('[notes] standalone dev: using in-memory mock bridge (data resets on reload)');
  return true;
}
