/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `ConfirmModal` 的行为测试。
 *
 * 它收拢 notes 的 `DeleteConfirmModal` 与 knowledge-base 的
 * `DeleteKnowledgeBaseModal` —— 两处几乎逐字相同的 Arco `Modal` 包装。
 *
 * 关键约束:
 *   - **零内置文案**。标题、说明、按钮文字全部由调用方传入。
 *   - **danger 时确认按钮走危险态**。
 *   - **微应用里必须盖住 shell** —— 弹窗要挂在 document.body 且 z-index 高于 shell 布局。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import ConfirmModal from '../ConfirmModal';

describe('ConfirmModal', () => {
  it('visible 为 false 时不渲染弹窗', () => {
    render(<ConfirmModal visible={false} title='删除笔记' onOk={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByText('删除笔记')).toBeNull();
  });

  it('渲染调用方传入的标题与说明', () => {
    render(<ConfirmModal visible title='删除笔记' description='删除后无法恢复' onOk={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('删除笔记')).toBeTruthy();
    expect(screen.getByText('删除后无法恢复')).toBeTruthy();
  });

  it('点击确认按钮触发 onOk', () => {
    const onOk = vi.fn();
    render(<ConfirmModal visible title='删除笔记' okText='删除' onOk={onOk} onCancel={vi.fn()} />);

    screen.getByRole('button', { name: '删除' }).click();

    expect(onOk).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮触发 onCancel', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal visible title='删除笔记' cancelText='取消' onOk={vi.fn()} onCancel={onCancel} />);

    screen.getByRole('button', { name: '取消' }).click();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('danger 时确认按钮是危险态', () => {
    render(<ConfirmModal visible title='删除笔记' okText='删除' danger onOk={vi.fn()} onCancel={vi.fn()} />);

    const ok = screen.getByRole('button', { name: '删除' });

    expect(ok.className).toContain('arco-btn-status-danger');
  });

  it('非 danger 时确认按钮不是危险态', () => {
    render(<ConfirmModal visible title='保存' okText='确定' onOk={vi.fn()} onCancel={vi.fn()} />);

    const ok = screen.getByRole('button', { name: '确定' });

    expect(ok.className).not.toContain('arco-btn-status-danger');
  });

  it('okLoading 时确认按钮进入加载态', () => {
    render(<ConfirmModal visible title='删除笔记' okText='删除' okLoading onOk={vi.fn()} onCancel={vi.fn()} />);

    const ok = screen.getByRole('button', { name: '删除' });

    expect(ok.className).toContain('arco-btn-loading');
  });

  it('hideCancel 时不渲染取消按钮', () => {
    render(<ConfirmModal visible title='删除笔记' cancelText='取消' hideCancel onOk={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '取消' })).toBeNull();
  });

  it('children 渲染在说明文字之后', () => {
    render(
      <ConfirmModal
        visible
        title='删除笔记'
        description='删除后无法恢复'
        okText='删除'
        onOk={vi.fn()}
        onCancel={vi.fn()}
      >
        <span data-testid='confirm-extra'>附加信息</span>
      </ConfirmModal>
    );

    expect(screen.getByTestId('confirm-extra')).toBeTruthy();
  });

  it('挂在 document.body 上 —— 微应用弹窗要脱离 qiankun 容器', () => {
    const { container } = render(<ConfirmModal visible title='删除笔记' onOk={vi.fn()} onCancel={vi.fn()} />);

    // 弹窗不在 React 容器里(Arco 用 portal 挂到 body)
    expect(container.querySelector('.arco-modal')).toBeNull();
    expect(document.body.querySelector('.arco-modal')).toBeTruthy();
  });
});
