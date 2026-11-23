/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 新建文本弹窗：字段渲染、必填校验、提交、错误展示。
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const { default: KnowledgeBaseTextModal } = await import('../KnowledgeBaseTextModal');

describe('KnowledgeBaseTextModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染名称、正文与提交按钮', () => {
    render(<KnowledgeBaseTextModal visible onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('kb-text-name')).toBeTruthy();
    expect(screen.getByTestId('kb-text-body')).toBeTruthy();
    expect(screen.getByTestId('kb-text-submit')).toBeTruthy();
    expect(screen.getByTestId('kb-text-cancel')).toBeTruthy();
  });

  it('名称为空时提示且不提交', () => {
    const onSubmit = vi.fn();
    render(<KnowledgeBaseTextModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('kb-text-body'), { target: { value: '正文' } });
    fireEvent.click(screen.getByTestId('kb-text-submit'));

    expect(screen.getByTestId('kb-text-name-error').textContent).toBe('请输入文本名称');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('正文为空时提示且不提交', () => {
    const onSubmit = vi.fn();
    render(<KnowledgeBaseTextModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('kb-text-name'), { target: { value: '测试记录' } });
    fireEvent.click(screen.getByTestId('kb-text-submit'));

    expect(screen.getByTestId('kb-text-body-error').textContent).toBe('请输入正文内容');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('填完名称与正文后提交（值去掉首尾空白）', () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<KnowledgeBaseTextModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('kb-text-name'), { target: { value: '  测试记录  ' } });
    fireEvent.change(screen.getByTestId('kb-text-body'), { target: { value: '  正文内容  ' } });
    fireEvent.click(screen.getByTestId('kb-text-submit'));

    expect(onSubmit).toHaveBeenCalledWith({ name: '测试记录', text: '正文内容' });
  });

  it('展示上传失败的错误', () => {
    render(<KnowledgeBaseTextModal visible onCancel={vi.fn()} onSubmit={vi.fn()} error='上传失败，请稍后重试' />);

    expect(screen.getByTestId('kb-text-error').textContent).toBe('上传失败，请稍后重试');
  });
});
