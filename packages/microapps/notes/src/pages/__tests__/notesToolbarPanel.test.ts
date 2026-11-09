/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记工具栏「标题下拉菜单被裁掉」的回归锁。
 *
 * 症状:点开 Vditor 的标题菜单,面板往上溢出工具栏,六项里只有
 * 「三级标题」「四级标题」露出来,点不到其它标题 —— 标题设不了。
 *
 * 两个成因都在样式表里,所以这里直接锁住那两条不变量:
 * 1. 下拉面板的**包含块**必须落在 `.vditor` 上(`position: relative`),
 *    不能留在工具栏项上 —— 工具栏要横向滚动(`overflow-x: auto`),包含块
 *    在工具栏内部时面板会被 overflow 裁掉。
 * 2. 工具栏项必须是 `position: static` + `display: block` ——
 *    `display: inline-flex` 会让绝对定位的面板按「唯一 flex item」算静态
 *    位置,被 `align-items: center` 垂直居中,面板于是往上溢出。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const CSS_PATH = path.resolve(__dirname, '../NotesPage.module.css');
/** 去掉注释 —— 注释里也会出现 `position:` 之类的字样,留着会误判。 */
const css = fs.readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** 取某个选择器对应的声明块。 */
const ruleBody = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`样式表里找不到规则: ${selector}`);
  return match[1];
};

/** 声明块里某个属性的值。 */
const decl = (body: string, property: string): string | undefined => {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body.trim());
  return match?.[1].trim();
};

describe('笔记工具栏的下拉面板', () => {
  it('面板的包含块上移到 .vditor,避开工具栏的 overflow 裁剪', () => {
    const body = ruleBody('.editorContainer :global(.vditor)');
    expect(decl(body, 'position')).toBe('relative');
  });

  it('工具栏项是 static + block:面板的静态位置落在按钮正下方', () => {
    const body = ruleBody('.editorContainer :global(.vditor-toolbar__item)');
    expect(decl(body, 'position')).toBe('static');
    expect(decl(body, 'display')).toBe('block');
  });

  it('上传按钮自己当包含块,隐藏的 file input 仍然盖在按钮上', () => {
    const body = ruleBody('.editorContainer :global(.vditor-toolbar__item .vditor-tooltipped)');
    expect(decl(body, 'position')).toBe('relative');
  });
});
