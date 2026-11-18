/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem } from '../../types';
import KnowledgeBaseAvatar from '../KnowledgeBaseAvatar';
import { interpolateI18n } from '../../utils/knowledgeBaseUtils';
import { AppIcon, MoreMenu } from '@aionui/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KnowledgeBaseCard.module.css';

type KnowledgeBaseCardProps = {
  item: KnowledgeBaseItem;
  /** 点击卡片打开详情。 */
  onOpen: (item: KnowledgeBaseItem) => void;
  /** 菜单里「编辑」的跳转目标;缺省时回落到 `onOpen`。 */
  onOpenEdit?: (item: KnowledgeBaseItem) => void;
  onDelete?: (item: KnowledgeBaseItem) => void;
  /** 用该知识库发起问答。 */
  onStartChat: (item: KnowledgeBaseItem) => void;
  /** 只读(共享知识库):菜单里不提供编辑/删除,只剩「问知识库」。 */
  readOnly?: boolean;
  /** 不显示删除项。个人知识库列表在应用内不暴露删除。 */
  hideDelete?: boolean;
};

/**
 * 一张知识库卡片 —— 设计稿的 `.kb-card`:
 * 顶部(图标方块 + 可见范围 + 更多菜单)、名称、描述、底部(文档数 + 更新时间)。
 */
const KnowledgeBaseCard: React.FC<KnowledgeBaseCardProps> = ({
  item,
  onOpen,
  onOpenEdit,
  onDelete,
  onStartChat,
  readOnly = false,
  hideDelete = false,
}) => {
  const { t } = useTranslation();
  const canDelete = !readOnly && !hideDelete && item.source !== 'builtin';

  const menuItems = [
    {
      key: 'chat',
      label: t('settings.knowledgeBaseGoChat', { defaultValue: '对话' }),
      icon: <AppIcon name='robot' size={14} />,
      testId: `kb-menu-chat-${item.id}`,
    },
    ...(readOnly
      ? []
      : [
          {
            key: 'edit',
            label: t('common.edit', { defaultValue: '编辑' }),
            testId: `kb-menu-edit-${item.id}`,
          },
        ]),
    ...(canDelete
      ? [
          {
            key: 'delete',
            label: t('common.delete', { defaultValue: '删除' }),
            icon: <AppIcon name='delete' size={14} />,
            danger: true,
            testId: `kb-menu-delete-${item.id}`,
          },
        ]
      : []),
  ];

  const scopeText = item.isShared
    ? t('settings.knowledgeBaseTeamShared', { defaultValue: '团队共享' })
    : t('settings.knowledgeBasePrivateOnly', { defaultValue: '仅自己可见' });

  /*
   * 菜单弹层挂在 document.body 上,但 React 的事件是沿**组件树**冒泡的 ——
   * 点弹层里的菜单项,事件照样会冒到卡片上,把「打开知识库」也一起触发。
   * 这里按 DOM 位置把弹层里的点击挡掉。
   */
  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.arco-dropdown, .arco-menu')) return;
    onOpen(item);
  };

  return (
    <article
      data-testid={`kb-card-${item.id}`}
      className={styles.card}
      role='button'
      tabIndex={0}
      aria-label={item.name}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className={styles.top}>
        <KnowledgeBaseAvatar knowledgeBase={item} size={32} />
        <div className={styles.range}>
          <span className={styles.scope}>
            <AppIcon name={item.isShared ? 'peoples' : 'lock'} size={16} className={styles.scopeIcon} />
            {scopeText}
          </span>
          <MoreMenu
            items={menuItems}
            label={t('common.more', { defaultValue: 'More' })}
            onClick={(event) => event.stopPropagation()}
            onSelect={(key) => {
              if (key === 'chat') onStartChat(item);
              if (key === 'edit') (onOpenEdit ?? onOpen)(item);
              if (key === 'delete') onDelete?.(item);
            }}
            className={styles.moreButton}
            data-testid={`btn-kb-more-${item.id}`}
          />
        </div>
      </div>

      <h2 className={styles.name}>{item.name}</h2>
      <p className={styles.description}>{item.description || ''}</p>

      <footer className={styles.footer}>
        <span className={styles.footerItem}>
          {interpolateI18n(
            t('settings.knowledgeBaseDocsCount', { count: item.documentCount ?? 0, defaultValue: '{{count}} 份文档' }),
            { count: item.documentCount ?? 0 }
          )}
        </span>
        {item.updatedAt ? (
          <span className={styles.footerItem}>
            {interpolateI18n(t('settings.knowledgeBaseUpdatedAt', { defaultValue: '更新于 {{date}}' }), {
              date: item.updatedAt,
            })}
          </span>
        ) : null}
      </footer>
    </article>
  );
};

export default KnowledgeBaseCard;
