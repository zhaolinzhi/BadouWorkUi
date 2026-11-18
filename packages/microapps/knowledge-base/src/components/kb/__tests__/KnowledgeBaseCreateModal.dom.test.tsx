/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 新建知识库弹窗：字段渲染、共享对象显隐、必填校验、提交、提交中、错误展示。
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const { default: KnowledgeBaseCreateModal } = await import('../KnowledgeBaseCreateModal');

/**
 * Arco 的 Radio 根元素是 `<label class="arco-radio">`，`data-testid` 落在它身上，
 * 真正的 `<input type="radio">` 是它的子节点。jsdom 里点 label 不一定会转发到
 * input，所以测试直接点 input —— 行为确定。
 */
const clickRadio = (testId: string) => {
  const label = screen.getByTestId(testId);
  const input = label.querySelector('input');
  if (!input) throw new Error(`no radio input inside ${testId}`);
  fireEvent.click(input);
};

describe('KnowledgeBaseCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染四个字段与提交按钮', () => {
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('kb-create-name')).toBeTruthy();
    expect(screen.getByTestId('kb-create-description')).toBeTruthy();
    expect(screen.getByTestId('kb-create-scope-personal')).toBeTruthy();
    expect(screen.getByTestId('kb-create-scope-shared')).toBeTruthy();
    expect(screen.getByTestId('kb-create-submit')).toBeTruthy();
    expect(screen.getByTestId('kb-create-cancel')).toBeTruthy();
  });

  it('默认不渲染共享对象，切到共享后出现', () => {
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByTestId('kb-create-target')).toBeNull();

    clickRadio('kb-create-scope-shared');

    expect(screen.getByTestId('kb-create-target')).toBeTruthy();
  });

  it('名称为空时提示且不提交', () => {
    const onSubmit = vi.fn();
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('kb-create-submit'));

    expect(screen.getByTestId('kb-create-name-error').textContent).toBe('知识库名称不能为空');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('选共享但不选共享对象时提示且不提交', () => {
    const onSubmit = vi.fn();
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('kb-create-name'), { target: { value: '测试3' } });
    clickRadio('kb-create-scope-shared');
    fireEvent.click(screen.getByTestId('kb-create-submit'));

    expect(screen.getByTestId('kb-create-target-error').textContent).toBe('请选择共享对象');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('填好名称后提交，参数含名称、描述与 scope', () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('kb-create-name'), { target: { value: '测试3' } });
    fireEvent.change(screen.getByTestId('kb-create-description'), { target: { value: '121212' } });
    fireEvent.click(screen.getByTestId('kb-create-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      name: '测试3',
      description: '121212',
      scope: 'personal',
      target: undefined,
    });
  });

  it('提交中时提交按钮 loading', () => {
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={vi.fn()} submitting />);

    expect(screen.getByTestId('kb-create-submit').className).toContain('arco-btn-loading');
  });

  it('错误信息展示在弹窗内', () => {
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={vi.fn()} error='HTTP 500' />);

    expect(screen.getByTestId('kb-create-error').textContent).toBe('HTTP 500');
  });

  it('点取消调用 onCancel', () => {
    const onCancel = vi.fn();
    render(<KnowledgeBaseCreateModal visible onCancel={onCancel} onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByTestId('kb-create-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('共享对象列表为空时给出说明', () => {
    render(<KnowledgeBaseCreateModal visible onCancel={vi.fn()} onSubmit={vi.fn()} />);

    clickRadio('kb-create-scope-shared');

    expect(screen.getByTestId('kb-create-target-empty').textContent).toBe('暂无可选共享对象');
  });
});
