/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记本行接入共享 `IconButton` 的回归测试。
 *
 * 迁移前这里是裸写的 `<button>` + `<Down />` 图标,展开/折叠只有一个视觉箭头,
 * 读屏软件念不出它是干什么的。接入 `IconButton` 后,箭头按钮带上了
 * `aria-label`,展开与折叠两种状态各有一个明确的名字。
 *
 * 这里锁三件事:
 *   1. 箭头按钮的无障碍名称随展开状态切换(Expand / Collapse)。
 *   2. 点击能真的切换展开状态(按钮不是摆设)。
 *   3. 折叠时笔记列表不渲染 —— 共享组件接入不该把内容留在折叠区里。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  // notes 通过 `@renderer/utils/formatRelativeTime` 间接依赖 shell 的 i18n 单例,
  // 后者 `i18n.use(initReactI18next).init(...)` 需要这个导出。
  initReactI18next: { type: '3rdParty' as const, init: () => {} },
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

import NotebookItem from '../NotebookItem';
import type { NoteItem, Notebook } from '../../api/types';

const notebook: Notebook = {
  id: 'nb-1',
  name: '工作笔记',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const note: NoteItem = {
  id: 'note-1',
  title: '第一篇笔记',
  notebookId: 'nb-1',
  filePath: '/tmp/note-1.md',
  tags: [],
  star: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderItem = (props: Partial<React.ComponentProps<typeof NotebookItem>> = {}) =>
  render(
    <NotebookItem
      notebook={notebook}
      notes={[note]}
      activeNoteId={null}
      onSelectNote={vi.fn()}
      onRenameNotebook={vi.fn()}
      onDeleteNotebook={vi.fn()}
      onCreateNote={vi.fn()}
      onRenameNote={vi.fn()}
      onDeleteNote={vi.fn()}
      {...props}
    />
  );

describe('NotebookItem 展开箭头接入 IconButton', () => {
  it('默认展开时箭头按钮的无障碍名称是 Collapse', () => {
    renderItem({ defaultExpanded: true });

    expect(screen.getByLabelText('Collapse')).toBeTruthy();
  });

  it('默认折叠时箭头按钮的无障碍名称是 Expand', () => {
    renderItem({ defaultExpanded: false });

    expect(screen.getByLabelText('Expand')).toBeTruthy();
  });

  it('点击箭头按钮后无障碍名称从 Expand 变成 Collapse', () => {
    renderItem({ defaultExpanded: false });

    fireEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByLabelText('Collapse')).toBeTruthy();
  });

  it('折叠时不渲染笔记,展开后渲染笔记', () => {
    renderItem({ defaultExpanded: false });

    expect(screen.queryByText('第一篇笔记')).toBeNull();

    fireEvent.click(screen.getByLabelText('Expand'));

    expect(screen.getByText('第一篇笔记')).toBeTruthy();
  });

  it('新建笔记按钮带无障碍名称', () => {
    renderItem();

    expect(screen.getByLabelText('New Note')).toBeTruthy();
  });
});
