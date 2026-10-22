/**
 * meeting-recording 微应用生命周期冒烟测试
 *
 * 验证 microapp 的 boot 协议符合 qiankun 契约:bootstrap 不抛错、mount 渲染到
 * 容器、unmount 清空容器并清理 localStorage 兜底。所有复杂 React 子树被 mock
 * 化,真实覆盖率由组件级 / hook 级测试补充。
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
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => children ?? null,
    Paragraph: ({ children }: { children?: ReactNode }) => children ?? null,
  },
  Message: { error: vi.fn(), success: vi.fn(), useMessage: () => [vi.fn(), null] },
  Notification: { useNotification: () => [vi.fn(), null] },
}));

vi.mock('@arco-design/web-react/es/locale/en-US', () => ({ default: {} }));
vi.mock('@arco-design/web-react/es/locale/zh-CN', () => ({ default: {} }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
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
  systemCode: 'meeting-recording-test',
  baseApi: 'http://localhost:0/api',
  shellVersion: '0.0.0',
  theme: 'light',
  locale: 'zh-CN',
  on: () => () => {},
  emit: () => {},
  navigate: () => {},
  navigateExternal: () => {},
};

describe('meeting-recording micro-app lifecycle', () => {
  let mod: typeof import('../main');

  beforeAll(async () => {
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

  it('mount renders into #meeting-recording-container', async () => {
    const container = document.createElement('div');
    container.id = 'meeting-recording-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#meeting-recording-container' });

    const { createRoot } = await import('react-dom/client');
    expect(createRoot).toHaveBeenCalled();
  });

  it('mount writes token + userInfo + baseApi to localStorage via adapter', async () => {
    const container = document.createElement('div');
    container.id = 'meeting-recording-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#meeting-recording-container' });

    expect(localStorage.getItem('meeting-recording-test_token')).toBe('test-token');
    expect(localStorage.getItem('meeting-recording-test_baseApi')).toBe('http://localhost:0/api');
    const storedUser = localStorage.getItem('meeting-recording-test_userInfo');
    expect(storedUser).not.toBeNull();
    expect(JSON.parse(storedUser as string)).toMatchObject({
      id: 'u1',
      username: 'test-user',
      tenantId: 't1',
    });
  });

  it('unmount clears container and removes systemCode-prefixed localStorage keys', async () => {
    const container = document.createElement('div');
    container.id = 'meeting-recording-container';
    document.body.appendChild(container);

    await mod.mount({ ...baseProps, container: '#meeting-recording-container' });

    // 写入一个无关的 key,确保 unmount 不会误伤其它子应用的数据
    localStorage.setItem('other_app_token', 'keep-me');

    await mod.unmount({ ...baseProps, container: '#meeting-recording-container' });

    expect(container.innerHTML).toBe('');
    expect(localStorage.getItem('meeting-recording-test_token')).toBeNull();
    expect(localStorage.getItem('meeting-recording-test_baseApi')).toBeNull();
    expect(localStorage.getItem('meeting-recording-test_userInfo')).toBeNull();
    expect(localStorage.getItem('other_app_token')).toBe('keep-me');
  });

  it('module loads without throwing when standalone (#meeting-recording-root present)', () => {
    // 模块级副作用:在非 qiankun 环境下会同步调 standalone 渲染。
    // 刻意用 #meeting-recording-root(子应用私有 id),**不**用 #root —— shell
    // 的 index.html 就有 #root,同名会导致 standalone 分支误吞整个 shell DOM。
    const root = document.createElement('div');
    root.id = 'meeting-recording-root';
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

    await expect(mod.mount({ ...baseProps, container: wrapper })).resolves.not.toThrow();
    await mod.unmount({ ...baseProps, container: wrapper });
  });
});
