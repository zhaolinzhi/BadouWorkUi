/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@aionui/ui';
import SiderNavItem from './SiderNavItem';

interface SiderScheduledEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderScheduledEntry: React.FC<SiderScheduledEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();
  const label = t('cron.scheduledTasks');

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      // 收缩态磁贴只有 56px 宽,放不下「定时任务」四个字。
      collapsedLabel={t('sider.nav.scheduledShort')}
      expandedLabel={label}
      onClick={onClick}
      icon={<AppIcon name='nav-task' size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderScheduledEntry;
