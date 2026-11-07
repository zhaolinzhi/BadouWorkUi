/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem, KnowledgeBaseTab } from '../types';
import KnowledgeBaseGrid from '../components/kb/KnowledgeBaseGrid';
import { interpolateI18n } from '../utils/knowledgeBaseUtils';
import { AppIcon } from '@aionui/ui';
import { Button, Input, Select } from '@arco-design/web-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KnowledgeBaseHomeTabs.module.css';

type KnowledgeBaseHomeTabsProps = {
  personalItems: KnowledgeBaseItem[];
  personalLoading?: boolean;
  personalError?: string | null;
  sharedItems: KnowledgeBaseItem[];
  sharedLoading?: boolean;
  sharedError?: string | null;
  onRetryLoadPersonal?: () => void;
  onRetryLoadShared?: () => void;
  onRefresh?: (tab: KnowledgeBaseTab) => void;
  onDelete: (item: KnowledgeBaseItem) => void;
  /** Row click destination for the personal list (view URL). */
  onOpenView: (item: KnowledgeBaseItem) => void;
  /** Edit menu destination for the personal list (edit URL). */
  onOpenEdit: (item: KnowledgeBaseItem) => void;
  onCreate: () => void;
  onStartChat: (item: KnowledgeBaseItem) => void;
  initialTab?: KnowledgeBaseTab;
  onTabChange?: (tab: KnowledgeBaseTab) => void;
};

type SortKey = 'recent' | 'name';

const KnowledgeBaseHomeTabs: React.FC<KnowledgeBaseHomeTabsProps> = ({
  personalItems,
  personalLoading = false,
  personalError = null,
  sharedItems,
  sharedLoading = false,
  sharedError = null,
  onRetryLoadPersonal,
  onRetryLoadShared,
  onRefresh,
  onDelete,
  onOpenView,
  onOpenEdit,
  onCreate,
  onStartChat,
  initialTab = 'personal',
  onTabChange,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<KnowledgeBaseTab>(initialTab);
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  const selectTab = (next: KnowledgeBaseTab) => {
    if (next === tab) return;
    setTab(next);
    setKeyword('');
    onTabChange?.(next);
    onRefresh?.(next);
  };

  const isPersonal = tab === 'personal';
  const items = isPersonal ? personalItems : sharedItems;

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const list = query ? items.filter((item) => item.name.toLowerCase().includes(query)) : items;
    const sorted = [...list];
    if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    } else {
      sorted.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    }
    return sorted;
  }, [items, keyword, sort]);

  const totalDocuments = useMemo(() => items.reduce((sum, item) => sum + (item.documentCount ?? 0), 0), [items]);

  const scopeTab = (key: KnowledgeBaseTab, label: string, count: number) => (
    <Button
      type='text'
      role='tab'
      aria-selected={tab === key}
      data-testid={`kb-tab-${key}`}
      onClick={() => selectTab(key)}
      className={`${styles.scopeTab} ${tab === key ? styles.scopeTabActive : ''}`}
    >
      <span>{label}</span>
      <small className={styles.scopeTabCount}>{count}</small>
    </Button>
  );

  return (
    <div data-testid='kb-home-shell' className='h-full min-h-0 overflow-auto'>
      <div className={styles.home}>
        <header className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{t('settings.knowledgeBase', { defaultValue: '知识库' })}</h1>
            <p className={styles.subtitle}>
              {t('settings.knowledgeBaseLead', {
                defaultValue: '让文档有序，让知识随时可用。集中整理个人资料，与团队共享工作中的积累。',
              })}
            </p>
          </div>
          <Button
            type='primary'
            icon={<AppIcon name='plus' size={16} />}
            className={styles.createButton}
            onClick={onCreate}
            data-testid='btn-create-knowledge-base'
          >
            {t('settings.knowledgeBaseCreate', { defaultValue: '新建知识库' })}
          </Button>
        </header>

        <div className={styles.scopeRow}>
          <div className={styles.scopeTabs} role='tablist'>
            {scopeTab(
              'personal',
              t('settings.knowledgeBaseTabPersonal', { defaultValue: '个人知识库' }),
              personalItems.length
            )}
            {scopeTab(
              'shared',
              t('settings.knowledgeBaseTabShared', { defaultValue: '共享知识库' }),
              sharedItems.length
            )}
          </div>

          {items.length > 0 ? (
            <div className={styles.search}>
              <AppIcon name='search' size={16} className={styles.searchIcon} />
              <Input
                value={keyword}
                onChange={setKeyword}
                placeholder={t('settings.knowledgeBaseSearchPlaceholder', { defaultValue: '搜索知识库' })}
                data-testid='kb-search'
              />
            </div>
          ) : null}
        </div>

        {items.length > 0 ? (
          <div className={styles.listTools}>
            <div className={styles.listCount}>
              <b className={styles.listCountTitle}>
                {t('settings.knowledgeBaseAllTitle', { defaultValue: '全部知识库' })}
              </b>
              <span className={styles.listCountMeta}>
                {interpolateI18n(
                  t('settings.knowledgeBaseListSummary', {
                    count: items.length,
                    documents: totalDocuments,
                    defaultValue: '{{count}} 个知识库 · {{documents}} 份文档',
                  }),
                  { count: items.length, documents: totalDocuments }
                )}
              </span>
            </div>
            <Select
              className={styles.sortSelect}
              value={sort}
              onChange={(value) => setSort(value as SortKey)}
              options={[
                {
                  value: 'recent',
                  label: t('settings.knowledgeBaseSortRecent', { defaultValue: '最近更新' }),
                },
                {
                  value: 'name',
                  label: t('settings.knowledgeBaseSortName', { defaultValue: '名称排序' }),
                },
              ]}
              aria-label={t('settings.knowledgeBaseSortLabel', { defaultValue: '知识库排序' })}
              data-testid='kb-sort'
            />
          </div>
        ) : null}

        <KnowledgeBaseGrid
          scope={tab}
          items={filtered}
          total={items.length}
          loading={isPersonal ? personalLoading : sharedLoading}
          error={isPersonal ? personalError : sharedError}
          onRetry={isPersonal ? onRetryLoadPersonal : onRetryLoadShared}
          onOpen={onOpenView}
          onOpenEdit={onOpenEdit}
          onDelete={onDelete}
          onStartChat={onStartChat}
          onCreate={onCreate}
          onClearSearch={() => setKeyword('')}
        />
      </div>
    </div>
  );
};

export default KnowledgeBaseHomeTabs;
