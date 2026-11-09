/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 知识库首页样式的守卫测试。
 *
 * 设计稿(BadouWork-Desktop-Handoff 的 `knowledge.css`)给的是一组具体数值:
 * 卡片 184px 高、网格最小列宽 220px、搜索框 240×36、范围切换 128×32。
 * 这些数字一旦被「顺手清理」改掉,页面就会跟设计稿对不上 —— 而这种偏差在
 * 截图里很难一眼看出。这里把关键数值钉住。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

/** 取某个选择器所在的规则块正文(选择器成组书写时取整组)。 */
const rule = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 后面必须紧跟 `,` 或 `{` —— 否则 `.scopeTab` 会误命中 `.scopeTabs`。
  const match = new RegExp(`${escaped}(?=\\s*[,{])`).exec(css);
  expect(match, `找不到规则 ${selector}`).not.toBeNull();
  const braceStart = css.indexOf('{', match!.index);
  return css.slice(braceStart, css.indexOf('}', braceStart));
};

describe('知识库首页样式 —— 对齐设计稿', () => {
  const homeCss = read('../KnowledgeBaseHomeTabs.module.css');
  const cardCss = read('../../components/kb/KnowledgeBaseCard.module.css');
  const gridCss = read('../../components/kb/KnowledgeBaseGrid.module.css');

  it('首页留白:宽 calc(100% - 48px),上下 24px / 32px', () => {
    const home = rule(homeCss, '.home');
    expect(home).toContain('width: calc(100% - 48px)');
    expect(home).toContain('margin: 24px auto 32px');
  });

  it('标题:20px / 500 / 28px,副标题 12px 次要色', () => {
    expect(rule(homeCss, '.title')).toContain('font-size: 20px');
    expect(rule(homeCss, '.title')).toContain('font-weight: 500');
    expect(rule(homeCss, '.title')).toContain('line-height: 28px');
    expect(rule(homeCss, '.subtitle')).toContain('font-size: 12px');
    expect(rule(homeCss, '.subtitle')).toContain('var(--kb-muted)');
  });

  it('范围切换:128×32 的胶囊,选中项白底浅蓝描边', () => {
    const tab = rule(homeCss, '.scopeTab');
    expect(tab).toContain('width: 128px');
    expect(tab).toContain('height: 32px');
    expect(tab).toContain('border-radius: 999px');
    const active = rule(homeCss, '.scopeTabActive');
    expect(active).toContain('var(--kb-surface)');
    expect(active).toContain('var(--kb-brand-border)');
    expect(active).toContain('var(--kb-brand)');
  });

  it('搜索框:240×36,浅灰底,聚焦时浅蓝描边', () => {
    const search = rule(homeCss, '.search');
    expect(search).toContain('width: 240px');
    expect(search).toContain('height: 36px');
    expect(search).toContain('border-radius: 8px');
    expect(search).toContain('var(--kb-app-bg)');
    expect(rule(homeCss, '.search:focus-within')).toContain('var(--kb-focus-ring)');
  });

  it('搜索框里的 Arco 输入链必须清掉底色/描边/光影', () => {
    // shell 的 layout.css 用 `!important` 压过 Arco 输入框的底色,微应用
    // 要盖住只能同样写 `!important` —— 这里锁住,别被后人「清理」掉。
    for (const selector of [
      '.search :global(.arco-input-group-wrapper)',
      '.search :global(.arco-input-group)',
      '.search :global(.arco-input-inner-wrapper)',
      '.search :global(.arco-input)',
    ]) {
      const block = rule(homeCss, selector);
      expect(block).toContain('background: transparent !important');
      expect(block).toContain('border: none !important');
      expect(block).toContain('box-shadow: none !important');
    }
  });

  it('工具行:网格布局 + 36px 高,排序下拉 112×36', () => {
    const tools = rule(homeCss, '.listTools');
    expect(tools).toContain('grid-template-columns: minmax(0, 1fr) max-content');
    expect(tools).toContain('height: 36px');
    expect(rule(homeCss, '.sortSelect')).toContain('width: 112px');
    expect(rule(homeCss, '.sortSelect :global(.arco-select-view)')).toContain('height: 36px');
  });

  it('卡片:184px 高、16px 内边距、8px 圆角', () => {
    const card = rule(cardCss, '.card');
    expect(card).toContain('height: 184px');
    expect(card).toContain('padding: 16px');
    expect(card).toContain('border-radius: 8px');
  });

  it('卡片名称 14px/500,描述最多两行', () => {
    expect(rule(cardCss, '.name')).toContain('font-size: 14px');
    expect(rule(cardCss, '.name')).toContain('font-weight: 500');
    expect(rule(cardCss, '.description')).toContain('-webkit-line-clamp: 2');
  });

  it('网格:最小列宽 220px、间距 20px', () => {
    const grid = rule(gridCss, '.grid');
    expect(grid).toContain('minmax(min(100%, 220px), 1fr)');
    expect(grid).toContain('gap: 20px');
  });
});
