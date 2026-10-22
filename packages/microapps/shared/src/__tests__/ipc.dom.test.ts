/**
 * createIpcResolver 单元测试
 *
 * 覆盖的契约:
 *   1. 间接 eval 路径:`(0, eval)('window').ipcBridge[windowKey]` 能解析
 *   2. 缓存命中:同 key 重复调用返回同一引用,只做一次间接 eval
 *   3. `__clearIpcResolverCacheForTests` 失效缓存,使新挂载的 bridge 生效
 *   4. 校验失败抛错:bridge 对象结构不匹配 validate 时抛 `errorMessage`
 *
 * **未在单测覆盖的范围**
 * static-require fallback(`require('@/common')`)只在 qiankun UMD 加载上下文
 * 才会被实际调用 — 那条路径在 Electron 真实运行时下被 main app 模块系统
 * 解析,本包在 vitest/jsdom 下没有这条路。meeting-recording 微应用里同样
 * 的 `require('@/common')` 也未在单测中触达(refer to
 * `packages/microapps/meeting-recording/src/__qiankun__/__tests__/adapter.test.ts`
 * 验证的契约仅限 adapter,不验 ipc 解析)。
 * 该路径的真实覆盖由 e2e(Electron + dev 模式)保证,本文件不试图单测。
 */
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { createIpcResolver, __clearIpcResolverCacheForTests } from '../qiankun/ipc';

interface FakeBridge {
  list: { invoke: Mock };
  hello: () => string;
}

const validate = (b: unknown): b is FakeBridge => {
  if (typeof b !== 'object' || b === null) return false;
  const candidate = b as { list?: { invoke?: unknown }; hello?: unknown };
  return typeof candidate.list?.invoke === 'function' && typeof candidate.hello === 'function';
};

const ERROR_MSG = '[test] ipcBridge.fake is unavailable. (test error)';

beforeEach(() => {
  __clearIpcResolverCacheForTests();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
});

describe('createIpcResolver — indirect-eval path', () => {
  it('resolves the bridge from window.ipcBridge[windowKey] via indirect eval', () => {
    const fakeBridge: FakeBridge = {
      list: { invoke: vi.fn().mockResolvedValue('ok') },
      hello: () => 'world',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { 'fake-window-key': fakeBridge };

    const resolver = createIpcResolver<FakeBridge>('fake-window-key', validate, ERROR_MSG);
    const result = resolver();

    expect(result).toBe(fakeBridge);
    expect(result.hello()).toBe('world');
  });

  it('memoises the resolved bridge — same call returns the same reference', () => {
    const fakeBridge: FakeBridge = {
      list: { invoke: vi.fn() },
      hello: () => 'memo',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { 'memo-key': fakeBridge };

    const resolver = createIpcResolver<FakeBridge>('memo-key', validate, ERROR_MSG);
    const first = resolver();
    const second = resolver();
    const third = resolver();

    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('throws the supplied error message when the indirect-eval object fails validation', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = {
      'invalid-key': { list: { invoke: 'not-a-function' } }, // passes typeof check fails validate
    };

    const resolver = createIpcResolver<FakeBridge>('invalid-key', validate, ERROR_MSG);
    expect(() => resolver()).toThrow(ERROR_MSG);
  });

  it('throws when window has no ipcBridge at all', () => {
    // beforeEach 已经清掉 window.ipcBridge
    const resolver = createIpcResolver<FakeBridge>('no-ipc-bridge', validate, ERROR_MSG);
    expect(() => resolver()).toThrow(ERROR_MSG);
  });
});

describe('createIpcResolver — cache invalidation', () => {
  it('__clearIpcResolverCacheForTests invalidates the cache so a new bridge can be picked up', () => {
    const firstBridge: FakeBridge = {
      list: { invoke: vi.fn().mockResolvedValue('first') },
      hello: () => 'first',
    };
    const secondBridge: FakeBridge = {
      list: { invoke: vi.fn().mockResolvedValue('second') },
      hello: () => 'second',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { 'swap-key': firstBridge };
    const resolver = createIpcResolver<FakeBridge>('swap-key', validate, ERROR_MSG);
    expect(resolver().hello()).toBe('first');

    // 模拟 "host 重新挂载了一个新 bridge 实例"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { 'swap-key': secondBridge };
    // 不清缓存,仍是 first
    expect(resolver().hello()).toBe('first');

    // 清缓存后能拿到 second
    __clearIpcResolverCacheForTests();
    expect(resolver().hello()).toBe('second');
  });
});
