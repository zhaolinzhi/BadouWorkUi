/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * standalone 内存假 bridge 的单测
 *
 * 覆盖两件事:
 *   1. 假 bridge 的行为跟宿主那侧对齐(增删改查 / 过滤 / 收藏 / 报错);
 *   2. 装上之后,`__qiankun__/ipc.ts` 的 resolver 能真的拿到它 ——
 *      这是「standalone dev 不再整页崩掉」的关键一环。
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { __clearIpcResolverCacheForTests } from '@aionui/microapp-shared';
import { createStandaloneMockBridge, installStandaloneMockBridge } from '../standaloneMock';
import { ipcBridge } from '../ipc';

beforeEach(() => {
  __clearIpcResolverCacheForTests();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
});

describe('createStandaloneMockBridge — notebooks', () => {
  it('lists the seeded notebooks', async () => {
    const { notebooks } = createStandaloneMockBridge();
    const list = await notebooks.list.invoke();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((nb) => typeof nb.id === 'string' && typeof nb.name === 'string')).toBe(true);
  });

  it('creates a notebook that shows up in the next list', async () => {
    const { notebooks } = createStandaloneMockBridge();
    const created = await notebooks.create.invoke({ name: 'Fresh' });
    expect(created.name).toBe('Fresh');
    const list = await notebooks.list.invoke();
    expect(list.map((nb) => nb.id)).toContain(created.id);
  });

  it('renames a notebook without touching its notes', async () => {
    const { notebooks, notes } = createStandaloneMockBridge();
    const [notebook] = await notebooks.list.invoke();
    const before = await notes.list.invoke({});

    const updated = await notebooks.update.invoke({ id: notebook.id, name: 'Renamed' });

    expect(updated.name).toBe('Renamed');
    expect((await notes.list.invoke({})).length).toBe(before.length);
  });

  it('rejects renaming a notebook that does not exist', async () => {
    const { notebooks } = createStandaloneMockBridge();
    await expect(notebooks.update.invoke({ id: 'nope', name: 'x' })).rejects.toThrow(/not found/);
  });

  it('deletes a notebook together with the notes inside it', async () => {
    const { notebooks, notes } = createStandaloneMockBridge();
    const [notebook] = await notebooks.list.invoke();
    const notesBefore = await notes.list.invoke({ notebook_id: notebook.id });
    expect(notesBefore.length).toBeGreaterThan(0);

    await notebooks.delete.invoke({ id: notebook.id });

    expect((await notebooks.list.invoke()).map((nb) => nb.id)).not.toContain(notebook.id);
    expect(await notes.list.invoke({ notebook_id: notebook.id })).toHaveLength(0);
  });

  it('lists only the notes that belong to the given notebook', async () => {
    const { notebooks, notes } = createStandaloneMockBridge();
    const [notebook, other] = await notebooks.list.invoke();

    const owned = await notebooks.listNotes.invoke({ id: notebook.id });

    expect(owned.length).toBeGreaterThan(0);
    expect(owned.every((note) => note.notebookId === notebook.id)).toBe(true);
    expect((await notes.list.invoke({ notebook_id: other.id })).length).toBeGreaterThan(0);
  });
});

describe('createStandaloneMockBridge — notes', () => {
  it('creates a note under the given notebook', async () => {
    const { notebooks, notes } = createStandaloneMockBridge();
    const [notebook] = await notebooks.list.invoke();

    const created = await notes.create.invoke({ title: 'Fresh note', notebook_id: notebook.id });

    expect(created.notebookId).toBe(notebook.id);
    expect((await notes.list.invoke({ notebook_id: notebook.id })).map((n) => n.id)).toContain(created.id);
  });

  it('updates title and content of an existing note', async () => {
    const { notes } = createStandaloneMockBridge();
    const [note] = await notes.list.invoke({});

    const updated = await notes.update.invoke({ id: note.id, title: 'New title', content: 'New body' });

    expect(updated.title).toBe('New title');
    expect(updated.content).toBe('New body');
  });

  it('toggles the star flag and reports the new value', async () => {
    const { notes } = createStandaloneMockBridge();
    const [note] = await notes.list.invoke({});
    const before = note.star;

    const starred = await notes.star.invoke({ id: note.id });

    expect(starred).toBe(!before);
  });

  it('filters the list by starred flag', async () => {
    const { notes } = createStandaloneMockBridge();
    await notes.star.invoke({ id: (await notes.list.invoke({}))[0].id });

    const starred = await notes.list.invoke({ starred: true });

    expect(starred.length).toBeGreaterThan(0);
    expect(starred.every((note) => note.star)).toBe(true);
  });

  it('returns an empty body for an unknown note instead of throwing', async () => {
    const { notes } = createStandaloneMockBridge();
    await expect(notes.raw.invoke({ id: 'nope' })).resolves.toBe('');
  });

  it('rejects reading a note that does not exist', async () => {
    const { notes } = createStandaloneMockBridge();
    await expect(notes.get.invoke({ id: 'nope' })).rejects.toThrow(/not found/);
  });

  it('leaves the list untouched when deleting an unknown note', async () => {
    const { notes } = createStandaloneMockBridge();
    const before = await notes.list.invoke({});

    await notes.delete.invoke({ id: 'nope' });

    expect((await notes.list.invoke({})).length).toBe(before.length);
  });
});

describe('installStandaloneMockBridge', () => {
  it('makes the bridge resolvable through the notes ipc accessor', async () => {
    expect(installStandaloneMockBridge()).toBe(true);

    const list = await ipcBridge.notebooks.list.invoke();
    expect(list.length).toBeGreaterThan(0);
    expect(await ipcBridge.notes.list.invoke({})).toBeDefined();
  });

  it('does not overwrite a bridge the host already installed', () => {
    const hostBridge = { list: { invoke: vi.fn() } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { notebooks: hostBridge };

    expect(installStandaloneMockBridge()).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).ipcBridge.notebooks).toBe(hostBridge);
  });

  it('is idempotent — installing twice keeps the first bridge', async () => {
    installStandaloneMockBridge();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (window as any).ipcBridge.notebooks;

    installStandaloneMockBridge();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).ipcBridge.notebooks).toBe(first);
  });
});
