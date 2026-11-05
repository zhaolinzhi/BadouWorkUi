/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * KB 两个列表接入共享 `AsyncBoundary` / `EmptyState` 的回归测试。
 *
 * 迁移前个人库与共享库各写一份三态渲染:loading 时一段 `<div>`、出错时另一段
 * `<div>`、空列表时又一段 —— 两份几乎逐字相同,连 class 串都一样。接入共享层
 * 之后,三个状态各有稳定的 testid,这里锁住:
 *
 *   1. loading / error / empty 三态各自渲染对应分支(互斥,不叠层)。
 *   2. 空态是共享层的 `EmptyState`,带图标与标题。
 *   3. 出错时「重试」按钮会真的回调。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

// 行组件与本组断言无关,换掉以免把 MoreMenu / Avatar 的依赖一起拉进来。
vi.mock('../KnowledgeBaseRow', () => ({
  default: ({ item }: { item: { id: string; name: string } }) => (
    <div data-testid={`kb-row-${item.id}`}>{item.name}</div>
  ),
}));

import PersonalKnowledgeBaseList from '../PersonalKnowledgeBaseList';
import SharedKnowledgeBaseGrid from '../SharedKnowledgeBaseGrid';
import type { KnowledgeBaseItem } from '../../types';

const item: KnowledgeBaseItem = {
  id: 'kb-1',
  name: '我的知识库',
  isShared: false,
};

describe('PersonalKnowledgeBaseList 接入 AsyncBoundary', () => {
  it('加载中渲染 loading 分支,不渲染列表', () => {
    render(
      <PersonalKnowledgeBaseList
        items={[item]}
        loading
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onOpenEdit={vi.fn()}
        onCreate={vi.fn()}
        onStartChat={vi.fn()}
      />
    );

    expect(screen.getByTestId('async-boundary-loading')).toBeTruthy();
    expect(screen.queryByTestId('personal-kb-list')).toBeNull();
  });

  it('出错时渲染 error 分支并给出重试按钮', () => {
    render(
      <PersonalKnowledgeBaseList
        items={[]}
        error='boom'
        onRetry={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onOpenEdit={vi.fn()}
        onCreate={vi.fn()}
        onStartChat={vi.fn()}
      />
    );

    expect(screen.getByTestId('async-boundary-error')).toBeTruthy();
    expect(screen.getByTestId('async-boundary-retry')).toBeTruthy();
  });

  it('点击重试按钮会调用 onRetry', () => {
    const onRetry = vi.fn();
    render(
      <PersonalKnowledgeBaseList
        items={[]}
        error='boom'
        onRetry={onRetry}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onOpenEdit={vi.fn()}
        onCreate={vi.fn()}
        onStartChat={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('async-boundary-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('列表为空时渲染共享层的 EmptyState', () => {
    render(
      <PersonalKnowledgeBaseList
        items={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onOpenEdit={vi.fn()}
        onCreate={vi.fn()}
        onStartChat={vi.fn()}
      />
    );

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByTestId('empty-state-title').textContent).toBe('No personal knowledge base yet');
  });

  it('空态里的新建按钮会调用 onCreate', () => {
    const onCreate = vi.fn();
    render(
      <PersonalKnowledgeBaseList
        items={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onOpenEdit={vi.fn()}
        onCreate={onCreate}
        onStartChat={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('btn-personal-kb-create'));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('有数据时渲染列表,不渲染空态', () => {
    render(
      <PersonalKnowledgeBaseList
        items={[item]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpen={vi.fn()}
        onOpenEdit={vi.fn()}
        onCreate={vi.fn()}
        onStartChat={vi.fn()}
      />
    );

    expect(screen.getByTestId('personal-kb-list')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });
});

describe('SharedKnowledgeBaseGrid 接入 AsyncBoundary', () => {
  it('列表为空时渲染共享层的 EmptyState', () => {
    render(<SharedKnowledgeBaseGrid items={[]} onOpenView={vi.fn()} onStartChat={vi.fn()} />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByTestId('empty-state-title').textContent).toBe('No shared knowledge bases available');
  });

  it('加载中渲染 loading 分支', () => {
    render(<SharedKnowledgeBaseGrid items={[]} loading onOpenView={vi.fn()} onStartChat={vi.fn()} />);

    expect(screen.getByTestId('async-boundary-loading')).toBeTruthy();
  });

  it('有数据时渲染列表,不渲染空态', () => {
    render(<SharedKnowledgeBaseGrid items={[item]} onOpenView={vi.fn()} onStartChat={vi.fn()} />);

    expect(screen.getByTestId('shared-kb-list')).toBeTruthy();
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });
});
