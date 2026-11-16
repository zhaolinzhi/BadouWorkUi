/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 笔记右键菜单的行为测试。
 *
 * 锁四件事:
 *   1. 右键笔记条目弹出菜单,菜单项与设计稿一致。
 *   2. 「移动到笔记本」二级菜单列的是**具体的分组名**(笔记本名),当前分组打勾。
 *   3. 菜单项回调正确:删除 / 移动 / 新建笔记本 / 收藏 / 重命名。
 *   4. 接口未就绪的项(添加到知识库 / 创建副本 / 独立窗口打开)是禁用的。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty' as const, init: () => {} },
  useTranslation: () => ({
    i18n: { language: 'zh-CN' },
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

import NoteContextMenu from '../NoteContextMenu';
import type { NoteItem, Notebook } from '../../api/types';

const now = new Date().toISOString();

const note: NoteItem = {
  id: 'note-1',
  title: '知识库与笔记协同设计',
  notebookId: 'nb-1',
  filePath: '/tmp/note-1.md',
  summary: '让资料沉淀与内容创作形成闭环。',
  tags: [],
  star: false,
  createdAt: now,
  updatedAt: now,
};

const notebooks: Notebook[] = [
  { id: 'nb-1', name: '工作笔记', createdAt: now, updatedAt: now },
  { id: 'nb-2', name: 'AI 项目组', createdAt: now, updatedAt: now },
];

type Props = React.ComponentProps<typeof NoteContextMenu>;

const renderMenu = (props: Partial<Props> = {}) =>
  render(
    <NoteContextMenu
      note={note}
      notebooks={notebooks}
      onDelete={vi.fn()}
      onMoveToNotebook={vi.fn()}
      onCreateNotebook={vi.fn()}
      onToggleStar={vi.fn()}
      onRename={vi.fn()}
      {...props}
    >
      <div data-testid='note-item'>笔记条目</div>
    </NoteContextMenu>
  );

/** 右键笔记条目,等菜单弹出来。 */
const openContextMenu = async () => {
  fireEvent.contextMenu(screen.getByTestId('note-item'));
  return screen.findByText('Move to group');
};

/** 悬停某个二级菜单的标题,等它展开。 */
const hoverSubmenu = async (title: string) => {
  await openContextMenu();
  fireEvent.mouseOver(screen.getByText(title));
};

/** 悬停「移动到笔记本」,等二级菜单展开。 */
const openNotebookSubmenu = async () => {
  await hoverSubmenu('Move to group');
  return screen.findByText('工作笔记');
};

/** 菜单项是否禁用 —— Arco 给禁用项加 `arco-dropdown-menu-disabled`。 */
const isDisabled = (label: string): boolean =>
  screen.getByText(label).closest('.arco-dropdown-menu-item')?.className.includes('arco-dropdown-menu-disabled') ??
  false;

describe('笔记右键菜单', () => {
  it('右键笔记条目弹出菜单,菜单项与设计稿一致', async () => {
    renderMenu();

    await openContextMenu();

    expect(screen.getByText('Add to knowledge base')).toBeTruthy();
    expect(screen.getByText('Move to group')).toBeTruthy();
    expect(screen.getByText('Favorite')).toBeTruthy();
    expect(screen.getByText('Rename')).toBeTruthy();
    expect(screen.getByText('Create a copy')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Open in new window')).toBeTruthy();
  });

  it('点「收藏」把收藏意图抛给上层', async () => {
    const onToggleStar = vi.fn();
    renderMenu({ onToggleStar });

    await openContextMenu();
    fireEvent.click(screen.getByText('Favorite'));

    expect(onToggleStar).toHaveBeenCalled();
  });

  it('点「重命名」把重命名意图抛给上层', async () => {
    const onRename = vi.fn();
    renderMenu({ onRename });

    await openContextMenu();
    fireEvent.click(screen.getByText('Rename'));

    expect(onRename).toHaveBeenCalled();
  });

  it('「移动到笔记本」二级菜单列的是具体的分组名,当前分组打勾', async () => {
    renderMenu();

    await openNotebookSubmenu();

    expect(screen.getByText('工作笔记')).toBeTruthy();
    expect(screen.getByText('AI 项目组')).toBeTruthy();
    expect(screen.getByText('New group')).toBeTruthy();
    // 当前所属的分组带一个勾
    const current = screen.getByText('工作笔记').closest('.arco-dropdown-menu-item');
    expect(current?.querySelector('.i-icon-check')).toBeTruthy();
    // 别的分组没有勾
    const other = screen.getByText('AI 项目组').closest('.arco-dropdown-menu-item');
    expect(other?.querySelector('.i-icon-check')).toBeNull();
  });

  it('点「删除」把删除意图抛给上层', async () => {
    const onDelete = vi.fn();
    renderMenu({ onDelete });

    await openContextMenu();
    fireEvent.click(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalled();
  });

  it('点分组名把笔记移动到该分组', async () => {
    const onMoveToNotebook = vi.fn();
    renderMenu({ onMoveToNotebook });

    await openNotebookSubmenu();
    fireEvent.click(screen.getByText('AI 项目组'));

    expect(onMoveToNotebook).toHaveBeenCalledWith('nb-2');
  });

  it('点当前所在的分组不做任何移动', async () => {
    const onMoveToNotebook = vi.fn();
    renderMenu({ onMoveToNotebook });

    await openNotebookSubmenu();
    fireEvent.click(screen.getByText('工作笔记'));

    expect(onMoveToNotebook).not.toHaveBeenCalled();
  });

  it('点「新建笔记本」把新建意图抛给上层', async () => {
    const onCreateNotebook = vi.fn();
    renderMenu({ onCreateNotebook });

    await openNotebookSubmenu();
    fireEvent.click(screen.getByText('New group'));

    expect(onCreateNotebook).toHaveBeenCalled();
  });

  it('接口未就绪的菜单项是禁用的', async () => {
    renderMenu();

    await openContextMenu();

    expect(isDisabled('Create a copy')).toBe(true);
    expect(isDisabled('Open in new window')).toBe(true);
    expect(isDisabled('Delete')).toBe(false);
    // 收藏 / 重命名是已有的功能,不该被禁用
    expect(isDisabled('Favorite')).toBe(false);
    expect(isDisabled('Rename')).toBe(false);
  });

  it('「添加到知识库」暂时没有可选项', async () => {
    renderMenu();

    await hoverSubmenu('Add to knowledge base');

    const empty = await screen.findByText('No knowledge base available');
    expect(empty.closest('.arco-dropdown-menu-item')?.className).toContain('arco-dropdown-menu-disabled');
  });
});
