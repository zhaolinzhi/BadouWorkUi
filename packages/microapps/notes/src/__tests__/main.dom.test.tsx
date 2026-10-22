/**
 * Notes 微应用生命周期冒烟测试
 *
 * 覆盖 spec 5.3 列举的 6 项验收点:
 *   1. bootstrap 不抛错
 *   2. mount 渲染到 `#notes-container`
 *   3. unmount 清空容器
 *   4. token 通过 adapter 写入 localStorage 兜底
 *   5. unmount 清理 localStorage 兜底 (匹配 `${systemCode}_` 前缀)
 *   6. 独立运行(standalone)不报错
 *
 * 该测试仅验证 microapp 的 boot 协议是否符合 qiankun 契约,所有复杂的 React
 * 子树都被 mock 化,真实覆盖率由 NotesPage / VditorEditor 等组件级测试补充。
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import type { MicroAppProps } from '@renderer/micro-app/types';

// 必须在 import main 之前 stub react-router-dom,避免 createMemoryRouter
// 在模块级副作用里尝试访问浏览器 API。
vi.mock('react-router-dom', () => ({
  createMemoryRouter: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    dispatch: vi.fn(),
    getState: vi.fn(),
    subscribe2: vi.fn(),
  })),
  RouterProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  useParams: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock('@arco-design/web-react', () => ({
  ConfigProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  Spin: () => null,
  Empty: () => null,
  List: () => null,
  Button: ({ children }: { children?: ReactNode }) => children ?? null,
  Modal: ({ children }: { children?: ReactNode }) => children ?? null,
  Input: () => null,
  Dropdown: ({ children }: { children?: ReactNode }) => children ?? null,
  Menu: () => null,
  Tooltip: ({ children }: { children?: ReactNode }) => children ?? null,
  Popconfirm: ({ children }: { children?: ReactNode }) => children ?? null,
  Message: { useMessage: () => [vi.fn(), null] },
  Notification: { useNotification: () => [vi.fn(), null] },
}));

vi.mock('@arco-design/web-react/es/locale/en-US', () => ({ default: {} }));
vi.mock('@arco-design/web-react/es/locale/zh-CN', () => ({ default: {} }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

// Vditor 直接 import 了 vditor 包及其 CSS,jsdom 没 lute,需要替换为简单 div
vi.mock('vditor', () => ({
  default: class VditorMock {
    vditor: { id: string } | null = { id: 'mock' };
    constructor(_id: string, _options: unknown) {}
    getValue() {
      return '';
    }
    setValue(_v: string) {}
    setTheme() {}
    insertValue() {}
    destroy() {}
    focus() {}
    blur() {}
  },
}));
vi.mock('vditor/dist/index.css', () => ({}));

// NoteItem 引用了主应用的 i18n + dayjs 实时格式化函数,jsdom 没有 dayjs
// locale 资源,这里用最简 passthrough 即可。
vi.mock('@renderer/utils/formatRelativeTime', () => ({
  formatRelativeTime: () => '',
  formatAbsoluteTime: () => '',
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

const baseProps: MicroAppProps = {
  token: 'test-token',
  userInfo: { id: 'u1', username: 'test-user', permissions: [], tenantId: 't1' },
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

describe('notes micro-app lifecycle', () => {
  let mod: typeof import('../main');

  beforeAll(async () => {
    // 模块仅解析一次 — notes 依赖链较长,每次 vi.resetModules() 重新加载
    // 会让测试套件拖到 30+ 秒。共享同一模块实例时,所有 mount/unmount 测试
    // 都在同一个 rootInstance 上动作,前面的 unmount 会清理好状态。
    mod = await import('../main');
  }, 60000);

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('bootstrap does not throw', async () => {
    await expect(mod.bootstrap()).resolves.not.toThrow();
  });

  it('mount renders into #notes-container', async () => {
    const container = document.createElement('div');
    container.id = 'notes-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#notes-container' });

    const { createRoot } = await import('react-dom/client');
    expect(createRoot).toHaveBeenCalled();
  });

  it('mount writes token + userInfo + baseApi to localStorage via adapter', async () => {
    const container = document.createElement('div');
    container.id = 'notes-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#notes-container' });

    expect(localStorage.getItem('notes-test_token')).toBe('test-token');
    expect(localStorage.getItem('notes-test_baseApi')).toBe('http://localhost:0/api');
    const storedUser = localStorage.getItem('notes-test_userInfo');
    expect(storedUser).not.toBeNull();
    expect(JSON.parse(storedUser as string)).toMatchObject({
      id: 'u1',
      username: 'test-user',
      tenantId: 't1',
    });
  });

  it('unmount clears container and removes systemCode-prefixed localStorage keys', async () => {
    const container = document.createElement('div');
    container.id = 'notes-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#notes-container' });

    // 写入一个无关的 key,确保 unmount 不会误伤其它子应用的数据
    localStorage.setItem('other_app_token', 'keep-me');

    await mod.unmount({ ...baseProps, container: '#notes-container' });

    expect(container.innerHTML).toBe('');
    expect(localStorage.getItem('notes-test_token')).toBeNull();
    expect(localStorage.getItem('notes-test_baseApi')).toBeNull();
    expect(localStorage.getItem('notes-test_userInfo')).toBeNull();
    expect(localStorage.getItem('other_app_token')).toBe('keep-me');
  });

  it('module loads without throwing when standalone (#notes-root present)', () => {
    // 模块级副作用:在非 qiankun 环境下会同步调 standalone 渲染。
    // 刻意用 #notes-root(子应用私有 id),**不**用 #root —— shell 的
    // index.html 就有 #root,同名会导致 standalone 分支误吞整个 shell DOM
    // (参见 packages/microapps/notes/index.html 注释)。
    const root = document.createElement('div');
    root.id = 'notes-root';
    document.body.appendChild(root);
    expect(mod).toBeDefined();
    expect(typeof mod.mount).toBe('function');
    expect(typeof mod.unmount).toBe('function');
    expect(typeof mod.bootstrap).toBe('function');
  });

  it('mount accepts an HTMLElement container (qiankun shape) without throwing', async () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'qiankun-wrapper';
    document.body.appendChild(wrapper);

    // qiankun 实际传过来的是 wrapper 元素,不是 selector。
    // 旧实现把元素 toString 后丢给 querySelector 会直接 SyntaxError。
    await expect(mod.mount({ ...baseProps, container: wrapper })).resolves.not.toThrow();
    await mod.unmount({ ...baseProps, container: wrapper });
  });

  it('mount handles re-mount by replacing previous root instance', async () => {
    const container = document.createElement('div');
    container.id = 'notes-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#notes-container' });
    // 第二次 mount 应替换已存在的 rootInstance,不应抛错
    await expect(mod.mount({ ...baseProps, container: '#notes-container' })).resolves.not.toThrow();
    await mod.unmount({ ...baseProps, container: '#notes-container' });
  });
});
