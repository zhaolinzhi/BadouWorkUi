/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `IconButton` 的行为测试。
 *
 * 图标按钮在主应用与微应用里各写各的,尺寸、圆角、hover 底色全靠复制粘贴,
 * 慢慢就长得不一样了。共享层把它收敛成一个尺寸契约。
 *
 * 关键约束:
 *   - **图标按钮必须有可访问名称**。`label` 是必填的,落到 `aria-label` 上。
 *   - **不写裸 `<button>`** —— 底层是 Arco `Button`。
 *   - **disabled 时不触发 onClick**。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import AppIcon from '../AppIcon';
import IconButton from '../IconButton';

describe('IconButton', () => {
  it('渲染传入的图标', () => {
    const { container } = render(<IconButton icon={<AppIcon name='plus' />} label='新建' />);

    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('label 落到 aria-label 上', () => {
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' />);

    expect(screen.getByRole('button', { name: '新建' })).toBeTruthy();
  });

  it('点击时触发 onClick', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' onClick={onClick} />);

    screen.getByRole('button', { name: '新建' }).click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 时不触发 onClick', () => {
    const onClick = vi.fn();
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' disabled onClick={onClick} />);

    screen.getByRole('button', { name: '新建' }).click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it('禁用态落到 disabled 属性上', () => {
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' disabled />);

    expect(screen.getByRole('button', { name: '新建' }).hasAttribute('disabled')).toBe(true);
  });

  it('不是裸 button 元素 —— 底层是 Arco Button', () => {
    const { container } = render(<IconButton icon={<AppIcon name='plus' />} label='新建' />);

    expect(container.querySelector('button.arco-btn')).toBeTruthy();
  });

  it('status 为 danger 时按钮是危险态', () => {
    const { container } = render(<IconButton icon={<AppIcon name='delete' />} label='删除' status='danger' />);

    expect(container.querySelector('button.arco-btn-status-danger')).toBeTruthy();
  });

  it('把 data-testid 落到按钮上', () => {
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' data-testid='btn-new' />);

    expect(screen.getByTestId('btn-new')).toBeTruthy();
  });
});
