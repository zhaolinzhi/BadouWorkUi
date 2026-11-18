/**
 * qiankun adapter 单元测试(共享包版)
 *
 * `createAppContext` 把 props 镜像到 localStorage 作为兜底 — spec 5.2 列出的
 * 契约之一,行为必须稳定以便其它子应用在离线/降级场景下能取回自己的会话。
 *
 * 该文件本身运行在 node 环境(node-project),jsdom setup 不会注入
 * localStorage,因此在文件顶部提供一个最小可用的 in-memory 实现,避免依赖
 * jsdom 也能在 CI 上稳定通过。
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import type { MicroAppProps } from '../types';
import { createAppContext } from '../adapter';

// Minimal localStorage shim for node env. Adapter 只用到 setItem / getItem,
// 因此无须实现 length / key / removeItem。
beforeAll(() => {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const store = new Map<string, string>();
  const shim = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, writable: true });
});

afterAll(() => {
  // 保留 shim 给运行同一 worker 的兄弟测试使用,这里只清理 store。
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

const fullProps: MicroAppProps = {
  token: 'tk-1',
  userInfo: {
    id: 'u-42',
    username: 'alice',
    avatar: 'https://example.com/a.png',
    permissions: ['shared.read', 'shared.write'],
    tenantId: 'tenant-9',
  },
  systemCode: 'shared-test',
  baseApi: 'https://example.com/api',
  shellVersion: '0.0.0',
  theme: 'dark',
  locale: 'zh-CN',
  isMobile: false,
  on: () => () => {},
  emit: () => {},
  navigate: () => {},
  navigateExternal: () => {},
};

describe('createAppContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists token, userInfo and baseApi into namespaced localStorage keys', () => {
    createAppContext(fullProps);

    expect(localStorage.getItem('shared-test_token')).toBe('tk-1');
    expect(localStorage.getItem('shared-test_baseApi')).toBe('https://example.com/api');

    const userJson = localStorage.getItem('shared-test_userInfo');
    expect(userJson).not.toBeNull();
    const stored = JSON.parse(userJson as string);
    expect(stored).toMatchObject({
      id: 'u-42',
      username: 'alice',
      avatar: 'https://example.com/a.png',
      permissions: ['shared.read', 'shared.write'],
      tenantId: 'tenant-9',
    });
  });

  it('does not write token key when token is empty', () => {
    createAppContext({ ...fullProps, token: '' });
    expect(localStorage.getItem('shared-test_token')).toBeNull();
    // 但是 baseApi 仍应写入 — 它是每次 mount 都需要刷新的运行时配置
    expect(localStorage.getItem('shared-test_baseApi')).toBe('https://example.com/api');
  });

  it('does not write userInfo key when username is empty', () => {
    createAppContext({ ...fullProps, userInfo: { ...fullProps.userInfo, username: '' } });
    expect(localStorage.getItem('shared-test_userInfo')).toBeNull();
  });

  it('returns the same props it received (passthrough)', () => {
    const result = createAppContext(fullProps);
    expect(result).toBe(fullProps);
  });

  it('uses the per-system prefix so two micro-apps do not share storage', () => {
    createAppContext({ ...fullProps, systemCode: 'app-a', token: 'a-token' });
    createAppContext({ ...fullProps, systemCode: 'app-b', token: 'b-token' });

    expect(localStorage.getItem('app-a_token')).toBe('a-token');
    expect(localStorage.getItem('app-b_token')).toBe('b-token');
    expect(localStorage.getItem('shared-test_token')).toBeNull();
  });
});
