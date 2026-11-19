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

/** 第二个分组:还没有笔记 —— 用来验「按分组筛列表」。 */
const emptyNotebook: Notebook = {
  id: 'nb-2',
  name: '灵感收集',
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
      notebooks={[notebook, emptyNotebook]}
      activeNoteId={null}
      onSelectNote={vi.fn()}
      onCreateNote={vi.fn()}
      onToggleStar={vi.fn()}
      onRenameNote={vi.fn()}
      onDeleteNote={vi.fn()}
      onMoveNoteToNotebook={vi.fn()}
      onCreateNotebook={vi.fn()}
      onRenameNotebook={vi.fn()}
      onDeleteNotebook={vi.fn()}
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

  it('分组不再把笔记嵌套进去 —— 分组区只是单列,列表仍是平铺的', () => {
    renderPanel();

    // 分组区列出了这个分组,但它不把笔记收进自己底下 —— 笔记仍在上面的平铺列表里。
    const groupRow = screen.getByTestId('notes-notebook-nb-1');
    expect(groupRow.textContent).not.toContain('竞品体验观察');
    expect(screen.getByText('工作笔记')).toBeTruthy();
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

  it('收藏过的条目左侧有星星标记,没收藏的没有', () => {
    renderPanel();

    // 第一条是收藏过的(notes 里的 note-today:star = true)
    const star = screen.getByTestId('notes-item-star-note-today');
    expect(star).toBeTruthy();
    // 星星是独立按钮 —— 整行本身就是个 button,里面不能再塞 button
    expect(star.tagName).toBe('BUTTON');
    expect(star.getAttribute('aria-label')).toBe('Remove from favorites');

    // 没收藏的两条没有星星
    expect(screen.queryByTestId('notes-item-star-note-yesterday')).toBeNull();
    expect(screen.queryByTestId('notes-item-star-note-old')).toBeNull();
  });

  it('点星星只切换收藏,不会顺手把笔记选中', () => {
    const onToggleStar = vi.fn();
    const onSelectNote = vi.fn();
    renderPanel({ onToggleStar, onSelectNote });

    fireEvent.click(screen.getByTestId('notes-item-star-note-today'));

    expect(onToggleStar).toHaveBeenCalledWith('note-today');
    expect(onSelectNote).not.toHaveBeenCalled();
    // 也不会顺手把整行的操作菜单弹出来
    expect(screen.queryByText('Move to group')).toBeNull();
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

  it('行尾「⋯」弹出的就是右键菜单', async () => {
    renderPanel();

    fireEvent.click(screen.getAllByLabelText('More actions')[0]);

    expect(await screen.findByText('Move to group')).toBeTruthy();
    // 第一条笔记是收藏过的,所以菜单项是「取消收藏」
    expect(screen.getByText('Remove from favorites')).toBeTruthy();
    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('点笔记标题只是选中,不弹菜单', () => {
    renderPanel();

    fireEvent.click(screen.getByText('竞品体验观察'));

    expect(screen.queryByText('Move to group')).toBeNull();
  });
});

describe('笔记列表下方的分组区', () => {
  it('标题是「笔记分组」,而且能收起来', () => {
    renderPanel();

    const toggle = screen.getByTestId('notes-groups-toggle');
    const collapse = screen.getByTestId('notes-groups-collapse');
    expect(toggle.textContent).toContain('Note Groups');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.getAttribute('aria-hidden')).toBe('false');

    // 收起 = 分组列表藏起来(内容留在 DOM 里做动画,但对读屏 / 键盘不可见)
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(collapse.getAttribute('aria-hidden')).toBe('true');
    // 标题还在
    expect(screen.getByText('Note Groups')).toBeTruthy();

    // 再点一次展开回来
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(collapse.getAttribute('aria-hidden')).toBe('false');
  });

  it('收起的时候点「+」新建分组,会自动展开', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('notes-groups-toggle'));
    expect(screen.getByTestId('notes-groups-collapse').getAttribute('aria-hidden')).toBe('true');

    fireEvent.click(screen.getByTestId('notes-create-notebook'));
    expect(screen.getByTestId('notes-groups-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('notes-groups-collapse').getAttribute('aria-hidden')).toBe('false');
    expect(screen.getByTestId('notes-notebook-name-input')).toBeTruthy();
  });

  it('列出全部分组和每组的笔记数', () => {
    renderPanel();

    expect(screen.getByText('工作笔记')).toBeTruthy();
    expect(screen.getByText('灵感收集')).toBeTruthy();
    // 三条笔记都在「工作笔记」里,「灵感收集」还是空的
    expect(screen.getByTestId('notes-notebook-count-nb-1').textContent).toBe('3');
    expect(screen.getByTestId('notes-notebook-count-nb-2').textContent).toBe('0');
  });

  it('点分组行只留这一组的笔记,再点一次取消筛选', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('notes-notebook-nb-2'));
    expect(screen.queryByText('竞品体验观察')).toBeNull();

    fireEvent.click(screen.getByTestId('notes-notebook-nb-2'));
    expect(screen.getByText('竞品体验观察')).toBeTruthy();
  });

  it('选中的分组行上有「✕」,点它取消筛选', () => {
    renderPanel();

    // 没选中的分组上没有「✕」
    expect(screen.queryByTestId('notes-notebook-clear-nb-1')).toBeNull();

    fireEvent.click(screen.getByTestId('notes-notebook-nb-2'));
    expect(screen.getByTestId('notes-notebook-clear-nb-2')).toBeTruthy();
    expect(screen.queryByText('竞品体验观察')).toBeNull();

    fireEvent.click(screen.getByTestId('notes-notebook-clear-nb-2'));
    expect(screen.queryByTestId('notes-notebook-clear-nb-2')).toBeNull();
    expect(screen.getByText('竞品体验观察')).toBeTruthy();
  });

  it('「✕」紧跟在分组名后面,不在行尾', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('notes-notebook-nb-1'));
    const row = screen.getByTestId('notes-notebook-nb-1').parentElement;
    const children = Array.from(row?.children ?? []);
    const nameIndex = children.indexOf(screen.getByTestId('notes-notebook-nb-1'));
    const clearIndex = children.indexOf(screen.getByTestId('notes-notebook-clear-nb-1'));
    const countIndex = children.indexOf(screen.getByTestId('notes-notebook-count-nb-1'));

    expect(nameIndex).toBeLessThan(clearIndex);
    expect(clearIndex).toBeLessThan(countIndex);
  });

  it('顶部「全部」同时清掉分组筛选', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('notes-notebook-nb-2'));
    expect(screen.queryByText('竞品体验观察')).toBeNull();

    fireEvent.click(screen.getByTestId('notes-filter-all'));
    expect(screen.queryByTestId('notes-notebook-clear-nb-2')).toBeNull();
    expect(screen.getByText('竞品体验观察')).toBeTruthy();
  });

  it('「+」新建分组:行内输入,回车提交', () => {
    const onCreateNotebook = vi.fn();
    renderPanel({ onCreateNotebook });

    fireEvent.click(screen.getByTestId('notes-create-notebook'));
    const input = screen.getByTestId('notes-notebook-name-input');
    fireEvent.change(input, { target: { value: '工作笔记' } });
    // Arco 的 Input 认的是 keyCode(不是 key)—— 见 useComposition 的 keyDownHandler
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 });

    expect(onCreateNotebook).toHaveBeenCalledWith('工作笔记', null);
  });

  it('「⋯」里能重命名分组', () => {
    const onRenameNotebook = vi.fn();
    renderPanel({ onRenameNotebook });

    fireEvent.click(screen.getByTestId('notes-notebook-menu-nb-1'));
    fireEvent.click(screen.getByText('Rename'));
    const input = screen.getByTestId('notes-notebook-rename-input');
    fireEvent.change(input, { target: { value: '新名字' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 });

    expect(onRenameNotebook).toHaveBeenCalledWith('nb-1', '新名字');
  });

  it('「⋯」里能删分组,删之前要二次确认', () => {
    const onDeleteNotebook = vi.fn();
    renderPanel({ onDeleteNotebook });

    fireEvent.click(screen.getByTestId('notes-notebook-menu-nb-1'));
    fireEvent.click(screen.getByText('Delete group'));

    // 确认弹窗出现,还没删
    expect(onDeleteNotebook).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteNotebook).toHaveBeenCalledWith('nb-1');
  });

  it('一个分组都没有时给个空提示', () => {
    renderPanel({ notebooks: [] });

    expect(screen.getByText('No groups yet')).toBeTruthy();
  });
});
