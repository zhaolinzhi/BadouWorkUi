/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 定制图标(icon-park 之外的图标)的渲染契约测试。
 *
 * 定制图标由 `createCustomIcon` 造出来,必须和 icon-park 图标**行为一致**:
 * `size` / `fill` / `strokeWidth` 落到 `<svg>`,`className` / `onClick` 落到外层
 * `<span>`。不一致的话,同一个 `AppIcon` 在主应用和三个微应用里就会长得不一样 ——
 * 那正是这个共享层要消灭的问题。
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import AppIcon from '../AppIcon';
import { createCustomIcon } from '../icons/customIcons';

/** 24 画布 —— 与 icon-park 的比例一致(3 / 48 === 1.5 / 24)。 */
const Outlined = createCustomIcon('outlined', { viewBox: '0 0 24 24' }, () => <path d='M4 12h16' />);

/** 20 画布 —— 描边粗细要按 20 / 48 换算,否则同一个 strokeWidth 看起来会粗得多。 */
const Small = createCustomIcon('small', { viewBox: '0 0 20 20' }, () => <path d='M4 12h16' />);

const renderSvg = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return container.querySelector('svg');
};

const renderSpan = (ui: React.ReactElement) => {
  const { container } = render(ui);
  return container.querySelector('span');
};

describe('定制图标', () => {
  it('DOM 结构与 icon-park 一致:外层 span,内层 svg', () => {
    const { container } = render(<AppIcon icon={Outlined} />);

    const span = container.querySelector('span');
    expect(span?.className).toContain('i-icon');
    expect(span?.querySelector('svg')).toBeTruthy();
  });

  it('class 名带上图标名,与 icon-park 的 i-icon-<name> 一致', () => {
    const span = renderSpan(<AppIcon icon={Outlined} />);

    expect(span?.getAttribute('class')).toContain('i-icon-outlined');
  });

  it('size 落到 svg 的宽高', () => {
    const svg = renderSvg(<AppIcon icon={Outlined} size={24} />);

    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('描边色落到 svg 的 stroke', () => {
    const svg = renderSvg(<AppIcon icon={Outlined} fill='#ff0000' />);

    expect(svg?.getAttribute('stroke')).toBe('#ff0000');
  });

  it('描边色同时写进 style.color,让路径上的 currentColor 解析成同一个颜色', () => {
    const svg = renderSvg(<AppIcon icon={Outlined} fill='#ff0000' />);

    // 设计稿导出的 SVG 普遍带 `stroke="currentColor"` —— 只有 svg 的 CSS color
    // 跟着走,那些路径才会被统一染色,否则各画各的。
    expect(svg?.style.color).toBe('rgb(255, 0, 0)');
  });

  it('描边粗细按 viewBox 宽换算,与 icon-park 保持同一视觉比例', () => {
    // 24 画布:3 × 24/48 = 1.5
    const twentyFour = renderSvg(<AppIcon icon={Outlined} />);
    expect(twentyFour?.getAttribute('stroke-width')).toBe('1.5');

    // 20 画布:3 × 20/48 = 1.25
    const twenty = renderSvg(<AppIcon icon={Small} />);
    expect(twenty?.getAttribute('stroke-width')).toBe('1.25');
  });

  it('className 落在外层 span 上', () => {
    const span = renderSpan(<AppIcon icon={Outlined} className='my-icon' />);

    expect(span?.getAttribute('class')).toContain('my-icon');
  });

  it('点击时触发 onClick', () => {
    const onClick = vi.fn();
    const span = renderSpan(<AppIcon icon={Outlined} interactive onClick={onClick} />);

    span?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('icon-park 的主题参数不会当成 DOM 属性透传出去', () => {
    const span = renderSpan(<AppIcon icon={Outlined} />);

    // AppIcon 固定传 theme="outline";不接住的话 span 上会多一个 theme 属性。
    expect(span?.getAttribute('theme')).toBeNull();
    expect(span?.getAttribute('spin')).toBeNull();
  });

  it('viewBox 原样保留 —— 改了形状会变形', () => {
    const svg = renderSvg(<AppIcon icon={Small} />);

    expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
  });
});
