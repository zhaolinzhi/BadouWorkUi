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
  isMobile: false,
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

/** 造一个 qiankun wrapper 元素,内容就是子应用模板的 HTML。 */
const buildWrapper = (html: string): HTMLElement => {
  const wrapper = document.createElement('div');
  wrapper.id = '__qiankun_microapp_wrapper_for_notes__';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper;
};

/**
 * 打包态样式丢失的回归测试(坑四)。
 *
 * 打包后 `import-html-entry` 会把 CSS 内联成 `<style>` 塞进 qiankun wrapper 里的
 * `<qiankun-head>`,而 React 的 `createRoot().render()` 首次提交会清空容器 ——
 * 样式就这样没了。这里断言样式在 `createRoot` 之前就被搬到了真实的
 * `document.head`。
 */
describe('createMicroAppRenderer —— 样式节点搬运', () => {
  const MARK = 'data-test-hoist';

  const headStyles = (): HTMLStyleElement[] =>
    Array.from(document.head.querySelectorAll<HTMLStyleElement>(`style[${MARK}]`));

  beforeEach(() => {
    document.body.innerHTML = '';
    headStyles().forEach((node) => node.remove());
    renderMock.mockClear();
    unmountMock.mockClear();
  });

  afterEach(() => {
    headStyles().forEach((node) => node.remove());
    document.body.innerHTML = '';
  });

  it('把 <qiankun-head> 里的内联样式搬到 document.head', () => {
    const wrapper = buildWrapper(
      `<qiankun-head><style ${MARK}>.microapp-notes{color:red}</style></qiankun-head><div id="notes-root"></div>`
    );

    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });
    renderer.render({ ...baseProps, container: wrapper });

    const moved = headStyles();
    expect(moved).toHaveLength(1);
    expect(moved[0].textContent).toContain('.microapp-notes{color:red}');
    // 容器里不能再有样式节点 —— 否则 React 清空容器时会被一起抹掉。
    expect(wrapper.querySelector('style')).toBeNull();
  });

  it('搬运发生在 createRoot 之前', async () => {
    const wrapper = buildWrapper(`<qiankun-head><style ${MARK}>.x{}</style></qiankun-head>`);

    const { createRoot } = await import('react-dom/client');
    let styleCountAtRootCreation = -1;
    vi.mocked(createRoot).mockImplementationOnce((container: Element) => {
      styleCountAtRootCreation = container.querySelectorAll('style').length;
      return { render: renderMock, unmount: unmountMock } as unknown as ReturnType<typeof createRoot>;
    });

    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });
    renderer.render({ ...baseProps, container: wrapper });

    expect(styleCountAtRootCreation).toBe(0);
  });

  it('把 <link rel="stylesheet"> 一并搬走', () => {
    const wrapper = buildWrapper(`<qiankun-head><link rel="stylesheet" href="./assets/app.css"></qiankun-head>`);

    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });
    renderer.render({ ...baseProps, container: wrapper });

    expect(document.head.querySelector('link[rel="stylesheet"][href="./assets/app.css"]')).not.toBeNull();
    expect(wrapper.querySelector('link')).toBeNull();
  });

  it('重复挂载不会在 head 里堆积多份样式', () => {
    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });

    const first = buildWrapper(`<qiankun-head><style ${MARK}>.v1{}</style></qiankun-head>`);
    renderer.render({ ...baseProps, container: first });
    expect(headStyles()).toHaveLength(1);

    // remount:qiankun 会重新生成一个 wrapper,里面是新的 style 节点。
    first.remove();
    const second = buildWrapper(`<qiankun-head><style ${MARK}>.v2{}</style></qiankun-head>`);
    renderer.render({ ...baseProps, container: second });

    expect(headStyles()).toHaveLength(1);
    expect(headStyles()[0].textContent).toContain('.v2{}');
  });

  it('unmount 时把搬走的样式一并清理', () => {
    const wrapper = buildWrapper(`<qiankun-head><style ${MARK}>.gone{}</style></qiankun-head>`);

    const renderer = createMicroAppRenderer({
      name: 'notes',
      renderApp: () => React.createElement('div'),
    });
    renderer.render({ ...baseProps, container: wrapper });
    expect(headStyles()).toHaveLength(1);

    renderer.unmount({ ...baseProps, container: wrapper });
    expect(headStyles()).toHaveLength(0);
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
