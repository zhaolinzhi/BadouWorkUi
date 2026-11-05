/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clipboard } from '@icon-park/react';
import { AppIcon } from '@aionui/ui';
import { useTaskCenterT } from '@renderer/pages/task-center/useTaskCenterT';
import SiderNavItem from './SiderNavItem';

interface SiderTaskCenterEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderTaskCenterEntry: React.FC<SiderTaskCenterEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();
  // 任务中心页面是纯中文的,标题沿用它自己的 `t`。
  const taskCenterT = useTaskCenterT();
  const title = String(taskCenterT('taskCenter.title'));

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      collapsedLabel={t('sider.nav.taskCenterShort')}
      expandedLabel={title}
      onClick={onClick}
      // 设计稿的导航里没有「任务中心」这一项,暂时沿用 icon-park 的 Clipboard。
      icon={<AppIcon icon={Clipboard} size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderTaskCenterEntry;
