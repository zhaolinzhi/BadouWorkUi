/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `MoreMenu` 的行为测试。
 *
 * notes 的 `NoteItem` / `NotebookItem` 与 knowledge-base 的 `KnowledgeBaseRow`
 * 各写了一份「⋮ → Arco Dropdown → Menu」的组合,连触发按钮的 class 都一样。
 *
 * 关键约束:
 *   - **弹层挂到 document.body**。qiankun 微应用的容器有 overflow 与层叠上下文,
 *     弹层留在容器里会被裁掉。
 *   - **触发按钮是 Arco Button**,不是裸 `<button>`。
 *   - **菜单项用 key 回调**,不让调用方在 onClick 里比对文案。
 *   - **danger 菜单项用危险色**。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import MoreMenu from '../MoreMenu';

const openMenu = async (label = '更多') => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(screen.getByText('编辑')).toBeTruthy());
};

describe('MoreMenu', () => {
  it('渲染一个带可访问名称的触发按钮', () => {
    render(<MoreMenu items={[]} label='更多' onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: '更多' })).toBeTruthy();
  });

  it('触发按钮不是裸 button —— 底层是 Arco Button', () => {
    const { container } = render(<MoreMenu items={[]} label='更多' onSelect={vi.fn()} />);

    expect(container.querySelector('button.arco-btn')).toBeTruthy();
  });

  it('默认图标是 more-one', () => {
    const { container } = render(<MoreMenu items={[]} label='更多' onSelect={vi.fn()} />);

    expect(container.querySelector('.i-icon-more-one')).toBeTruthy();
  });

  it('点击触发按钮后渲染菜单项', async () => {
    render(
      <MoreMenu
        items={[
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除' },
        ]}
        label='更多'
        onSelect={vi.fn()}
      />
    );

    await openMenu();

    expect(screen.getByText('删除')).toBeTruthy();
  });

  it('点击菜单项时用 key 回调', async () => {
    const onSelect = vi.fn();
    render(
      <MoreMenu
        items={[
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除' },
        ]}
        label='更多'
        onSelect={onSelect}
      />
    );

    await openMenu();
    fireEvent.click(screen.getByText('删除'));

    expect(onSelect).toHaveBeenCalledWith('delete');
  });

  it('danger 菜单项用危险色', async () => {
    render(
      <MoreMenu
        items={[
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除', danger: true },
        ]}
        label='更多'
        onSelect={vi.fn()}
      />
    );

    await openMenu();

    expect(screen.getByText('删除').className).toContain('text-[rgb(var(--danger-6))]');
  });

  it('disabled 的菜单项点击时不回调', async () => {
    const onSelect = vi.fn();
    render(
      <MoreMenu
        items={[
          { key: 'edit', label: '编辑' },
          { key: 'delete', label: '删除', disabled: true },
        ]}
        label='更多'
        onSelect={onSelect}
      />
    );

    await openMenu();
    fireEvent.click(screen.getByText('删除'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('弹层挂在 document.body 上 —— 不能留在 qiankun 容器里被裁掉', async () => {
    const { container } = render(<MoreMenu items={[{ key: 'edit', label: '编辑' }]} label='更多' onSelect={vi.fn()} />);

    await openMenu();

    expect(container.querySelector('.arco-dropdown-menu')).toBeNull();
    expect(document.body.querySelector('.arco-dropdown-menu')).toBeTruthy();
  });

  it('把 data-testid 落到触发按钮上', () => {
    render(<MoreMenu items={[]} label='更多' data-testid='btn-more' onSelect={vi.fn()} />);

    expect(screen.getByTestId('btn-more')).toBeTruthy();
  });

  it('点击触发按钮时调用 onClick —— 列表行需要它阻止事件冒泡', () => {
    const onClick = vi.fn();
    render(<MoreMenu items={[]} label='更多' onClick={onClick} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '更多' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('菜单项的 testId 落到菜单项上', async () => {
    render(<MoreMenu items={[{ key: 'edit', label: '编辑', testId: 'menu-edit' }]} label='更多' onSelect={vi.fn()} />);

    await openMenu();

    expect(screen.getByTestId('menu-edit')).toBeTruthy();
  });
});
