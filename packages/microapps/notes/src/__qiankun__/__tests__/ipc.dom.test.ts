/**
 * notes 微应用 ipcBridge 单元测试
 *
 * 验证 `ipcBridge.notebooks` / `ipcBridge.notes` 两个 getter 在 notes 微应用
 * 上下文能正确解析(走 createIpcResolver → 间接 eval `window.ipcBridge`)。
 *
 * `createIpcResolver` 工厂本身的行为(缓存、错误信息、static-require fallback)
 * 由 `packages/microapps/shared/src/__tests__/ipc.dom.test.ts` 覆盖,本文件只
 * 验证"传入正确的 windowKey + validate,getter 能拿到 bridge"。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __clearIpcResolverCacheForTests } from '@aionui/microapp-shared';
import { ipcBridge } from '../ipc';

beforeEach(() => {
  __clearIpcResolverCacheForTests();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
});

describe('ipcBridge — notebooks getter', () => {
  it('resolves window.ipcBridge.notebooks through the indirect-eval path', () => {
    const fakeNotebooks = {
      list: { invoke: vi.fn().mockResolvedValue([]) },
      get: { invoke: vi.fn() },
      create: { invoke: vi.fn() },
      update: { invoke: vi.fn() },
      delete: { invoke: vi.fn() },
      listNotes: { invoke: vi.fn() },
      createNote: { invoke: vi.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { notebooks: fakeNotebooks };

    expect(ipcBridge.notebooks).toBe(fakeNotebooks);
    expect(typeof ipcBridge.notebooks.list.invoke).toBe('function');
  });
});

describe('ipcBridge — notes getter', () => {
  it('resolves window.ipcBridge.notes through the indirect-eval path', () => {
    const fakeNotes = {
      list: { invoke: vi.fn().mockResolvedValue([]) },
      get: { invoke: vi.fn() },
      raw: { invoke: vi.fn() },
      create: { invoke: vi.fn() },
      update: { invoke: vi.fn() },
      delete: { invoke: vi.fn() },
      star: { invoke: vi.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { notes: fakeNotes };

    expect(ipcBridge.notes).toBe(fakeNotes);
    expect(typeof ipcBridge.notes.star.invoke).toBe('function');
  });
});

describe('ipcBridge — both getters share the resolver cache', () => {
  it('returns the same reference on repeated access', () => {
    const fakeNotebooks = {
      list: { invoke: vi.fn() },
      get: { invoke: vi.fn() },
      create: { invoke: vi.fn() },
      update: { invoke: vi.fn() },
      delete: { invoke: vi.fn() },
      listNotes: { invoke: vi.fn() },
      createNote: { invoke: vi.fn() },
    };
    const fakeNotes = {
      list: { invoke: vi.fn() },
      get: { invoke: vi.fn() },
      raw: { invoke: vi.fn() },
      create: { invoke: vi.fn() },
      update: { invoke: vi.fn() },
      delete: { invoke: vi.fn() },
      star: { invoke: vi.fn() },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { notebooks: fakeNotebooks, notes: fakeNotes };

    expect(ipcBridge.notebooks).toBe(ipcBridge.notebooks);
    expect(ipcBridge.notes).toBe(ipcBridge.notes);
  });
});

describe('ipcBridge — error path', () => {
  it('throws when neither window nor static-require provides a notebooks bridge', () => {
    // beforeEach 清掉 window.ipcBridge
    expect(() => ipcBridge.notebooks).toThrow(/notes microapp.*ipcBridge\.notebooks/);
  });

  it('throws when neither window nor static-require provides a notes bridge', () => {
    expect(() => ipcBridge.notes).toThrow(/notes microapp.*ipcBridge\.notes/);
  });
});
