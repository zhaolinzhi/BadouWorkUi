/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@aionui/ui';
import SiderNavItem from './SiderNavItem';

interface SiderNoteEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderNoteEntry: React.FC<SiderNoteEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();
  const label = t('settings.notes');

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      collapsedLabel={label}
      expandedLabel={label}
      onClick={onClick}
      icon={<AppIcon name='nav-note' size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderNoteEntry;
