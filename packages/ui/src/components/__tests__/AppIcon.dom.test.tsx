/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `AppIcon` 的行为测试。
 *
 * 它解决的是主应用与微应用之间最刺眼的一处不一致:主应用的 icon-park 图标
 * 被构建期 `iconParkPlugin`(见 `packages/desktop/electron.vite.config.ts`)
 * 自动套上 `IconParkHOC`,强制 size=16 / strokeWidth=3 / fill=iconColors.secondary;
 * 三个微应用没装这个 plugin,图标是裸的 —— 描边更粗、颜色跟随文字色、尺寸五花八门。
 *
 * 关键约束:
 *   - **语义名 + 组件透传双通道**。`name` 走内置映射(产品内统一),
 *     `icon` 直接透传任意 icon-park 组件(映射表没收录的图标)。
 *   - **默认值统一,但可被覆盖**:size 默认 16、fill 默认 currentColor、
 *     strokeWidth 默认 3。
 *   - **cursor-pointer 只在 interactive 时加**。主应用的 `IconParkHOC` 给所有
 *     图标强加手型光标,连 `<FileText size={14} />` 这种纯装饰图标也会变手型 —— 这个
 *     缺陷不在共享层复现。
 *   - **未知 name / 空 props 渲染 null,不抛错**。图标不该让整页崩掉。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import AppIcon, { type AppIconComponentProps, type AppIconName } from '../AppIcon';

/**
 * 任意自定义图标组件 —— 用来验证 `icon` 透传通道。
 *
 * 刻意**不写类型断言**:能直接传进 `AppIcon` 说明共享层导出的 props 类型
 * 确实是自洽的(而不是靠 `as never` 糊过去)。
 */
const CustomIcon = (_props: AppIconComponentProps) => <svg data-testid='custom-icon' />;

const renderIcon = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return container.querySelector('svg');
};

/**
 * icon-park 把 `className` 挂在**外层 span** 上(`i-icon i-icon-plus <你的 class>`),
 * 内层才是 svg。断言 class 时必须查 span。
 */
const renderIconSpan = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return container.querySelector('span');
};

/**
 * icon-park 的 `fill` 不是 svg 的 fill 属性,而是**描边色**:
 * outline 主题下它进 `colors[0]`,最终落在 `<path stroke="...">` 上。
 * svg 上的 `fill="none"` 是 icon-park 写死的,不能拿来断言。
 */
const strokeOf = (svg: Element | null) => svg?.querySelector('path')?.getAttribute('stroke');

describe('AppIcon', () => {
  it('按语义名渲染映射表里的图标', () => {
    const svg = renderIcon(<AppIcon name='plus' />);

    expect(svg).toBeTruthy();
  });

  it('默认 size 为 16', () => {
    const svg = renderIcon(<AppIcon name='plus' />);

    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('height')).toBe('16');
  });

  it('可以覆盖 size', () => {
    const svg = renderIcon(<AppIcon name='plus' size={48} />);

    expect(svg?.getAttribute('width')).toBe('48');
  });

  it('默认描边色为 currentColor', () => {
    // 与主应用 IconParkHOC 的固定色不同 —— 跟随文字色才能自动适配明暗主题,
    // 这是 AppIcon 相对主应用实现的一处有意改进。
    const svg = renderIcon(<AppIcon name='plus' />);

    expect(strokeOf(svg)).toBe('currentColor');
  });

  it('可以覆盖描边色', () => {
    const svg = renderIcon(<AppIcon name='plus' fill='#ff0000' />);

    expect(strokeOf(svg)).toBe('#ff0000');
  });

  it('非 interactive 时不带 cursor-pointer', () => {
    const span = renderIconSpan(<AppIcon name='plus' />);

    expect(span?.getAttribute('class')).not.toContain('cursor-pointer');
  });

  it('interactive 时带 cursor-pointer', () => {
    const span = renderIconSpan(<AppIcon name='plus' interactive />);

    expect(span?.getAttribute('class')).toContain('cursor-pointer');
  });

  it('点击时触发 onClick', () => {
    const onClick = vi.fn();
    const span = renderIconSpan(<AppIcon name='plus' interactive onClick={onClick} />);

    span?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('可以透传任意 icon-park 组件', () => {
    const { container } = render(<AppIcon icon={CustomIcon} />);

    expect(container.querySelector('[data-testid="custom-icon"]')).toBeTruthy();
  });

  it('同时传 name 与 icon 时以 icon 为准', () => {
    const { container } = render(<AppIcon name='plus' icon={CustomIcon} />);

    expect(container.querySelector('[data-testid="custom-icon"]')).toBeTruthy();
  });

  it('name 不在映射表里时渲染 null,不抛错', () => {
    const { container } = render(<AppIcon name={'not-a-real-icon' as AppIconName} />);

    expect(container.querySelector('svg')).toBeNull();
  });

  it('既没有 name 也没有 icon 时渲染 null,不抛错', () => {
    const { container } = render(<AppIcon />);

    expect(container.querySelector('svg')).toBeNull();
  });
});
