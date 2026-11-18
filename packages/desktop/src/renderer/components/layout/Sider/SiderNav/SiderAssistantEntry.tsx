/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ghost } from '@icon-park/react';
import { AppIcon } from '@aionui/ui';
import SiderNavItem from './SiderNavItem';

interface SiderAssistantEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderAssistantEntry: React.FC<SiderAssistantEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();
  const label = t('settings.assistants');

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      collapsedLabel={label}
      expandedLabel={label}
      onClick={onClick}
      // 设计稿的导航里没有「助手」这一项,暂时沿用 icon-park 的 Ghost。
      icon={<AppIcon icon={Ghost} size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderAssistantEntry;
