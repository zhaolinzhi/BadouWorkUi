/**
 * standalone 主题处理的测试
 *
 * 覆盖 `standalone/theme.ts`:
 *   - 读出该用哪套外观(读不到 / 存了别的东西时退回亮色)
 *   - 把外观写到 document 上(主题 CSS 变量靠 `html[data-theme]`,
 *     Arco 暗色样式靠 `body[arco-theme]`)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { applyStandaloneTheme, resolveStandaloneTheme } from '../theme';

const APPEARANCE_CACHE_KEY = '__aionui_theme';

describe('resolveStandaloneTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses dark when the cached appearance is dark', () => {
    localStorage.setItem(APPEARANCE_CACHE_KEY, 'dark');

    expect(resolveStandaloneTheme()).toBe('dark');
  });

  it('falls back to light when nothing is cached', () => {
    expect(resolveStandaloneTheme()).toBe('light');
  });

  it('falls back to light when the cached value is not an appearance', () => {
    // shell 还会往同一个键里写主题 id(可能是 'system' 或自定义主题),
    // 那个值不代表明暗,不能拿来当外观用。
    localStorage.setItem(APPEARANCE_CACHE_KEY, 'system');

    expect(resolveStandaloneTheme()).toBe('light');
  });
});

describe('applyStandaloneTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color-scheme');
    document.body.removeAttribute('arco-theme');
  });

  it('marks the document as dark so theme variables and Arco switch over', () => {
    applyStandaloneTheme('dark');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('default');
    expect(document.body.getAttribute('arco-theme')).toBe('dark');
  });

  it('marks the document as light', () => {
    applyStandaloneTheme('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('default');
    expect(document.body.getAttribute('arco-theme')).toBe('light');
  });

  it('overwrites a previously applied appearance', () => {
    applyStandaloneTheme('dark');
    applyStandaloneTheme('light');

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.body.getAttribute('arco-theme')).toBe('light');
  });
});
