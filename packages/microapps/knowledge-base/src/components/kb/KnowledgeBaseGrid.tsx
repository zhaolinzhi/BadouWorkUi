/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem, KnowledgeBaseTab } from '../../types';
import KnowledgeBaseCard from './KnowledgeBaseCard';
import KnowledgeBaseEmptyState from './KnowledgeBaseEmptyState';
import { AppIcon, AsyncBoundary } from '@aionui/ui';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KnowledgeBaseGrid.module.css';

type KnowledgeBaseGridProps = {
  /** 个人 / 共享 —— 决定空态文案与卡片菜单的可选项。 */
  scope: KnowledgeBaseTab;
  /** 搜索/排序后的卡片列表。 */
  items: KnowledgeBaseItem[];
  /** 搜索前的总数 —— 用来区分「没有知识库」与「没有搜索结果」。 */
  total: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpen: (item: KnowledgeBaseItem) => void;
  onDelete?: (item: KnowledgeBaseItem) => void;
  onStartChat: (item: KnowledgeBaseItem) => void;
  onCreate: () => void;
  onClearSearch: () => void;
};

/**
 * 知识库卡片网格。加载/失败/空态都收在这里,页面只管页头、范围切换与工具行。
 */
const KnowledgeBaseGrid: React.FC<KnowledgeBaseGridProps> = ({
  scope,
  items,
  total,
  loading = false,
  error = null,
  onRetry,
  onOpen,
  onDelete,
  onStartChat,
  onCreate,
  onClearSearch,
}) => {
  const { t } = useTranslation();
  const isPersonal = scope === 'personal';

  const emptyContent = (() => {
    // 有知识库但被搜索过滤光了 —— 与「还没有知识库」是两回事。
    if (total > 0) {
      return (
        <KnowledgeBaseEmptyState
          title={t('settings.knowledgeBaseNoResultsTitle', { defaultValue: '暂无搜索结果' })}
          description={t('settings.knowledgeBaseNoResultsBody', {
            defaultValue: '试试其他关键词，或清除搜索。',
          })}
          action={
            <Button type='primary' onClick={onClearSearch} data-testid='btn-kb-clear-search'>
              {t('settings.knowledgeBaseClearSearch', { defaultValue: '清除搜索' })}
            </Button>
          }
        />
      );
    }

    if (!isPersonal) {
      return (
        <KnowledgeBaseEmptyState
          title={t('settings.knowledgeBaseSharedEmpty', { defaultValue: '暂无可用的共享知识库' })}
        />
      );
    }

    return (
      <KnowledgeBaseEmptyState
        title={t('settings.knowledgeBaseEmptyTitle', { defaultValue: '还没有个人知识库' })}
        description={t('settings.knowledgeBaseEmptyBody', {
          defaultValue: '创建你的第一个知识库，把分散的文档整理在一起。',
        })}
        action={
          <Button
            type='primary'
            icon={<AppIcon name='plus' size={14} />}
            onClick={onCreate}
            data-testid='btn-personal-kb-create'
          >
            {t('settings.knowledgeBaseCreate', { defaultValue: '新建知识库' })}
          </Button>
        }
      />
    );
  })();

  return (
    <AsyncBoundary
      className={styles.boundary}
      loading={loading}
      error={error}
      onRetry={onRetry}
      retryText={t('common.retry', { defaultValue: '重试' })}
      errorContent={
        isPersonal
          ? t('settings.knowledgeBasePersonalLoadFailed', { defaultValue: '加载个人知识库失败' })
          : t('settings.knowledgeBaseSharedLoadFailed', { defaultValue: '加载共享知识库失败' })
      }
      loadingContent={
        <div className='text-13px text-t-tertiary'>
          {isPersonal
            ? t('settings.knowledgeBasePersonalLoading', { defaultValue: '正在加载个人知识库…' })
            : t('settings.knowledgeBaseSharedLoading', { defaultValue: '正在加载共享知识库…' })}
        </div>
      }
      isEmpty={items.length === 0}
      emptyContent={<div className={styles.emptyZone}>{emptyContent}</div>}
    >
      <div className={styles.grid} data-testid={`kb-grid-${scope}`}>
        {items.map((item) => (
          <KnowledgeBaseCard
            key={item.id}
            item={item}
            onOpen={onOpen}
            onDelete={onDelete}
            onStartChat={onStartChat}
            readOnly={!isPersonal}
            hideDelete={isPersonal}
          />
        ))}
      </div>
    </AsyncBoundary>
  );
};

export default KnowledgeBaseGrid;
