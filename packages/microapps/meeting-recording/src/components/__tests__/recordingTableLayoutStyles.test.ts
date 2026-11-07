/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 录音表格的布局样式守卫。
 *
 * 踩过的坑:表格是内容区的 flex 子项,默认 `flex-shrink: 1` —— 内容超出时
 * 先被压扁的是表头(表头是表格里第一个可缩的子项),表现成「表头高度异常」
 * (36px 被压成文字高度 18px)。同时写死 540px 的空态块会撑破内容区,
 * 逼出一条本不该出现的纵向滚动条。
 *
 * 这些都是几何问题,vitest 不加载真实 CSS 量不到,所以直接读样式表源码锁住。
 */
const listCss = readFileSync(fileURLToPath(new URL('../RecordingList.module.css', import.meta.url)), 'utf8');

/** 取某个选择器的规则块内容(按 CSS 源码文本定位,不玩正则)。 */
const rule = (selector: string): string => {
  const start = listCss.indexOf(selector);
  expect(start, `找不到规则 ${selector}`).not.toBe(-1);
  const open = listCss.indexOf('{', start);
  const close = listCss.indexOf('}', open);
  return listCss.slice(open + 1, close);
};

describe('录音表格布局样式', () => {
  it('表格与表头都不参与收缩,表头保持 36px', () => {
    expect(rule('.table {')).toMatch(/flex-shrink:\s*0/);
    const head = rule('.head {');
    expect(head).toMatch(/height:\s*36px/);
    expect(head).toMatch(/flex-shrink:\s*0/);
  });

  it('空结果态:表格占满内容区,空态块吃掉剩余高度', () => {
    const tableEmpty = rule('.tableEmpty {');
    expect(tableEmpty).toMatch(/flex:\s*1 1 0/);
    expect(tableEmpty).toMatch(/min-height:\s*0/);
    const emptyBody = rule('.emptyBody {');
    expect(emptyBody).toMatch(/flex:\s*1 1 0/);
    expect(emptyBody).toMatch(/min-height:\s*0/);
  });
});
