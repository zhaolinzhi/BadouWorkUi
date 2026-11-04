/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { ListCheckbox } from '@icon-park/react';
import { AppIcon } from '@aionui/ui';
import classNames from 'classnames';
import styles from '../Sider.module.css';
import SiderNavItem from './SiderNavItem';

interface SiderToolbarProps {
  isMobile: boolean;
  isBatchMode: boolean;
  collapsed: boolean;
  onNewChat: () => void;
  onToggleBatchMode: () => void;
}

/**
 * 「新会话」入口 —— 侧栏导航的第一项。
 *
 * 设计稿把它画成**浅蓝描边的主入口磁贴**(`.nav-item.new-chat`),和其他导航项
 * 在同一个列表里,不是独立的一行工具条。
 *
 * 批量管理按钮挂在这一行右侧(仅展开态 —— 收缩态的 56px 磁贴放不下),
 * 点击时必须 `stopPropagation`,否则会连带触发「新会话」。
 */
const SiderToolbar: React.FC<SiderToolbarProps> = ({
  isMobile,
  isBatchMode,
  collapsed,
  onNewChat,
  onToggleBatchMode,
}) => {
  const { t } = useTranslation();
  const label = t('conversation.welcome.newConversation');

  const batchButton = (
    <Tooltip
      content={isBatchMode ? t('conversation.history.batchModeExit') : t('conversation.history.batchManage')}
      position='right'
    >
      <div
        role='button'
        tabIndex={-1}
        aria-label={isBatchMode ? t('conversation.history.batchModeExit') : t('conversation.history.batchManage')}
        onClick={(event) => {
          event.stopPropagation();
          onToggleBatchMode();
        }}
        className={classNames(
          'size-24px rd-6px flex items-center justify-center cursor-pointer shrink-0 transition-colors border border-solid border-transparent text-t-secondary hover:text-t-primary',
          isMobile && 'sider-action-icon-btn-mobile',
          {
            'hover:bg-fill-3': !isBatchMode,
            'bg-[rgba(var(--primary-6),0.12)] border-[rgba(var(--primary-6),0.24)] !text-primary': isBatchMode,
          }
        )}
      >
        <ListCheckbox theme='outline' size='14' className='block leading-none shrink-0' style={{ lineHeight: 0 }} />
      </div>
    </Tooltip>
  );

  return (
    <SiderNavItem
      accent
      collapsed={collapsed}
      isMobile={isMobile}
      collapsedLabel={label}
      expandedLabel={label}
      onClick={onNewChat}
      // 展开态下设计稿把主入口图标缩到 90%(`.nav-item[data-nav="新会话"] .nav-icon>img`)。
      icon={
        <AppIcon
          name='new-chat'
          size={collapsed ? 20 : 18}
          className={collapsed ? undefined : styles.navAccentIcon}
        />
      }
      trailing={collapsed ? undefined : batchButton}
      testId='sider-new-chat'
    />
  );
};

export default SiderToolbar;
