/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * `getRouter` 的行为契约。
 *
 * 背景:子应用第二次打开时,`useMemo(() => createRouter(...))` 会在 React
 * render 阶段重复创建 router,react-router 内部的 `new DataRoutes()`
 * (私有字段走 WeakMap)抛 `TypeError: r.has is not a function`。
 * `getRouter` 把创建挪到模块期并按 base 缓存 —— 这里钉住这个契约。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRouter, __clearRouterCacheForTests } from '../router';

describe('getRouter', () => {
  beforeEach(() => {
    __clearRouterCacheForTests();
  });

  it('creates the router once and reuses the same instance on later calls', () => {
    const factory = vi.fn(() => ({ state: {}, subscribe: () => () => {} }));

    const first = getRouter('/', factory);
    const second = getRouter('/', factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('creates separate routers for different router bases', () => {
    const factory = vi.fn(() => ({ state: {}, subscribe: () => () => {} }));

    const root = getRouter('/', factory);
    const nested = getRouter('/nested', factory);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(nested).not.toBe(root);
  });

  it('passes the router base through to the factory', () => {
    const factory = vi.fn(() => ({ state: {}, subscribe: () => {} }));

    getRouter('/nested', factory);

    expect(factory).toHaveBeenCalledWith('/nested');
  });

  it('propagates a factory failure instead of caching a broken router', () => {
    const factory = vi.fn(() => {
      throw new Error('router creation failed');
    });

    expect(() => getRouter('/', factory)).toThrow('router creation failed');

    // 失败不应留下缓存 —— 下一次调用必须重新尝试,而不是拿到半成品。
    const working = vi.fn(() => ({ state: {}, subscribe: () => {} }));
    expect(getRouter('/', working)).toBeDefined();
    expect(working).toHaveBeenCalledTimes(1);
  });
});
