/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列面板：进度展示、状态判定、清空已完成。
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const { default: KnowledgeBaseQueuePanel } = await import('../KnowledgeBaseQueuePanel');

const doc = (id: string, name: string, progress?: number, records = 0) => ({
  id,
  name,
  type: 'MD',
  records,
  updatedAt: '2026-11-19 09:46:00.0',
  createdAt: '2026-11-19',
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

  it('按 progress 区分处理中与已完成，并显示百分比', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d1', 'a.md', 40), doc('d2', 'b.pdf', 100, 12)]}
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

  it('progress 缺失时按已完成处理', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d1', 'a.md', undefined, 5)]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-summary').textContent).toBe('处理中 0 个文件 · 已完成 1 个');
    expect(screen.getByTestId('kb-queue-file-d1').textContent).toContain('已完成 · 5 条数据');
  });

  it('onlyProcessing 时只留处理中的条目', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        onlyProcessing
        documents={[doc('d1', 'a.md', 40), doc('d2', 'b.pdf', 100, 12)]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-file-d1')).toBeTruthy();
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
      <KnowledgeBaseQueuePanel visible documents={[doc('d1', 'a.md', 40)]} onClose={vi.fn()} onClearDone={vi.fn()} />
    );

    expect((screen.getByTestId('kb-queue-clear-done') as HTMLButtonElement).disabled).toBe(true);
  });

  it('「清空已完成」在有已完成项时可用并回调', () => {
    const onClearDone = vi.fn();
    render(
      <KnowledgeBaseQueuePanel
        visible
        documents={[doc('d2', 'b.pdf', 100, 12)]}
        onClose={vi.fn()}
        onClearDone={onClearDone}
      />
    );

    const button = screen.getByTestId('kb-queue-clear-done') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    expect(onClearDone).toHaveBeenCalledTimes(1);
  });
});
