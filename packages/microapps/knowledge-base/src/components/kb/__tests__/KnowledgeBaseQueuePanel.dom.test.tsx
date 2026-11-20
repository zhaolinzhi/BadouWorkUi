/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文件处理队列面板：渲染、状态文案、清空已完成。
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

describe('KnowledgeBaseQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('不渲染时什么都不显示', () => {
    render(<KnowledgeBaseQueuePanel visible={false} tasks={[]} onClose={vi.fn()} onClearDone={vi.fn()} />);

    expect(screen.queryByTestId('kb-queue')).toBeNull();
  });

  it('渲染汇总与每个文件的状态', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        tasks={[
          { id: 't1', name: 'a.md', status: 'processing' },
          { id: 't2', name: 'b.pdf', status: 'done', records: 12 },
        ]}
        onClose={vi.fn()}
        onClearDone={vi.fn()}
      />
    );

    expect(screen.getByTestId('kb-queue-summary').textContent).toBe('处理中 1 个文件 · 已完成 1 个');
    expect(screen.getByTestId('kb-queue-file-t1').textContent).toContain('a.md');
    expect(screen.getByTestId('kb-queue-file-t1').textContent).toContain('处理中');
    expect(screen.getByTestId('kb-queue-file-t2').textContent).toContain('已完成 · 12 条数据');
  });

  it('点关闭按钮回调 onClose', () => {
    const onClose = vi.fn();
    render(<KnowledgeBaseQueuePanel visible tasks={[]} onClose={onClose} onClearDone={vi.fn()} />);

    fireEvent.click(screen.getByTestId('kb-queue-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('「清空已完成」在没有已完成项时禁用', () => {
    render(
      <KnowledgeBaseQueuePanel
        visible
        tasks={[{ id: 't1', name: 'a.md', status: 'processing' }]}
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
        tasks={[{ id: 't2', name: 'b.pdf', status: 'done', records: 3 }]}
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
