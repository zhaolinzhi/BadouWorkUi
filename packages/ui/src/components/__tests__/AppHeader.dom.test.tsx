/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `AppHeader` 的行为测试。
 *
 * notes 的 `NotesToolbar`、knowledge-base 的 `KnowledgeBaseEditorPage` 顶部条
 * 结构一样:左侧返回/标题,右侧操作按钮。差别只在按钮和文案。
 *
 * 关键约束:
 *   - **插槽式布局** —— leading(返回)、标题、副标题、trailing(操作)各占其位。
 *   - **颜色只用语义 token**。微应用与 shell 在同一 document,CSS 变量天然继承。
 *   - **零内置文案**。
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import AppHeader from '../AppHeader';

describe('AppHeader', () => {
  it('渲染标题', () => {
    render(<AppHeader title='笔记' />);

    expect(screen.getByText('笔记')).toBeTruthy();
  });

  it('渲染 leading 插槽', () => {
    render(<AppHeader title='笔记' leading={<button type='button'>返回</button>} />);

    expect(screen.getByRole('button', { name: '返回' })).toBeTruthy();
  });

  it('渲染 trailing 插槽', () => {
    render(<AppHeader title='笔记' trailing={<button type='button'>导出</button>} />);

    expect(screen.getByRole('button', { name: '导出' })).toBeTruthy();
  });

  it('渲染副标题', () => {
    render(<AppHeader title='笔记' subtitle='3 篇' />);

    expect(screen.getByText('3 篇')).toBeTruthy();
  });

  it('标题缺省时不渲染标题节点', () => {
    const { container } = render(<AppHeader trailing={<span>操作</span>} />);

    expect(container.querySelector('[data-testid="app-header-title"]')).toBeNull();
  });

  it('副标题缺省时不渲染副标题节点', () => {
    const { container } = render(<AppHeader title='笔记' />);

    expect(container.querySelector('[data-testid="app-header-subtitle"]')).toBeNull();
  });

  it('sticky 缺省为真 —— 顶部条要吸顶', () => {
    const { container } = render(<AppHeader title='笔记' />);

    expect(container.querySelector('[data-testid="app-header"]')?.className).toContain('sticky');
  });

  it('sticky 为 false 时不吸顶', () => {
    const { container } = render(<AppHeader title='笔记' sticky={false} />);

    expect(container.querySelector('[data-testid="app-header"]')?.className).not.toContain('sticky');
  });

  it('用语义 token 上色 —— 不硬编码色值', () => {
    const { container } = render(<AppHeader title='笔记' />);
    const cls = container.querySelector('[data-testid="app-header"]')?.className ?? '';

    expect(cls).toContain('bg-1');
    expect(cls).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
