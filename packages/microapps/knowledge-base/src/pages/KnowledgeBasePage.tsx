/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseEditorViewModel, KnowledgeBaseItem, KnowledgeBaseTab } from '../types';
import KnowledgeBaseEditorPage from './KnowledgeBaseEditorPage';
import KnowledgeBaseHomeTabs from './KnowledgeBaseHomeTabs';
import KnowledgeBaseAvatar from '../components/KnowledgeBaseAvatar';
import { useKnowledgeBaseEditor, useKnowledgeBaseList } from '../hooks';
import { useAppRuntime } from '../AppContext';
import { useManagedAgentRuntimeCatalog } from '../utils/useManagedAgents';
import { buildAssistantEditorBackends } from '../utils/assistantUtils';
import { getKnowledgeBaseCreateUrl, getKnowledgeBaseEditUrl, getKnowledgeBaseViewUrl } from '../utils/api';
import { openExternalUrl } from '../utils/platform';
import { resolveIconImageSrc } from '../utils/knowledgeBaseUtils';
import { ConfirmModal } from '@aionui/ui';
import { Message } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const KnowledgeBasePage: React.FC = () => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage({ maxCount: 10 });
  // Arco 把 useMessage 的返回方法标成可选(见 useKnowledgeBaseEditor 的 MessageApi
  // 注释),运行时必定齐全。这里收窄一次,下游就不用到处写 `?.`。
  const message = messageApi as Required<typeof messageApi>;
  const { token, navigate } = useAppRuntime();
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    tokenRef.current = token || null;
  }, [token]);

  const {
    personalItems,
    setPersonalItems,
    sharedItems,
    setSharedItems,
    personalLoading,
    personalError,
    sharedLoading,
    sharedError,
    activeKnowledgeBaseId,
    setActiveKnowledgeBaseId,
    activeKnowledgeBase,
    loadKnowledgeBases,
    loadPersonalKnowledgeBases,
    loadSharedKnowledgeBases,
  } = useKnowledgeBaseList();

  const handleTabRefresh = useCallback(
    (next: KnowledgeBaseTab) => {
      const authToken = tokenRef.current;
      if (!authToken) return;
      if (next === 'personal') void loadPersonalKnowledgeBases(authToken);
      else void loadSharedKnowledgeBases(authToken);
    },
    [loadPersonalKnowledgeBases, loadSharedKnowledgeBases]
  );

  const handleRetryLoadPersonal = useCallback(() => {
    const authToken = tokenRef.current;
    if (!authToken) return;
    void loadPersonalKnowledgeBases(authToken);
  }, [loadPersonalKnowledgeBases]);

  const editor = useKnowledgeBaseEditor({
    activeKnowledgeBase,
    setActiveKnowledgeBaseId,
    loadKnowledgeBases,
    setPersonalItems,
    setSharedItems,
    message,
  });

  const managedAgentRuntimeCatalog = useManagedAgentRuntimeCatalog();
  const builtinIconOptions = useMemo(() => {
    const builtin = [...personalItems, ...sharedItems].filter(
      (item) => item.icon && item.icon.startsWith('/api/knowledge-base/')
    );
    return builtin
      .map((item) => {
        const src = resolveIconImageSrc(item.icon);
        if (!src) return null;
        return { id: item.id, label: item.name, src };
      })
      .filter((option): option is NonNullable<typeof option> => option !== null);
  }, [personalItems, sharedItems]);

  const availableBackends = useMemo(
    () => buildAssistantEditorBackends(managedAgentRuntimeCatalog, 'en-US', editor.editAgent),
    [editor.editAgent, managedAgentRuntimeCatalog]
  );

  const editIconImage = editor.editIconPreview || resolveIconImageSrc(editor.editIcon);
  const showEditor = editor.editVisible && (editor.isCreating || activeKnowledgeBaseId !== null);

  const editorViewModel: KnowledgeBaseEditorViewModel = {
    isCreating: editor.isCreating,
    profile: {
      name: editor.editName,
      setName: editor.setEditName,
      description: editor.editDescription,
      setDescription: editor.setEditDescription,
      icon: editor.editIcon,
      setIcon: editor.setEditIcon,
      setIconPreview: editor.setEditIconPreview,
      iconImage: editIconImage,
      builtinIconOptions,
    },
    agent: {
      value: editor.editAgent,
      setValue: editor.setEditAgent,
      availableBackends,
    },
    rules: {
      content: editor.editContext,
      setContent: editor.setEditContext,
      viewMode: editor.promptViewMode,
      setViewMode: editor.setPromptViewMode,
    },
    actions: {
      save: editor.handleSave,
      requestDelete: editor.handleDeleteClick,
    },
  };

  const handleOpen = useCallback(
    async (item: KnowledgeBaseItem) => {
      try {
        await openExternalUrl(getKnowledgeBaseEditUrl(item.id));
      } catch (error) {
        console.error('Failed to open knowledge base edit page:', error);
      }
    },
    // openExternalUrl / URL 构造都是模块级稳定引用
    []
  );

  const handleOpenView = useCallback(async (item: KnowledgeBaseItem) => {
    try {
      await openExternalUrl(getKnowledgeBaseViewUrl(item.id));
    } catch (error) {
      console.error('Failed to open knowledge base view page:', error);
    }
  }, []);

  // TODO: API - 知识库直接打开对话：根据 KB 的 agentId 跳转到 /guid
  const handleStartChat = useCallback(
    (item: KnowledgeBaseItem) => {
      /*
       * 跳回 shell 的 `/kb-chat/:id` —— 那是另一个路由,仍由 shell 渲染
       * (`pages/kb-chat`)。子应用自己的 react-router 里没有这条路由,
       * 所以走 shell 注入的 `navigate`。
       */
      navigate(`/kb-chat/${encodeURIComponent(item.id)}`);
    },
    [navigate]
  );

  // "New knowledge base" jumps to the vendor's web create page instead of
  // the in-app editor — knowledge bases live in an admin system we don't
  // mirror. Reload the list when the user returns to the page so newly
  // created bases appear without a manual refresh.
  const handleCreate = useCallback(async () => {
    try {
      await openExternalUrl(getKnowledgeBaseCreateUrl());
    } catch (error) {
      console.error('Failed to open knowledge base create page:', error);
    }
  }, []);

  return (
    <div className='h-full w-full overflow-hidden bg-bg-0'>
      <div className='flex flex-col h-full w-full'>
        {messageContext}
        <div className='flex-1 min-h-0'>
          {showEditor ? (
            <KnowledgeBaseEditorPage
              editor={editorViewModel}
              activeKnowledgeBase={activeKnowledgeBase}
              onBack={() => editor.setEditVisible(false)}
            />
          ) : (
            <KnowledgeBaseHomeTabs
              personalItems={personalItems}
              sharedItems={sharedItems}
              personalLoading={personalLoading}
              personalError={personalError}
              sharedLoading={sharedLoading}
              sharedError={sharedError}
              onRetryLoadPersonal={handleRetryLoadPersonal}
              onRetryLoadShared={() => void loadKnowledgeBases()}
              onRefresh={handleTabRefresh}
              onDelete={(item) => editor.handleDeleteRequest(item)}
              onOpenView={handleOpenView}
              onOpenEdit={handleOpen}
              onCreate={() => void handleCreate()}
              onStartChat={handleStartChat}
            />
          )}

          <ConfirmModal
            visible={editor.deleteConfirmVisible}
            title={t('settings.knowledgeBaseDeleteTitle', { defaultValue: 'Delete Knowledge Base' })}
            description={t('settings.knowledgeBaseDeleteConfirm', {
              defaultValue: 'Are you sure you want to delete this knowledge base? This action cannot be undone.',
            })}
            okText={t('common.delete', { defaultValue: 'Delete' })}
            cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
            danger
            onCancel={() => editor.setDeleteConfirmVisible(false)}
            onOk={() => void editor.handleDeleteConfirm()}
          >
            {activeKnowledgeBase ? (
              <div className='mt-12px flex items-center gap-12px rounded-lg bg-fill-2 p-12px'>
                <KnowledgeBaseAvatar knowledgeBase={activeKnowledgeBase} size={32} />
                <div>
                  <div className='font-medium'>{activeKnowledgeBase.name}</div>
                  <div className='text-12px text-t-secondary'>{activeKnowledgeBase.description}</div>
                </div>
              </div>
            ) : null}
          </ConfirmModal>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
