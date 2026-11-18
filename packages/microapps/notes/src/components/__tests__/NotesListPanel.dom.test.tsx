/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记列表面板的回归测试。
 *
 * 面板按设计稿改成了**扁平列表**:没有笔记本树,条目按时间分组,
 * 搜索在客户端过滤,「收藏」筛选走 `note.star`。
 *
 * 这里锁四件事:
 *   1. 笔记平铺渲染,分组标题(今天 / 过去 7 天 / 更早)按时间出现。
 *   2. 搜索框在客户端过滤标题与摘要。
 *   3. 「收藏」筛选只留 `star` 为真的条目。
 *   4. 底部状态行给出笔记总数,新建按钮把事件抛给上层。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty' as const, init: () => {} },
  useTranslation: () => ({
    i18n: { language: 'zh-CN' },
    t: (k: string, opts?: Record<string, unknown>) => {
      const fallback = typeof opts?.defaultValue === 'string' ? opts.defaultValue : k;
      return fallback.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(opts?.[key] ?? ''));
    },
  }),
}));

import NotesListPanel from '../NotesListPanel';
import type { NoteItem, Notebook } from '../../api/types';

const DAY = 24 * 60 * 60 * 1000;

/** 造一条「距今 n 天、hour 点」的笔记。 */
const at = (daysAgo: number, hour: number): string => {
  const date = new Date(Date.now() - daysAgo * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const notebook: Notebook = {
  id: 'nb-1',
  name: '工作笔记',
  createdAt: at(30, 9),
  updatedAt: at(30, 9),
};

const notes: NoteItem[] = [
  {
    id: 'note-today',
    title: '知识库与笔记协同设计',
    notebookId: 'nb-1',
    filePath: '/tmp/note-today.md',
    summary: '让资料沉淀与内容创作形成闭环，减少信息在不同工具间的流转。',
    tags: ['产品设计'],
    star: true,
    createdAt: at(0, 9),
    updatedAt: at(0, 10),
  },
  {
    id: 'note-yesterday',
    title: '产品设计周会纪要',
    notebookId: 'nb-1',
    filePath: '/tmp/note-yesterday.md',
    summary: '明确本周交付范围，整理体验问题与后续行动项。',
    tags: ['会议记录'],
    star: false,
    createdAt: at(1, 9),
    updatedAt: at(1, 9),
  },
  {
    id: 'note-old',
    title: '竞品体验观察',
    notebookId: 'nb-1',
    filePath: '/tmp/note-old.md',
    summary: '从记录到整理，减少重复操作。',
    tags: [],
    star: false,
    createdAt: at(20, 9),
    updatedAt: at(20, 9),
  },
];

const renderPanel = (props: Partial<React.ComponentProps<typeof NotesListPanel>> = {}) =>
  render(
    <NotesListPanel
      notes={notes}
      notebooks={[notebook]}
      activeNoteId={null}
      onSelectNote={vi.fn()}
      onCreateNote={vi.fn()}
      onToggleStar={vi.fn()}
      onRenameNote={vi.fn()}
      onDeleteNote={vi.fn()}
      {...props}
    />
  );

describe('笔记列表面板', () => {
  it('笔记平铺渲染,按时间分组', () => {
    renderPanel();

    expect(screen.getByText('知识库与笔记协同设计')).toBeTruthy();
    expect(screen.getByText('产品设计周会纪要')).toBeTruthy();
    expect(screen.getByText('竞品体验观察')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Past 7 days')).toBeTruthy();
    expect(screen.getByText('Older')).toBeTruthy();
  });

  it('不再渲染笔记本树 —— 笔记本名不会单独出现在列表里', () => {
    renderPanel();

    // 笔记本名只会作为条目的「分类」出现,不会有一个独立的笔记本分组。
    expect(screen.queryAllByText(/工作笔记/)).toHaveLength(1);
  });

  it('搜索框在客户端过滤标题与摘要', () => {
    renderPanel();

    fireEvent.change(screen.getByPlaceholderText('Search notes by title or content'), {
      target: { value: '周会' },
    });

    expect(screen.queryByText('知识库与笔记协同设计')).toBeNull();
    expect(screen.getByText('产品设计周会纪要')).toBeTruthy();
  });

  it('「收藏」筛选只留收藏过的笔记', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('notes-filter-favorites'));

    expect(screen.getByText('知识库与笔记协同设计')).toBeTruthy();
    expect(screen.queryByText('产品设计周会纪要')).toBeNull();
  });

  it('底部状态行给出笔记总数', () => {
    renderPanel();

    expect(screen.getByText('3 notes · Synced')).toBeTruthy();
  });

  it('点击条目把笔记 id 抛给上层', () => {
    const onSelectNote = vi.fn();
    renderPanel({ onSelectNote });

    fireEvent.click(screen.getByText('竞品体验观察'));

    expect(onSelectNote).toHaveBeenCalledWith('note-old');
  });

  it('「+ 新建」按钮把新建事件抛给上层', () => {
    const onCreateNote = vi.fn();
    renderPanel({ onCreateNote });

    fireEvent.click(screen.getByTestId('notes-create'));

    expect(onCreateNote).toHaveBeenCalled();
  });
});
