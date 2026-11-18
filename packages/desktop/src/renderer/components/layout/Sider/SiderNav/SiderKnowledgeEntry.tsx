/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from '@aionui/ui';
import SiderNavItem from './SiderNavItem';

interface SiderKnowledgeEntryProps {
  isMobile: boolean;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SiderKnowledgeEntry: React.FC<SiderKnowledgeEntryProps> = ({ isMobile, isActive, collapsed, onClick }) => {
  const { t } = useTranslation();
  const label = t('settings.knowledgeBase');

  return (
    <SiderNavItem
      collapsed={collapsed}
      isActive={isActive}
      isMobile={isMobile}
      collapsedLabel={label}
      expandedLabel={label}
      onClick={onClick}
      icon={<AppIcon name='nav-knowledge' size={collapsed ? 20 : 18} />}
    />
  );
};

export default SiderKnowledgeEntry;
