/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * 录音表格的列宽守卫。
 *
 * 踩过的坑:表头(`.head`)与行(`.row`)分属两个 CSS Module,一开始各自写死
 * `minmax(0,1fr) 146px 226px 206px 148px`。窗口一窄,固定列合计 726px 先把
 * 空间吃光,`1fr` 的名称列被压成 0 —— 表头的「录音名称」竖着排成一行,行里的
 * 名称也被挤出格子(用户截图就是这个现象)。
 *
 * 现在两份样式都引用页面给的 `--rec-cols`,页面再按容器查询在窄宽度下换列宽。
 * 这条用例直接读样式表源码锁住这三点(vitest 不加载真实 CSS,量不到几何)。
 */
const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const listCss = read('../RecordingList.module.css');
const itemCss = read('../RecordingListItem.module.css');
const pageCss = read('../../pages/RecordingListPage.module.css');

describe('录音表格列宽', () => {
  it('表头与行引用同一份列宽模板', () => {
    expect(listCss).toMatch(/\.head\s*\{[^}]*grid-template-columns:\s*var\(--rec-cols\)/);
    expect(itemCss).toMatch(/\.row\s*\{[^}]*grid-template-columns:\s*var\(--rec-cols\)/);
    // 两边都不许再写死列宽 —— 写死就会各断各的,又对不齐。
    expect(listCss).not.toMatch(/grid-template-columns:\s*minmax/);
    expect(itemCss).not.toMatch(/grid-template-columns:\s*minmax/);
  });

  it('页面按容器宽度切换列宽', () => {
    expect(pageCss).toMatch(/container-type:\s*inline-size/);
    expect(pageCss).toMatch(/container-name:\s*rec-list/);
    expect(pageCss).toMatch(/--rec-cols:\s*minmax\(0,\s*1fr\)\s+146px\s+226px\s+206px\s+148px/);
    // 窄容器下换成设计稿的紧凑列宽
    expect(pageCss).toMatch(/@container rec-list \(max-width: 1200px\)/);
    expect(pageCss).toMatch(/@container rec-list \(max-width: 880px\)/);
  });

  it('表格有最小宽度,窄窗口横向滚动而不是压扁列', () => {
    expect(listCss).toMatch(/\.table\s*\{[^}]*min-width:\s*640px/);
  });

  it('表头文字不换行 —— 列再窄也是一行', () => {
    expect(listCss).toMatch(/\.head > span\s*\{[^}]*white-space:\s*nowrap/);
  });

  it('列间距由页面统一给出,表头与行用同一份', () => {
    // 设计稿是 gap:0,但它的时间文案比我们的短,贴到下一列会糊成一团。
    // 间距同样要两边一致,否则表头文字与下面的内容会错开。
    expect(pageCss).toMatch(/--rec-col-gap:\s*16px/);
    expect(listCss).toMatch(/\.head\s*\{[^}]*column-gap:\s*var\(--rec-col-gap\)/);
    expect(itemCss).toMatch(/\.row\s*\{[^}]*column-gap:\s*var\(--rec-col-gap\)/);
  });
});
