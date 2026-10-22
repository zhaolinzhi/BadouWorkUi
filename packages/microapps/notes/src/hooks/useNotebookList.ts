/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../AppContext';
import { createNotebookApi } from '../api/notebooks';
import { createNotesApi } from '../api/notes';
import type { NoteItem, Notebook } from '../api/types';

/**
 * Manages the local notebooks/notes collection backed by the aionui-notebook
 * REST API exposed by the qiankun shell (`baseApi` + `token` from
 * `useAppContext()`).
 *
 * - `notebooks` / `notes` are mirrored in local state for snappy UI updates;
 * - mutations call the backend first, then patch local state on success;
 * - on failure, the local state is left untouched and the error is logged.
 *
 * Per `notebook-api.md`, notes are associated with notebooks by **id**
 * (`notebook_id`), and the full Markdown body is only available via the raw
 * endpoint — so `content` is fetched lazily on demand. Because ownership is
 * keyed by id, renaming a notebook never has to mutate the notes array.
 */
export interface NotebookListHook {
  notebooks: Notebook[];
  notes: NoteItem[];
  loading: boolean;
  error: string | null;
  getNotesByNotebookId(notebookId: string): NoteItem[];
  getNoteById(id: string): NoteItem | undefined;
  getNotebookById(id: string): Notebook | undefined;
  loadNoteContent(id: string): Promise<string>;
  createNotebook(name: string): Promise<Notebook>;
  renameNotebook(id: string, name: string): Promise<void>;
  deleteNotebook(id: string): Promise<void>;
  createNote(notebookId: string, title: string): Promise<NoteItem>;
  renameNote(id: string, title: string): void;
  updateNoteContent(id: string, content: string): Promise<void>;
  deleteNote(id: string): Promise<void>;
  toggleNoteStar(id: string): Promise<boolean>;
  setNoteStar(id: string, star: boolean): Promise<void>;
}

export function useNotebookList(): NotebookListHook {
  const ctx = useAppContext();
  const api = useMemo(
    () => ({
      // baseApi / token 不再需要 — 数据通道走 `__qiankun__/ipc.ts` 拿主进程
      // `ipcBridge.notebooks` / `ipcBridge.notes`,内部用 `__backendPort` 直连后端。
      // 工厂签名保留 `{ baseApi; token }` 以最小化 hook 改动。
      notebooks: createNotebookApi({ baseApi: ctx.baseApi, token: ctx.token }),
      notes: createNotesApi({ baseApi: ctx.baseApi, token: ctx.token }),
    }),
    [ctx.token]
  );

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [nbList, noteList] = await Promise.all([api.notebooks.list(), api.notes.list({})]);
        if (cancelled) return;
        setNotebooks(nbList);
        setNotes(noteList);
      } catch (e) {
        console.error('[useNotebookList] failed to load notebooks/notes', e);
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [api.notebooks, api.notes]);

  const getNotesByNotebookId = useCallback(
    (notebookId: string) => notes.filter((n) => n.notebookId === notebookId),
    [notes]
  );

  const getNoteById = useCallback((id: string) => notes.find((n) => n.id === id), [notes]);

  const getNotebookById = useCallback((id: string) => notebooks.find((n) => n.id === id), [notebooks]);

  /** Lazily fetch the full Markdown body via the raw endpoint. */
  const loadNoteContent = useCallback(
    async (id: string): Promise<string> => {
      const content = await api.notes.raw(id);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
      return content;
    },
    [api.notes]
  );

  const createNotebook = useCallback(
    async (name: string): Promise<Notebook> => {
      const notebook = await api.notebooks.create(name);
      setNotebooks((prev) => [...prev, notebook]);
      return notebook;
    },
    [api.notebooks]
  );

  const renameNotebook = useCallback(
    async (id: string, name: string): Promise<void> => {
      const updated = await api.notebooks.update(id, { name });
      setNotebooks((prev) => prev.map((n) => (n.id === id ? updated : n)));
    },
    [api.notebooks]
  );

  const deleteNotebook = useCallback(
    async (id: string): Promise<void> => {
      await api.notebooks.delete(id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      setNotes((prev) => prev.filter((n) => n.notebookId !== id));
    },
    [api.notebooks]
  );

  /** `notebookId` is the parent notebook id (ownership is resolved by id). */
  const createNote = useCallback(
    async (notebookId: string, title: string): Promise<NoteItem> => {
      const note = await api.notes.create({ notebook_id: notebookId, title, content: '' });
      setNotes((prev) => [...prev, note]);
      return note;
    },
    [api.notes]
  );

  const renameNote = useCallback(
    (id: string, title: string): void => {
      // Optimistic local update so the sidebar re-renders before the API
      // round-trip resolves. We deliberately do not await the PUT here —
      // the title appears instantly, the local state stays the source of
      // truth, and the PUT is fired-and-forgotten. If the PUT later fails
      // we revert; if it succeeds we re-attach the just-sent title (the
      // backend response may carry a stale snapshot).
      const previous = notes.find((n) => n.id === id);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
      void api.notes
        .update(id, { title })
        .then((updated) => {
          // Backend ApiNote response may not reflect our just-sent title
          // (server-side persistence can lag or read the title from a
          // header PUT doesn't refresh). Re-attach the canonical title.
          setNotes((prev) => prev.map((n) => (n.id === id ? { ...updated, title, content: n.content } : n)));
        })
        .catch((e: unknown) => {
          console.error('[useNotebookList] renameNote failed, reverting', e);
          if (previous) {
            setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: previous.title } : n)));
          }
        });
    },
    [api.notes, notes]
  );

  const updateNoteContent = useCallback(
    async (id: string, content: string): Promise<void> => {
      // The backend `ApiNote` response shape does not include `title` (the
      // list/get endpoints source it from a separate column / first-line
      // fallback). A concurrent `renameNote` may have already committed a
      // new title while this PUT was in flight — read the latest title from
      // the functional updater so the merged note keeps the user's just-set
      // title instead of reverting to the value captured by this closure.
      const updated = await api.notes.update(id, { content });
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...updated, title: n.title, content } : n)));
    },
    [api.notes]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      await api.notes.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [api.notes]
  );

  /** Toggle the star state via `POST /api/notes/{id}/star`. */
  const toggleNoteStar = useCallback(
    async (id: string): Promise<boolean> => {
      const star = await api.notes.star(id);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, star } : n)));
      return star;
    },
    [api.notes]
  );

  /** Directly set the star state via `PUT /api/notes/{id}`. */
  const setNoteStar = useCallback(
    async (id: string, star: boolean): Promise<void> => {
      const updated = await api.notes.update(id, { star });
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    },
    [api.notes]
  );

  return {
    notebooks,
    notes,
    loading,
    error,
    getNotesByNotebookId,
    getNoteById,
    getNotebookById,
    loadNoteContent,
    createNotebook,
    renameNotebook,
    deleteNotebook,
    createNote,
    renameNote,
    updateNoteContent,
    deleteNote,
    toggleNoteStar,
    setNoteStar,
  };
}
