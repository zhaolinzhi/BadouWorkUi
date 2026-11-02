/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SVG → 图标组件的端到端测试。
 *
 * 走的是完整链路:vitest 的 Vite 管线 → `aionuiSvgIconPlugin` → `createCustomIcon`。
 * 断言的是**渲染结果**而不是生成的代码 —— 生成的代码由 `svgToReact.test.ts` 负责。
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import MultiIcon from '../../components/icons/svg/_multi-icon.svg?component';
import SampleIcon from '../../components/icons/svg/_sample-icon.svg?component';

describe('SVG 编译成图标组件', () => {
  it('DOM 结构与 icon-park 一致:外层 span,内层 svg', () => {
    const { container } = render(<SampleIcon />);

    const span = container.querySelector('span');
    expect(span?.getAttribute('class')).toContain('i-icon');
    expect(span?.querySelector('svg')).toBeTruthy();
  });

  it('class 名带上图标名', () => {
    const { container } = render(<SampleIcon />);

    expect(container.querySelector('span')?.getAttribute('class')).toContain('i-icon-sample-icon');
  });

  it('size 落到 svg 的宽高', () => {
    const { container } = render(<SampleIcon size={24} />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('viewBox 原样保留', () => {
    const { container } = render(<SampleIcon />);

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('描边色跟随 fill,描边粗细按设计稿比例换算', () => {
    const { container } = render(<SampleIcon />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    // 设计稿 24 画布 / 1.5 描边 → strokeWidth={3} 复现 1.5
    expect(svg?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('路径画出来了', () => {
    const { container } = render(<SampleIcon />);

    expect(container.querySelector('path')?.getAttribute('d')).toContain('M12 2');
  });

  it('多个子元素都画出来 —— 不能只留最后一个', () => {
    const { container } = render(<MultiIcon />);

    expect(container.querySelectorAll('path')).toHaveLength(2);
  });
});
