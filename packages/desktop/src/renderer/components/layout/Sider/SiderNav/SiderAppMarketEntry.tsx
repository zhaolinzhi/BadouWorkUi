/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@aionui/ui';
import SiderNavItem from './SiderNavItem';

interface SiderAppMarketEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

/**
 * 「应用市场」入口 —— 设计稿里有这一项,产品里还没有对应路由。
 *
 * 先把入口摆出来(占位),点击后弹一条提示;等应用市场页面就绪,
 * 把 `onClick` 换成真正的路由跳转即可。
 */
const SiderAppMarketEntry: React.FC<SiderAppMarketEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      // 收缩态磁贴只有 56px 宽,放不下四个字 —— 设计稿里这里就叫「应用」。
      collapsedLabel={t('sider.nav.appMarketShort')}
      expandedLabel={t('sider.appMarket.title')}
      onClick={onClick}
      icon={<AppIcon name='nav-app-market' size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderAppMarketEntry;
