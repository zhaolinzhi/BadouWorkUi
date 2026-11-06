/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 搜索框样式守卫。
 *
 * 踩过的坑:shell 的 `layout.css` 里有
 * `.arco-input, .arco-input-inner-wrapper { background-color: var(--fill-0) !important }`,
 * 给输入区刷了一层白底。子应用里的覆盖不带 `!important` 就压不过它 ——
 * 浅灰胶囊里会露出一圈白色矩形(用户截图就是这个现象)。
 *
 * 这里的 `!important` 不是审美偏好,是压 shell 全局样式的必需品,
 * 所以直接读样式表源码把它锁住(vitest 不加载真实 CSS,量不到几何)。
 */
const pageCss = readFileSync(fileURLToPath(new URL('../RecordingListPage.module.css', import.meta.url)), 'utf8');

/** 取某个选择器的规则块内容(按 CSS 源码文本定位,不玩正则)。 */
const rule = (selector: string): string => {
  const start = pageCss.indexOf(selector);
  expect(start, `找不到规则 ${selector}`).not.toBe(-1);
  const open = pageCss.indexOf('{', start);
  const close = pageCss.indexOf('}', open);
  return pageCss.slice(open + 1, close);
};

describe('录音列表搜索框样式', () => {
  it('尺寸与底色对齐设计稿:260×34、8px 圆角、浅灰底', () => {
    const search = rule('.search {');
    expect(search).toMatch(/width:\s*260px/);
    expect(search).toMatch(/height:\s*34px/);
    expect(search).toMatch(/border-radius:\s*8px/);
    expect(search).toMatch(/background:\s*var\(--rec-app-bg\)/);
  });

  it('Arco 输入链的底色、边框、阴影全部被清掉', () => {
    for (const selector of [
      '.search :global(.arco-input-group-wrapper)',
      '.search :global(.arco-input-group),',
      '.search :global(.arco-input-inner-wrapper)',
      '.search :global(.arco-input)',
    ]) {
      const body = rule(selector);
      expect(body, selector).toMatch(/background:\s*transparent\s*!important/);
      expect(body, selector).toMatch(/border:\s*none\s*!important/);
      expect(body, selector).toMatch(/box-shadow:\s*none\s*!important/);
    }
  });

  it('聚焦态不再画品牌色描边', () => {
    const focus = rule('.search :global(.arco-input-inner-wrapper-focus),');
    expect(focus).toMatch(/border:\s*none\s*!important/);
    expect(focus).toMatch(/box-shadow:\s*none\s*!important/);
  });

  it('占位符用设计稿的浅灰', () => {
    expect(pageCss).toMatch(/placeholder\)\s*\{[^}]*color:\s*var\(--rec-placeholder\)/);
  });
});
