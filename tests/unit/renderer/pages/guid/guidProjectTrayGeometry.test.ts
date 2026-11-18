/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 首页「项目托盘」几何契约守卫。
 *
 * 设计稿(BadouWork-Desktop-Handoff/preview/index.html)里:
 *   .project-tray —— absolute 定位的底层灰托盘,72px 高,往上盖住白卡底部 21px,
 *                    只在白卡下方露出 51px,「选择项目」文字贴底。
 *   .assistant.selected —— 白底 + 浅蓝描边的选中药丸。
 *
 * 这两处曾经各错一次:托盘被实现成普通流元素(所以显得过高),
 * 药丸的选中态白底被 Arco `Button type='text'` 的运行时样式盖掉(所以透出灰底)。
 * jsdom 跑不了 CSS Module 的真实样式,只能对样式表源码做断言。
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 直接读样式表源码 —— vitest 跑 CSS Module 时只会给出类名代理,
// 真实的声明文本拿不到。
const css = readFileSync(
  path.resolve(process.cwd(), 'packages/desktop/src/renderer/pages/guid/index.module.css'),
  'utf-8'
);

/** 取出某个类名规则块里的声明(不含选择器本身)。 */
function ruleBody(className: string): string {
  const match = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, `样式表里找不到 .${className} 规则`).not.toBeNull();
  return match![1];
}

/** 取出某个类名规则块里的某个声明值(小写比较,忽略书写格式差异)。 */
function declaration(className: string, property: string): string {
  const body = ruleBody(className);
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(body);
  expect(match, `.${className} 里没有 ${property} 声明`).not.toBeNull();
  return match![1].trim().toLowerCase();
}

describe('项目托盘几何 —— 对齐设计稿 .project-tray', () => {
  it('托盘底色层是 absolute 定位的 72px 底层,贴在白卡下方', () => {
    expect(declaration('projectTrayBg', 'position')).toBe('absolute');
    expect(declaration('projectTrayBg', 'bottom')).toBe('0');
    expect(declaration('projectTrayBg', 'height')).toBe('72px');
  });

  it('文案行 absolute 定位在底部,高 51px(白卡下方露出的一截)', () => {
    expect(declaration('workspaceFootnote', 'position')).toBe('absolute');
    expect(declaration('workspaceFootnote', 'bottom')).toBe('0');
    expect(declaration('workspaceFootnote', 'height')).toBe('51px');
    // 文字贴底:底边距 16px,与设计稿 .project-tray 的 padding 一致。
    expect(declaration('workspaceFootnote', 'padding')).toContain('16px');
  });

  it('外层容器为托盘预留 51px,不再让文案行撑高整块区域', () => {
    expect(declaration('guidInputCardWrap', 'padding-bottom')).toBe('51px');
  });
});

describe('助手药丸选中态 —— 对齐设计稿 .assistant.selected', () => {
  it('白底与浅蓝描边都带 !important,压过 Arco text button 的运行时样式', () => {
    const body = ruleBody('assistantPillSelected');
    // Arco 的 `Button type='text'` 运行时注入 `background-color: transparent`
    // 与 `box-shadow: none`,同优先级下会盖掉这里的选中态。
    expect(body).toMatch(/background:\s*var\(--guid-assistant-selected-bg\)\s*!important/);
    expect(body).toMatch(/box-shadow:[^;]*!important/);
  });
});
