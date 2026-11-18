/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 侧栏会话行的布局性能不变量。
 *
 * 背景:侧栏收起/展开时 Arco 过渡的是 sider 的 `width`,过渡的每一帧里每行的
 * 可用宽度都在变,于是每行的 flex 布局和省略号文本都要重新测量一遍 —— 成本是
 * 「行数 × 帧数」,对话上千条时单帧能到几百毫秒。解法是让滚出视口的行不参与
 * 布局(`content-visibility: auto`),把成本压到「可视行数」。
 *
 * 这条优化完全靠 CSS,没有运行时行为可以测,所以这里锁的是**让它保持有效的前提**:
 * 1. 会话行必须开着离屏跳过;
 * 2. 固有尺寸(占位高度)必须等于 React 侧的真实行高,否则被跳过的行会撑出
 *    错误的高度,滚动条长度会随滚动位置跳变;
 * 3. 折叠态必须继续用 `display: none` 隐藏文字 —— 实测换成 `visibility` 反而
 *    更慢(3000 行收起帧间隔 p95 83ms → 333ms),因为文字仍在参与排版。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RENDERER_STYLES = path.resolve(__dirname, '../../../packages/desktop/src/renderer/styles');
const ROW_COMPONENT = path.resolve(
  __dirname,
  '../../../packages/desktop/src/renderer/pages/conversation/GroupedHistory/ConversationRow.tsx'
);

/** 去掉注释 —— 注释里也会出现 `display:` 之类的字样,留着会误判。 */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** 取某个选择器对应的声明块(选择器必须独占一行、以 `{` 结尾)。 */
const ruleBody = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`样式表里找不到规则: ${selector}`);
  return match[1];
};

/**
 * 取**嵌套**写法里的声明块 —— base.css 用的是 CSS Nesting:
 *   .collapsed { .collapsed-hidden { display: none } }
 * 这里按「外层选择器 → 内层选择器」的顺序找。
 */
const nestedRuleBody = (css: string, outer: string, inner: string): string => {
  const escapedOuter = outer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedInner = inner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedOuter}\\s*\\{[\\s\\S]*?${escapedInner}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`样式表里找不到嵌套规则: ${outer} { ${inner} }`);
  return match[1];
};

/** 声明块里某个属性的值。 */
const decl = (body: string, property: string): string | undefined => {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body.trim());
  return match?.[1].trim();
};

const layoutCss = stripComments(fs.readFileSync(path.join(RENDERER_STYLES, 'layout.css'), 'utf8'));
const baseCss = stripComments(fs.readFileSync(path.join(RENDERER_STYLES, 'themes/base.css'), 'utf8'));
const rowSource = fs.readFileSync(ROW_COMPONENT, 'utf8');

describe('侧栏会话行的布局性能', () => {
  it('会话行开启离屏跳过:视口外的行不参与布局与绘制', () => {
    const body = ruleBody(layoutCss, '.chat-history__item');
    expect(decl(body, 'content-visibility')).toBe('auto');
  });

  it('固有尺寸的高度与 React 侧行高一致,保证滚动条长度稳定', () => {
    // React 侧:行元素自己的 className 里带的高度类(h-34px)。
    // 只在 `chat-history__item` 那一段里找 —— 文件里别处还有图标尺寸类。
    const rowClassStart = rowSource.indexOf("'chat-history__item");
    expect(rowClassStart, 'ConversationRow 上找不到会话行的 className').toBeGreaterThan(-1);
    const rowClassName = rowSource.slice(rowClassStart, rowSource.indexOf("'", rowClassStart + 1));
    const heightMatch = /\bh-(\d+)px\b/.exec(rowClassName);
    expect(heightMatch, `会话行的 className 里找不到行高类 h-Npx: ${rowClassName}`).toBeTruthy();
    const rowHeight = Number(heightMatch![1]);

    const body = ruleBody(layoutCss, '.chat-history__item');
    const intrinsic = decl(body, 'contain-intrinsic-size');
    expect(intrinsic, '会话行缺少 contain-intrinsic-size,跳过渲染时高度会塌掉').toBeTruthy();

    const intrinsicHeight = /(\d+)px/.exec(intrinsic!);
    expect(intrinsicHeight, `contain-intrinsic-size 里没有像素高度: ${intrinsic}`).toBeTruthy();
    expect(Number(intrinsicHeight![1])).toBe(rowHeight);
  });

  it('折叠态仍然用 display:none 隐藏行内文字,不用 visibility', () => {
    const body = nestedRuleBody(baseCss, '.collapsed', '.collapsed-hidden');
    expect(decl(body, 'display')).toBe('none');
    expect(decl(body, 'visibility')).toBeUndefined();
  });
});
