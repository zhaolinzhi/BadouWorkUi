/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 知识库网格接入共享 `AsyncBoundary` / `EmptyState` 的回归测试。
 *
 * 网格要区分两种「空」:
 *   1. 真的没有知识库 —— 给「新建知识库」的引导;
 *   2. 有知识库但被搜索过滤光了 —— 给「清除搜索」的引导。
 * 两者混为一谈会让用户以为资料丢了。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

// 卡片与本组断言无关,换掉以免把 MoreMenu / Avatar 的依赖一起拉进来。
vi.mock('../KnowledgeBaseCard', () => ({
  default: ({ item }: { item: { id: string; name: string } }) => (
    <div data-testid={`kb-card-${item.id}`}>{item.name}</div>
  ),
}));

const { default: KnowledgeBaseGrid } = await import('../KnowledgeBaseGrid');
import type { KnowledgeBaseItem } from '../../../types';

const item: KnowledgeBaseItem = {
  id: 'kb-1',
  name: '我的知识库',
  isShared: false,
};

const baseProps = {
  onOpen: vi.fn(),
  onStartChat: vi.fn(),
  onCreate: vi.fn(),
  onClearSearch: vi.fn(),
};

describe('KnowledgeBaseGrid 接入 AsyncBoundary', () => {
  it('加载中渲染 loading 分支,不渲染网格', () => {
    render(<KnowledgeBaseGrid scope='personal' items={[item]} total={1} loading {...baseProps} />);

    expect(screen.getByTestId('async-boundary-loading')).toBeTruthy();
    expect(screen.queryByTestId('kb-grid-personal')).toBeNull();
  });

  it('出错时渲染 error 分支并给出重试按钮', () => {
    const onRetry = vi.fn();
    render(<KnowledgeBaseGrid scope='personal' items={[]} total={0} error='boom' onRetry={onRetry} {...baseProps} />);

    expect(screen.getByTestId('async-boundary-error')).toBeTruthy();
    fireEvent.click(screen.getByTestId('async-boundary-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('个人库为空时给出「新建知识库」的引导', () => {
    render(<KnowledgeBaseGrid scope='personal' items={[]} total={0} {...baseProps} />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByTestId('empty-state-title').textContent).toBe('还没有个人知识库');
  });

  it('共享库为空时给出共享库的引导', () => {
    render(<KnowledgeBaseGrid scope='shared' items={[]} total={0} {...baseProps} />);

    expect(screen.getByTestId('empty-state-title').textContent).toBe('暂无可用的共享知识库');
  });

  it('有知识库但搜索无结果时给「清除搜索」,并回调 onClearSearch', () => {
    const onClearSearch = vi.fn();
    render(<KnowledgeBaseGrid scope='personal' items={[]} total={3} {...baseProps} onClearSearch={onClearSearch} />);

    expect(screen.getByTestId('empty-state-title').textContent).toBe('暂无搜索结果');
    fireEvent.click(screen.getByTestId('btn-kb-clear-search'));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('有数据时渲染网格,不渲染空态', () => {
    render(<KnowledgeBaseGrid scope='personal' items={[item]} total={1} {...baseProps} />);

    expect(screen.getByTestId('kb-grid-personal')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });
});
