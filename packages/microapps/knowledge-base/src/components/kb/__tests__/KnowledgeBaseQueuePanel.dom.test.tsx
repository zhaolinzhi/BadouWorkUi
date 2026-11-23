/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列面板：解析状态（已解析 / 处理中 / 解析失败）、进度展示、清空已完成。
 */

import type { KnowledgeBaseSplitStatus } from '../../../types';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const { default: KnowledgeBaseQueuePanel } = await import('../KnowledgeBaseQueuePanel');

const doc = (id: string, name: string, splitStatus: KnowledgeBaseSplitStatus, progress?: number, records = 0) => ({
  id,
  name,
  type: 'MD',
  records,
  updatedAt: '2026-11-19 09:46:00.0',
  createdAt: '2026-11-19',
  splitStatus,
  ...(progress === undefined ? {} : { progress }),
});

describe('KnowledgeBaseQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('不渲染时什么都不显示', () => {
    render(<KnowledgeBaseQueuePanel visible={false} documents={[]} onClose={vi.fn()} onClearDone={vi.fn()} />);

    expect(screen.queryByTestId('kb-queue')).toBeNull();
  });

  it('按解析状态区分处理中与已完成，并显示百分比', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d1', 'a.md', 'processing', 40), doc('d2', 'b.pdf', 'done', undefined, 12)]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-summary').textContent).toBe('处理中 1 个文件 · 已完成 1 个');

    const processing = screen.getByTestId('kb-queue-file-d1');
    expect(processing.textContent).toContain('a.md');
    expect(processing.textContent).toContain('处理中');
    expect(processing.textContent).toContain('40%');

    const done = screen.getByTestId('kb-queue-file-d2');
    expect(done.textContent).toContain('已完成 · 12 条数据');
    expect(done.textContent).toContain('100%');
  });

  it('解析失败的文件显示失败态，不显示百分比', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d1', 'x.xlsx', 'failed'), doc('d2', 'b.pdf', 'done', undefined, 12)]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    // 汇总行带上失败数
    expect(screen.getByTestId('kb-queue-summary').textContent).toBe('处理中 0 个文件 · 已完成 1 个 · 失败 1 个');

    const failed = screen.getByTestId('kb-queue-file-d1');
    expect(failed.textContent).toContain('解析失败');
    expect(failed.textContent).not.toContain('%');
  });

  it('进度字段还没给时，处理中的文件按 0% 显示', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d1', 'a.md', 'processing')]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-summary').textContent).toBe('处理中 1 个文件 · 已完成 0 个');
    expect(screen.getByTestId('kb-queue-file-d1').textContent).toContain('0%');
  });

  it('onlyProcessing 时只留处理中与解析失败的条目', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        onlyProcessing
        documents={[
          doc('d1', 'a.md', 'processing', 40),
          doc('d2', 'b.pdf', 'done', undefined, 12),
          doc('d3', 'c.xlsx', 'failed'),
        ]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-file-d1')).toBeTruthy();
    expect(screen.getByTestId('kb-queue-file-d3')).toBeTruthy();
    expect(screen.queryByTestId('kb-queue-file-d2')).toBeNull();
  });

  it('点关闭按钮回调 onClose', () => {
    const onClose = vi.fn();
    render(<KnowledgeBaseQueuePanel visible documents={[]} onClose={onClose} onClearDone={vi.fn()} />);

    fireEvent.click(screen.getByTestId('kb-queue-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('「清空已完成」在没有已完成项时禁用', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d1', 'a.md', 'processing', 40)]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect((screen.getByTestId('kb-queue-clear-done') as HTMLButtonElement).disabled).toBe(true);
  });

  it('「清空已完成」在有已完成项时可用并回调', () => {
    const onClearDone = vi.fn();
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d2', 'b.pdf', 'done', undefined, 12)]}
        onClose={vi.fn()}
        onClearDone={onClearDone}
      />
    );

    const button = screen.getByTestId('kb-queue-clear-done') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    expect(onClearDone).toHaveBeenCalledTimes(1);
  });

  it('首次加载中显示加载态', () => {
    render(<KnowledgeBaseQueuePanel visible documents={[]} loading onClose={vi.fn()} onClearDone={vi.fn()} />);

    expect(screen.getByTestId('kb-queue-loading')).toBeTruthy();
    expect(screen.queryByTestId('kb-queue-empty')).toBeNull();
  });

  it('加载失败且没有内容时显示错误态与重试按钮', () => {
    const onRetry = vi.fn();
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[]}
        error='HTTP 500'
        onRetry={onRetry}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-error')).toBeTruthy();
    // 错误态由共享的 AsyncBoundary 渲染 —— 重试按钮是它那颗。
    expect(screen.getByTestId('async-boundary-error')).toBeTruthy();
    fireEvent.click(screen.getByTestId('async-boundary-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('没有文件时显示空态', () => {
    render(<KnowledgeBaseQueuePanel visible documents={[]} onClose={vi.fn()} onClearDone={vi.fn()} />);

    expect(screen.getByTestId('kb-queue-empty').textContent).toContain('暂无文件处理任务');
  });

  it('「清空已完成」之后列表空了显示空态', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        onlyProcessing
        documents={[doc('d2', 'b.pdf', 'done', undefined, 12)]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-empty')).toBeTruthy();
    expect(screen.queryByTestId('kb-queue-file-d2')).toBeNull();
  });
});
