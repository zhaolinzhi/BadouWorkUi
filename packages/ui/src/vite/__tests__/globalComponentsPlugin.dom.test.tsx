/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 全局注册的**端到端**验证。
 *
 * 这个文件刻意**不 import** `AppIcon` / `IconButton` —— 全局注册之后它们应该
 * 直接可用。测试跑在根 `vitest.config.ts` 上,那条配置里装了同一个插件,
 * 所以这里能过,就说明「构建期自动补 import」这条链路是通的。
 *
 * 注意:只 import `React` —— JSX 走的是 classic runtime(`React.createElement`),
 * React 本身仍然要显式引入。
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

describe('全局注册的共享组件', () => {
  it('不 import 也能渲染 AppIcon', () => {
    const { container } = render(<AppIcon name='plus' />);

    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('不 import 也能渲染 IconButton', () => {
    const { container } = render(<IconButton icon={<AppIcon name='plus' />} label='删除' />);

    expect(container.querySelector('button[aria-label="删除"]')).toBeTruthy();
  });
});
