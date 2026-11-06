/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `EmptyState` 的行为测试。
 *
 * 它替代三个微应用各写一份的空状态(notes 自绘版、KB 两处自绘、MR 一行纯文本),
 * 统一"图标 + 主文案 + 辅助说明 + 操作入口"的结构。
 *
 * 关键约束:
 *   - 可选内容缺失时**不渲染对应容器** —— 空占位会撑出多余高度,
 *     视觉上表现为"文案下面凭空多出一段空白"。
 *   - 不自带任何 i18n key —— 纯展示组件,文案由调用方传入。
 *     (调用方用 `t(key, { defaultValue })` 拿词条,standalone 下也能兜底。)
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('渲染主文案', () => {
    render(<EmptyState title='还没有笔记' />);

    expect(screen.getByText('还没有笔记')).toBeTruthy();
  });

  it('渲染辅助说明', () => {
    render(<EmptyState title='还没有笔记' description='从左侧选择一个开始编辑' />);

    expect(screen.getByText('从左侧选择一个开始编辑')).toBeTruthy();
  });

  it('未传 description 时不渲染说明容器', () => {
    render(<EmptyState title='还没有笔记' />);

    expect(screen.queryByTestId('empty-state-description')).toBeNull();
  });

  it('未传 description 时不渲染空白的说明行', () => {
    render(<EmptyState title='还没有笔记' />);

    // 根容器下只应剩下 title 一个子元素 —— 多出来的空 div 就是会撑高度的占位行
    const root = screen.getByTestId('empty-state');
    expect(root.children.length).toBe(1);
    expect(root.firstElementChild?.getAttribute('data-testid')).toBe('empty-state-title');
  });

  it('渲染图标', () => {
    render(<EmptyState title='还没有笔记' icon={<span data-testid='custom-icon'>*</span>} />);

    expect(screen.getByTestId('custom-icon')).toBeTruthy();
  });

  it('未传 icon 时不渲染图标容器', () => {
    render(<EmptyState title='还没有笔记' />);

    expect(screen.queryByTestId('empty-state-icon')).toBeNull();
  });

  it('渲染操作入口', () => {
    render(<EmptyState title='还没有笔记' action={<button type='button'>新建笔记</button>} />);

    expect(screen.getByRole('button', { name: '新建笔记' })).toBeTruthy();
  });

  it('未传 action 时不渲染操作区', () => {
    render(<EmptyState title='还没有笔记' />);

    expect(screen.queryByTestId('empty-state-action')).toBeNull();
  });

  it('title 缺失时用 fallback 兜底,不渲染空白标题', () => {
    // 防御性:title 的类型允许 ReactNode,调用方可能传 undefined
    render(<EmptyState title={undefined as unknown as React.ReactNode} />);

    expect(screen.queryByTestId('empty-state-title')).toBeNull();
  });
});
