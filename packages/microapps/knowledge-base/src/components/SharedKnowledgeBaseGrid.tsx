/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem } from '../types';
import KnowledgeBaseRow from './KnowledgeBaseRow';
import { AppIcon, AsyncBoundary, EmptyState } from '@aionui/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

type SharedKnowledgeBaseGridProps = {
  items: KnowledgeBaseItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenView: (item: KnowledgeBaseItem) => void;
  onStartChat: (item: KnowledgeBaseItem) => void;
};

/**
 * Shared knowledge bases rendered as a list — same visual treatment as the
 * personal list. Shared bases are not editable in-app; the row click opens
 * the external vendor view page. The more menu is hidden entirely.
 */
const SharedKnowledgeBaseGrid: React.FC<SharedKnowledgeBaseGridProps> = ({
  items,
  loading = false,
  error = null,
  onRetry,
  onOpenView,
  onStartChat,
}) => {
  const { t } = useTranslation();

  return (
    <AsyncBoundary
      loading={loading}
      error={error}
      onRetry={onRetry}
      retryText={t('common.retry', { defaultValue: 'Retry' })}
      errorContent={t('settings.knowledgeBaseSharedLoadFailed', {
        defaultValue: 'Failed to load shared knowledge bases',
      })}
      loadingContent={
        <div className='text-13px text-t-tertiary'>
          {t('settings.knowledgeBaseSharedLoading', { defaultValue: 'Loading shared knowledge bases…' })}
        </div>
      }
      isEmpty={items.length === 0}
      emptyContent={
        <EmptyState
          icon={<AppIcon name='knowledge-base' size={40} />}
          title={t('settings.knowledgeBaseSharedEmpty', { defaultValue: 'No shared knowledge bases available' })}
        />
      }
    >
      <div data-testid='shared-kb-list' className='space-y-8px'>
        {items.map((item) => (
          <KnowledgeBaseRow
            key={item.id}
            item={item}
            onEdit={() => undefined}
            onDelete={() => undefined}
            onOpen={onOpenView}
            onStartChat={onStartChat}
            noMenu
          />
        ))}
      </div>
    </AsyncBoundary>
  );
};

export default SharedKnowledgeBaseGrid;
