/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@aionui/ui';
import SiderNavItem from './SiderNavItem';

interface SiderMeetingRecordingEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderMeetingRecordingEntry: React.FC<SiderMeetingRecordingEntryProps> = ({
  isMobile,
  isActive,
  collapsed,
  onClick,
}) => {
  const { t } = useTranslation();
  const label = t('meeting-recording.title');

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      // 收缩态磁贴只有 56px 宽,放不下四个字 —— 设计稿里这里就叫「录音」。
      collapsedLabel={t('sider.nav.meetingRecordingShort')}
      expandedLabel={label}
      onClick={onClick}
      icon={<AppIcon name='nav-recording' size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderMeetingRecordingEntry;
