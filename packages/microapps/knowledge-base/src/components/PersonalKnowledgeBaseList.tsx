/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem } from '../types';
import KnowledgeBaseRow from './KnowledgeBaseRow';
import { AppIcon, AsyncBoundary, EmptyState } from '@aionui/ui';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type PersonalKnowledgeBaseListProps = {
  items: KnowledgeBaseItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEdit: (item: KnowledgeBaseItem) => void;
  onDelete: (item: KnowledgeBaseItem) => void;
  /** Row click destination — view URL for personal KBs. */
  onOpen: (item: KnowledgeBaseItem) => void;
  /** Edit menu destination — edit URL for personal KBs. */
  onOpenEdit: (item: KnowledgeBaseItem) => void;
  onCreate: () => void;
  onStartChat: (item: KnowledgeBaseItem) => void;
};

const PersonalKnowledgeBaseList: React.FC<PersonalKnowledgeBaseListProps> = ({
  items,
  loading = false,
  error = null,
  onRetry,
  onEdit,
  onDelete,
  onOpen,
  onOpenEdit,
  onCreate,
  onStartChat,
}) => {
  const { t } = useTranslation();

  return (
    <AsyncBoundary
      loading={loading}
      error={error}
      onRetry={onRetry}
      retryText={t('common.retry', { defaultValue: 'Retry' })}
      errorContent={t('settings.knowledgeBasePersonalLoadFailed', {
        defaultValue: 'Failed to load personal knowledge bases',
      })}
      loadingContent={
        <div className='text-13px text-t-tertiary'>
          {t('settings.knowledgeBasePersonalLoading', { defaultValue: 'Loading personal knowledge bases…' })}
        </div>
      }
      isEmpty={items.length === 0}
      emptyContent={
        <EmptyState
          icon={<AppIcon name='knowledge-base' size={40} />}
          title={t('settings.knowledgeBaseEmptyTitle', { defaultValue: 'No personal knowledge base yet' })}
          description={t('settings.knowledgeBaseEmptyBody', {
            defaultValue: 'Create your first knowledge base to start organizing documents.',
          })}
          action={
            <Button
              type='primary'
              size='small'
              icon={<AppIcon name='plus' size={14} />}
              className='!rounded-8px'
              onClick={onCreate}
              data-testid='btn-personal-kb-create'
            >
              {t('settings.knowledgeBaseCreate', { defaultValue: 'Create knowledge base' })}
            </Button>
          }
        />
      }
    >
      <div data-testid='personal-kb-list' className='space-y-8px'>
        {items.map((item) => (
          <KnowledgeBaseRow
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpen={onOpen}
            onOpenEdit={onOpenEdit}
            onStartChat={onStartChat}
            hideDelete
          />
        ))}
      </div>
    </AsyncBoundary>
  );
};

export default PersonalKnowledgeBaseList;
