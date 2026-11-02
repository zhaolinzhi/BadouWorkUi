/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SiderToolbar 的「新会话」按钮用的是定制图标 `new-chat`。
 *
 * 这枚图标是设计单独给的(icon-park 里没有),走 `AppIcon` 渲染 ——
 * 颜色由外层 `<svg>` 的 `style.color` 统一给,所以图标 SVG 里不能写死颜色。
 */
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import SiderToolbar from '@/renderer/components/layout/Sider/SiderNav/SiderToolbar';

const renderToolbar = (collapsed: boolean) =>
  render(
    <SiderToolbar
      isMobile={false}
      isBatchMode={false}
      collapsed={collapsed}
      onNewChat={vi.fn()}
      onToggleBatchMode={vi.fn()}
    />
  );

describe('SiderToolbar 新会话按钮', () => {
  it('展开态用定制图标 new-chat', () => {
    const { container } = renderToolbar(false);

    expect(container.querySelector('.i-icon-new-chat')).toBeTruthy();
  });

  it('折叠态用定制图标 new-chat', () => {
    const { container } = renderToolbar(true);

    expect(container.querySelector('.i-icon-new-chat')).toBeTruthy();
  });
});
