/**
 * `adoptShellI18n` 的行为约定。
 *
 * 这是 jsdom 项目(需要 `window` 供间接 eval 取值),文件名带 `.dom` 后缀。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adoptShellI18n, type AdoptableI18n } from '../i18n';

type Carrier = { i18n?: unknown };

describe('adoptShellI18n', () => {
  beforeEach(() => {
    delete (window as unknown as Carrier).i18n;
  });

  afterEach(() => {
    delete (window as unknown as Carrier).i18n;
  });

  it('shell 挂上实例后,把同一个引用交给 setI18n', () => {
    const instance: AdoptableI18n = { language: 'zh-CN', t: (key: unknown) => key };
    (window as unknown as Carrier).i18n = instance;

    const setI18n = vi.fn();
    expect(adoptShellI18n(setI18n)).toBe(true);
    expect(setI18n).toHaveBeenCalledWith(instance);
  });

  it('独立运行(没有 window.i18n)时静默跳过', () => {
    const setI18n = vi.fn();
    expect(adoptShellI18n(setI18n)).toBe(false);
    expect(setI18n).not.toHaveBeenCalled();
  });

  /** 只认 `t` 是函数 —— 非 i18next 对象挂上来也不能污染 setI18n。 */
  it('window.i18n 形状不对时不接管', () => {
    (window as unknown as Carrier).i18n = { language: 'zh-CN' };

    const setI18n = vi.fn();
    expect(adoptShellI18n(setI18n)).toBe(false);
    expect(setI18n).not.toHaveBeenCalled();
  });

  it('CSP 禁用 unsafe-eval 时返回 false 而不是抛错', () => {
    (window as unknown as Carrier).i18n = { language: 'zh-CN', t: (key: unknown) => key };

    const originalEval = globalThis.eval;
    // @ts-expect-error —— 只为构造 CSP 场景,运行时替换全局 eval
    globalThis.eval = () => {
      throw new Error('unsafe-eval disabled');
    };

    try {
      const setI18n = vi.fn();
      expect(adoptShellI18n(setI18n)).toBe(false);
      expect(setI18n).not.toHaveBeenCalled();
    } finally {
      globalThis.eval = originalEval;
    }
  });
});
