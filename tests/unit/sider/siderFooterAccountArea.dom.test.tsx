/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 侧栏底部账号区(设计稿的 `.account-anchor`)的行为。
 *
 * 设计稿的关键约定:
 * - 展开态 —— 账号行 = 头像 + 用户名 + 右箭头,右侧独立一个设置齿轮;
 * - 收缩态 —— 只剩一个 28px 圆形头像,齿轮被藏起来,设置/外观/退出登录都在个人菜单里。
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import SiderFooter from '@/renderer/components/layout/Sider/SiderFooter';

const renderFooter = (collapsed: boolean, overrides: Partial<React.ComponentProps<typeof SiderFooter>> = {}) =>
  render(
    <SiderFooter
      isMobile={false}
      isSettings={false}
      collapsed={collapsed}
      theme='light'
      userName='用户1234'
      onSettingsClick={vi.fn()}
      onThemeChange={vi.fn()}
      showLogout
      onLogoutClick={vi.fn()}
      {...overrides}
    />
  );

describe('SiderFooter 账号区', () => {
  it('展开态显示用户名和独立的设置齿轮', () => {
    const onSettingsClick = vi.fn();
    renderFooter(false, { onSettingsClick });

    expect(screen.getByText('用户1234')).toBeTruthy();
    const gear = screen.getByTestId('sider-settings-trigger');
    expect(gear).toBeTruthy();

    gear.click();
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  it('展开态没有用户名时退回品牌名', () => {
    renderFooter(false, { userName: undefined });
    expect(screen.getByText('BadouWork')).toBeTruthy();
  });

  it('收缩态只留头像,齿轮藏起来', () => {
    renderFooter(true);

    expect(screen.getByTestId('sider-account-trigger')).toBeTruthy();
    expect(screen.queryByTestId('sider-settings-trigger')).toBeNull();
  });

  it('设置页里齿轮变成「返回」', () => {
    renderFooter(false, { isSettings: true });
    expect(screen.getByTestId('sider-settings-trigger').getAttribute('aria-label')).toBe('common.back');
  });
});
