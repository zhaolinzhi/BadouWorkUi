/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseEditorViewModel, KnowledgeBaseListItem } from '../types';
import KnowledgeBaseEditorSections from './KnowledgeBaseEditorSections';
import { AppHeader, AppIcon } from '@aionui/ui';
import { Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type KnowledgeBaseEditorPageProps = {
  editor: KnowledgeBaseEditorViewModel;
  activeKnowledgeBase: KnowledgeBaseListItem | null;
  onBack: () => void;
};

const KnowledgeBaseEditorPage: React.FC<KnowledgeBaseEditorPageProps> = ({ editor, activeKnowledgeBase, onBack }) => {
  const { t } = useTranslation();
  const { isCreating, actions, profile } = editor;
  const canDelete = !isCreating && activeKnowledgeBase?.source !== 'builtin';
  const canSave = isCreating || Boolean(activeKnowledgeBase);

  return (
    <div data-testid='kb-editor-page' className='flex h-full min-h-0 flex-col overflow-hidden bg-transparent'>
      <AppHeader
        leading={
          <Button
            type='text'
            icon={<AppIcon name='arrow-left' size={16} />}
            onClick={onBack}
            data-testid='btn-back-kb-editor'
            className='!flex !items-center !gap-4px !rounded-8px !px-6px !text-t-primary'
          >
            {t('settings.knowledgeBaseBackToList', { defaultValue: 'All knowledge bases' })}
          </Button>
        }
        title={
          profile.name.trim() ||
          (isCreating
            ? t('settings.knowledgeBaseCreate', { defaultValue: 'Create Knowledge Base' })
            : t('settings.knowledgeBaseEdit', { defaultValue: 'Knowledge Base Details' }))
        }
        trailing={
          <>
            {canDelete && (
              <Button
                status='danger'
                className='!rounded-8px'
                style={{ backgroundColor: 'rgb(var(--danger-1))' }}
                onClick={actions.requestDelete}
                data-testid='btn-delete-kb'
              >
                {t('common.delete', { defaultValue: 'Delete' })}
              </Button>
            )}
            <Button onClick={onBack} className='!rounded-8px bg-fill-1' data-testid='btn-cancel-kb-editor'>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type='primary'
              onClick={actions.save}
              data-testid='btn-save-kb'
              className='!rounded-8px'
              disabled={!canSave}
            >
              {isCreating ? t('common.create', { defaultValue: 'Create' }) : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </>
        }
      />

      <div
        data-testid='kb-editor-body'
        data-editor-popup-root
        className='relative min-h-0 flex-1 overflow-auto px-18px py-18px pb-24px'
      >
        <div className='mx-auto w-full max-w-760px'>
          <KnowledgeBaseEditorSections editor={editor} activeKnowledgeBase={activeKnowledgeBase} />
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseEditorPage;
