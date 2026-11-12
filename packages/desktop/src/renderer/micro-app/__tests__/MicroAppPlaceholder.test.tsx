import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { loadMicroApp } from 'qiankun';
import { MicroAppPlaceholder } from '../views/MicroAppPlaceholder';

/**
 * MicroAppHost 是 lazy 加载的,`loadMicroApp` 的调用时机在测试断言之后。
 * 所以这里用一个可变的工厂来控制 parcel 的挂载结果,而不是
 * `mockImplementationOnce` —— once 的消费顺序跟 lazy 加载时序赛跑,不可靠。
 */
let parcelFactory: () => unknown = () => ({
  mount: vi.fn(),
  unmount: vi.fn(),
  update: vi.fn(),
  loadPromise: Promise.resolve(),
  mountPromise: Promise.resolve(),
});

vi.mock('qiankun', () => ({
  loadMicroApp: vi.fn(() => parcelFactory()),
}));

/**
 * 固定住 `useTranslation` 的 hook 数量。
 *
 * 真实的 `useTranslation` 在**拿不到 i18n 实例**时会提前 return(只调一个
 * `useContext`);等 lazy 加载的 `MicroAppHost` 把 i18n 注册到全局后,下一次
 * 渲染它会多调 `useCallback` / `useState` —— hook 数量变了,React 直接报
 * "change in the order of Hooks" 并把整棵子树拆掉(表现为 spinner 突然消失)。
 *
 * 这跟被测逻辑无关,纯粹是测试环境里 i18n 注册时机太晚,固定成同一实现即可。
 */
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-CN' } }),
}));

/** MicroAppHost 用 `useNavigate()`,lazy 加载完成后必须有 Router 兜着。 */
const renderPlaceholder = (name: string) =>
  render(
    <MemoryRouter>
      <MicroAppPlaceholder microAppName={name} />
    </MemoryRouter>
  );

/**
 * 等 `loadMicroApp` 真的被调用。
 *
 * MicroAppHost 是 `React.lazy` 动态导入的,首次渲染时模块还在加载,
 * 直到 import 完成后组件才挂载、`loadMicroApp` 才被调用。测试环境里
 * 这一步要现场 transform 整条依赖链,耗时可能好几秒,所以给足超时。
 */
const waitForLoadMicroApp = async () => {
  await waitFor(
    () => {
      expect(vi.mocked(loadMicroApp).mock.calls.length).toBeGreaterThan(0);
    },
    { timeout: 20000 }
  );
};

describe('MicroAppPlaceholder', () => {
  it('renders container node with correct id', () => {
    const { container } = renderPlaceholder('meeting-recording');
    const node = container.querySelector('#meeting-recording-container');
    expect(node).toBeTruthy();
  });

  it('shows loading state initially', () => {
    const { container } = renderPlaceholder('meeting-recording');
    // 断言 spinner 本体而不是文案:i18n 初始化是异步的,文案可能是 key
    // 本身('common.loading'),也可能已被翻译成目标语言,文案不稳定。
    expect(container.querySelector('.arco-spin')).toBeTruthy();
  });

  /**
   * 高度链回归测试。
   *
   * 子应用根节点用 `h-full`(height: 100%),而百分比高度要求祖先有确定高度。
   * 这条链上 shell 侧有三层:placeholder 根节点 → 容器 → qiankun 运行时插入的
   * wrapper。任何一层少了高度,子应用就会退化成内容高度(表现:页面只有内容
   * 那么高,下方留白)。
   */
  it('stretches the placeholder root to the full route content height', () => {
    const { container } = renderPlaceholder('notes');
    const root = container.querySelector('.micro-app-placeholder');

    expect(root?.className).toContain('flex');
    expect(root?.className).toContain('flex-col');
    expect(root?.className).toContain('h-full');
    expect(root?.className).toContain('min-h-0');
    // Loading / ErrorFallback 靠 `relative` 父级做绝对定位覆盖
    expect(root?.className).toContain('relative');
  });

  it('stretches the qiankun container and its wrapper', () => {
    const { container } = renderPlaceholder('notes');
    const appContainer = container.querySelector('#notes-container');

    expect(appContainer?.className).toContain('flex-1');
    expect(appContainer?.className).toContain('min-h-0');
    // qiankun 在容器里插入的 wrapper 是 `processTpl` 生成的
    // `<div id="__qiankun_microapp_wrapper_for_<name>__" data-name=...>`,
    // 只有 id、没有 className,样式只能靠子选择器下发。
    // 注意:它**没有** data-qiankun 属性(qiankun 2.x 全仓无此属性)。
    expect(appContainer?.className).toContain('[&>[id*=qiankun]]');
  });

  it('overlays the loading spinner instead of flowing it below the flex-1 container', () => {
    const { container, getByText } = renderPlaceholder('notes');

    // 容器是 flex-1(永久占满高度),Loading 若走正常流会被挤到视口外,
    // 所以它必须绝对定位覆盖整块区域。
    const overlay = container.querySelector('.absolute.inset-0');
    expect(overlay).toBeTruthy();
    expect(overlay?.contains(getByText(/loading/i))).toBe(true);
  });

  /**
   * 子应用挂载期间容器里只有 qiankun 的空 wrapper,界面上是白屏。
   * loading 必须一直盖到 `mountPromise` resolve(子应用真的挂上)为止,
   * 挂完才撤掉。
   */
  it('keeps the loading overlay until the micro app reports mounted', async () => {
    let resolveMount: (() => void) | undefined;
    parcelFactory = () => ({
      mount: vi.fn(),
      unmount: vi.fn(),
      update: vi.fn(),
      loadPromise: Promise.resolve(),
      mountPromise: new Promise<void>((resolve) => {
        resolveMount = resolve;
      }),
    });

    const { container, queryByText } = renderPlaceholder('notes');

    // 挂载完成前:loading 覆盖层在
    await waitForLoadMicroApp();
    expect(container.querySelector('.absolute.inset-0')).toBeTruthy();
    expect(queryByText(/loading/i)).toBeTruthy();

    // 挂载完成后:loading 撤掉
    resolveMount?.();
    await waitFor(
      () => {
        expect(queryByText(/loading/i)).toBeNull();
      },
      { timeout: 5000 }
    );
  });

  /** 挂载失败时给错误页,而不是无限转圈。 */
  it('shows an error page when the micro app fails to mount', async () => {
    parcelFactory = () => ({
      mount: vi.fn(),
      unmount: vi.fn(),
      update: vi.fn(),
      loadPromise: Promise.resolve(),
      mountPromise: Promise.reject(new Error('entry unreachable')),
    });

    const { container } = renderPlaceholder('notes');

    await waitForLoadMicroApp();
    await waitFor(
      () => {
        expect(container.textContent).toMatch(/error/i);
      },
      { timeout: 5000 }
    );
    expect(container.textContent).toContain('entry unreachable');
  });
});
