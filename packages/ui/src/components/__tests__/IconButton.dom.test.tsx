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
import React, { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from '@arco-design/web-react';

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

  it('把 title 透传到按钮上 —— 悬停时能给出原生提示', () => {
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' title='新建笔记' />);

    expect(screen.getByRole('button', { name: '新建' }).getAttribute('title')).toBe('新建笔记');
  });

  it('ref 指向真实的 button 元素 —— Arco 的 Tooltip / Popconfirm 要靠它定位', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('ref 可以在子组件里用 useRef 拿到', () => {
    let captured: HTMLButtonElement | null = null;
    const Harness: React.FC = () => {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <IconButton
          icon={<AppIcon name='plus' />}
          label='新建'
          ref={(node) => {
            ref.current = node;
            captured = node;
          }}
        />
      );
    };
    render(<Harness />);

    expect(captured).toBeInstanceOf(HTMLButtonElement);
  });

  it('把 hover 事件透传给底层按钮 —— Arco 的 Tooltip 靠它弹浮层', () => {
    const onMouseEnter = vi.fn();
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' onMouseEnter={onMouseEnter} />);

    fireEvent.mouseOver(screen.getByRole('button', { name: '新建' }));

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });

  it('把行内样式透传给底层按钮', () => {
    render(<IconButton icon={<AppIcon name='plus' />} label='新建' style={{ width: '40px' }} />);

    expect(screen.getByRole('button', { name: '新建' }).style.width).toBe('40px');
  });

  it('禁用态下依然能弹出 Arco Tooltip 的提示', async () => {
    render(
      <Tooltip content='没有可转写的片段'>
        <IconButton icon={<AppIcon name='refresh' />} label='重试' disabled />
      </Tooltip>
    );

    fireEvent.mouseOver(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('没有可转写的片段')).toBeTruthy();
  });
});
