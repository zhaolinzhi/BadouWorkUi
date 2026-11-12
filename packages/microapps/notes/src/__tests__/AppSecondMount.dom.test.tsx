/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 「第二次打开笔记会崩」的回归测试。
 *
 * 崩溃现场(生产环境):
 *
 * ```
 * TypeError: r.has is not a function
 *   at __privateAdd       (react-router)
 *   at new DataRoutes     (react-router)
 *   at createRouter       (react-router)
 *   at createMemoryRouter (react-router-dom)
 *   at <useMemo 工厂>      (notes/src/App.tsx)
 * ```
 *
 * 根因:router 是在 **React render 阶段**用 `useMemo` 的工厂创建的。
 * 子应用第二次打开时,`createMemoryRouter()` 在渲染过程中再跑一遍,
 * react-router 内部那套私有字段(WeakMap)就炸了。
 *
 * 本文件钉住的行为:**无论挂载多少次,router 只被创建一次。**
 * 这是修复的核心 —— `createRouter` 只跑一次,`new DataRoutes()` 那句
 * 就只执行一次,第二次打开时不会走到那条会炸的语句。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { __clearRouterCacheForTests } from '@aionui/microapp-shared';

vi.mock('@arco-design/web-react', () => ({
  ConfigProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Spin: () => null,
  Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Empty: () => null,
}));
vi.mock('@arco-design/web-react/es/locale/en-US', () => ({ default: {} }));
vi.mock('@arco-design/web-react/es/locale/zh-CN', () => ({ default: {} }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
  setI18n: vi.fn(),
}));
vi.mock('vditor', () => ({
  default: class VditorMock {
    vditor = { id: 'mock' };
    getValue() {
      return '';
    }
    setValue() {}
    setTheme() {}
    insertValue() {}
    destroy() {}
    focus() {}
    blur() {}
  },
}));
vi.mock('vditor/dist/index.css', () => ({}));

const IPC_BRIDGE = {
  notebooks: {
    list: { invoke: async () => [] },
    get: { invoke: async () => ({ notebook: {}, notes: [] }) },
    create: { invoke: async () => ({}) },
    update: { invoke: async () => ({}) },
    delete: { invoke: async () => undefined },
    listNotes: { invoke: async () => [] },
    createNote: { invoke: async () => ({}) },
  },
  notes: {
    list: { invoke: async () => [] },
    get: { invoke: async () => ({}) },
    raw: { invoke: async () => '' },
    create: { invoke: async () => ({}) },
    update: { invoke: async () => ({}) },
    delete: { invoke: async () => undefined },
    star: { invoke: async () => false },
  },
};

const CONTEXT = {
  token: 'test-token',
  userInfo: { id: 'u1', username: 'tester', permissions: [], tenantId: 't1' },
  systemCode: 'notes-test',
  baseApi: 'http://localhost:0/api',
  shellVersion: '0.0.0',
  theme: 'light',
  locale: 'zh-CN',
  isMobile: false,
  on: () => () => {},
  emit: () => {},
  navigate: () => {},
  navigateExternal: () => {},
};

describe('notes App — router 创建次数', () => {
  let App: typeof import('../App').App;
  let AppContext: typeof import('../AppContext').AppContext;
  let roots: Root[] = [];

  beforeEach(async () => {
    __clearRouterCacheForTests();
    (window as unknown as { ipcBridge?: unknown }).ipcBridge = IPC_BRIDGE;
    App = (await import('../App')).App;
    AppContext = (await import('../AppContext')).AppContext;
    roots = [];
  });

  afterEach(() => {
    for (const root of roots) {
      try {
        root.unmount();
      } catch {
        // 卸载失败不是本用例的断言目标
      }
    }
    roots = [];
    document.body.innerHTML = '';
  });

  const mountApp = (): Root => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    roots.push(root);
    root.render(
      <AppContext.Provider value={CONTEXT as never}>
        <App context={CONTEXT as never} routerBase='/' />
      </AppContext.Provider>
    );
    return root;
  };

  it('creates the router only once across a mount → unmount → mount cycle', async () => {
    // 统计 createRouter 的真实调用次数 —— 这正是崩溃的那句语句。
    const routerModule = await import('../router');
    const spy = vi.spyOn(routerModule, 'createRouter');

    // 第一次打开
    mountApp();
    await new Promise((r) => setTimeout(r, 100));
    expect(spy).toHaveBeenCalledTimes(1);

    // 关闭
    roots[0]?.unmount();
    roots = [];

    // 第二次打开 —— 崩溃现场。router 不应该被重建。
    mountApp();
    await new Promise((r) => setTimeout(r, 100));

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('renders without throwing on the first mount', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener('error', onError);

    mountApp();
    await new Promise((r) => setTimeout(r, 100));

    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  });

  it('renders without throwing when mounted a second time', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener('error', onError);

    mountApp();
    await new Promise((r) => setTimeout(r, 100));
    roots[0]?.unmount();
    roots = [];
    mountApp();
    await new Promise((r) => setTimeout(r, 100));

    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  });

  it('recreates the router when the router base changes', async () => {
    // 反向用例:缓存不能把不同 base 混为一谈。
    // base 变化时新 router 在 **effect** 里创建(不在 render 阶段),所以要等一拍。
    const routerModule = await import('../router');
    const spy = vi.spyOn(routerModule, 'createRouter');

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    roots.push(root);
    root.render(
      <AppContext.Provider value={CONTEXT as never}>
        <App context={CONTEXT as never} routerBase='/' />
      </AppContext.Provider>
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(spy).toHaveBeenCalledTimes(1);

    root.render(
      <AppContext.Provider value={CONTEXT as never}>
        <App context={CONTEXT as never} routerBase='/other' />
      </AppContext.Provider>
    );
    await new Promise((r) => setTimeout(r, 100));

    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
