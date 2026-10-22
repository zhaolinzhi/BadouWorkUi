/**
 * `qiankun/mount.ts` 单测。
 *
 * 这里把之前在生产里踩到的三个 bug 都钉死成断言,防止下次有人不小心又把
 * `container` 当字符串、`__POWERED_BY_QIANKUN__` 当真 window 判据、
 * `#root` 当 standalone 挂载点。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

// 必须在 import 目标之前 mock,否则 `createRoot` 会拿真实现撞 jsdom 失败。
const renderMock = vi.fn();
const unmountMock = vi.fn();
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: renderMock,
    unmount: unmountMock,
  })),
}));

// 必须在 import 目标之前 stub qiankun 判据的 `window.proxy`,确保模块求值时
// `isQiankunHost()` 表现可控(import 之前改 window 比 import 之后更接近
// 真实加载顺序)。
const installProxy = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).proxy = {};
};
const installPoweredFlag = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__POWERED_BY_QIANKUN__ = true;
};
const clearHostSignals = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).proxy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).__POWERED_BY_QIANKUN__;
};

import {
  clearAppLocalStorage,
  createMicroAppRenderer,
  isQiankunHost,
  resolveMountContainer,
  type RenderProps,
} from '../mount';

const baseProps: RenderProps = {
  token: 'tok',
  userInfo: { id: 'u1', username: 'test', permissions: [], tenantId: 't1' },
  systemCode: 'shared-test',
  baseApi: 'http://localhost/api',
  shellVersion: '0.0.0',
  theme: 'light',
  locale: 'zh-CN',
  on: () => () => {},
  emit: () => {},
  navigate: () => {},
  navigateExternal: () => {},
};

describe('isQiankunHost', () => {
  afterEach(() => clearHostSignals());

  it('detects window.proxy (dev mode host signal)', () => {
    installProxy();
    expect(isQiankunHost()).toBe(true);
  });

  it('detects window.__POWERED_BY_QIANKUN__ as a fallback', () => {
    installPoweredFlag();
    expect(isQiankunHost()).toBe(true);
  });

  it('returns false when neither signal is present', () => {
    expect(isQiankunHost()).toBe(false);
  });
});

describe('resolveMountContainer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the element itself when given an HTMLElement (qiankun shape)', () => {
    const el = document.createElement('div');
    el.id = 'qiankun-wrapper';
    document.body.appendChild(el);

    // 这是核心断言:qiankun 真传过来的就是 HTMLElement,不能走 querySelector。
    expect(resolveMountContainer(el)).toBe(el);
  });

  it('resolves a selector string via document.querySelector', () => {
    const el = document.createElement('div');
    el.id = 'standalone-root';
    document.body.appendChild(el);

    expect(resolveMountContainer('#standalone-root')).toBe(el);
  });

  it('returns null for an empty input without throwing', () => {
    expect(resolveMountContainer(undefined)).toBeNull();
  });

  it('returns null when the selector matches nothing', () => {
    expect(resolveMountContainer('#does-not-exist')).toBeNull();
  });
});

describe('createMicroAppRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    renderMock.mockClear();
    unmountMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('throws a descriptive error when container is unavailable', () => {
    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });

    expect(() => renderer.render({ ...baseProps, container: undefined })).toThrow(
      /\[notes\] mount container is unavailable/
    );
  });

  it('renders into the qiankun wrapper (HTMLElement container)', async () => {
    const wrapper = document.createElement('div');
    wrapper.id = 'qiankun-wrapper';
    document.body.appendChild(wrapper);

    const onContextCreated = vi.fn();
    const onContextCleared = vi.fn();
    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div', null, 'hello'),
      onContextCreated,
      onContextCleared,
    });

    renderer.render({ ...baseProps, container: wrapper });

    // createRoot 必须接到 wrapper 这个真实元素(不是 selector)。
    const { createRoot } = await import('react-dom/client');
    expect(createRoot).toHaveBeenCalledWith(wrapper);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(onContextCreated).toHaveBeenCalledTimes(1);
  });

  it('replaces the previous root on remount without throwing', () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);

    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });

    renderer.render({ ...baseProps, container: wrapper });
    expect(() => renderer.render({ ...baseProps, container: wrapper })).not.toThrow();
    expect(unmountMock).toHaveBeenCalled();
  });

  it('unmount calls onContextCleared and empties the container', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<p>stale</p>';
    document.body.appendChild(wrapper);

    const onContextCleared = vi.fn();
    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
      onContextCleared,
    });

    renderer.render({ ...baseProps, container: wrapper });
    renderer.unmount({ ...baseProps, container: wrapper });

    expect(unmountMock).toHaveBeenCalled();
    expect(onContextCleared).toHaveBeenCalledWith(expect.objectContaining({ systemCode: 'shared-test' }));
    expect(wrapper.innerHTML).toBe('');
  });
});

describe('clearAppLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('removes only keys matching `${systemCode}_`', () => {
    localStorage.setItem('notes_token', 'a');
    localStorage.setItem('notes_userInfo', 'b');
    localStorage.setItem('notes_baseApi', 'c');
    localStorage.setItem('other_token', 'd');
    localStorage.setItem('unrelated', 'e');

    clearAppLocalStorage('notes');

    expect(localStorage.getItem('notes_token')).toBeNull();
    expect(localStorage.getItem('notes_userInfo')).toBeNull();
    expect(localStorage.getItem('notes_baseApi')).toBeNull();
    expect(localStorage.getItem('other_token')).toBe('d');
    expect(localStorage.getItem('unrelated')).toBe('e');
  });

  it('is a no-op when systemCode is undefined', () => {
    localStorage.setItem('notes_token', 'keep');
    clearAppLocalStorage(undefined);
    expect(localStorage.getItem('notes_token')).toBe('keep');
  });
});
