/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseEditorViewModel, KnowledgeBaseListItem } from '../types';
import IdentitySection from '../editor/IdentitySection';
import RulesSection from '../editor/RulesSection';
import { SectionCard } from '../editor/sectionPrimitives';
import { isEmoji, resolveIconImageSrc } from '../utils/knowledgeBaseUtils';
import { ipcBridge } from '../utils/ipc';
import { resolveAgentAvatar, useAgentLogos } from '../utils/agentLogo';
import { Avatar, Select, Tag } from '@arco-design/web-react';
import { BookOne, Robot } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export type KnowledgeBaseEditorSectionsProps = {
  editor: KnowledgeBaseEditorViewModel;
  activeKnowledgeBase: KnowledgeBaseListItem | null;
};

const READ_ONLY_LABEL = 'Read only';

const getEditorSelectPopupContainer = (): HTMLElement =>
  // 挂到编辑区里而不是 body,否则下拉会被编辑器自身的滚动容器裁掉。
  // 兜底回 body —— Arco 要求返回元素,不能是 null。
  document.querySelector<HTMLElement>('[data-editor-popup-root]') ?? document.body;

const KnowledgeBaseEditorSections: React.FC<KnowledgeBaseEditorSectionsProps> = ({ editor, activeKnowledgeBase }) => {
  const { t } = useTranslation();
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const logos = useAgentLogos();

  const isBuiltin = activeKnowledgeBase?.source === 'builtin';
  const isIdentityLocked = isBuiltin;
  const isDescriptionReadOnly = isBuiltin;
  const isRulesReadOnly = isBuiltin;
  const isAgentLocked = isBuiltin;

  const editIcon = editor.profile.icon;
  const resolvedIcon = editIcon?.trim();
  const hasEmojiIcon = Boolean(resolvedIcon && isEmoji(resolvedIcon));
  const iconImage = editor.profile.iconImage || resolveIconImageSrc(resolvedIcon);
  const iconSize = 22;
  const emojiSize = 26;

  const renderIconPreview = () => {
    if (iconImage) {
      return (
        <img
          src={iconImage}
          alt=''
          className='h-full w-full rounded-inherit object-cover'
          style={{ display: 'block' }}
        />
      );
    }
    if (hasEmojiIcon) {
      return <span style={{ fontSize: emojiSize }}>{resolvedIcon}</span>;
    }
    return <BookOne theme='outline' size={iconSize} />;
  };

  const handlePickIconImage = async () => {
    // TODO: API - 对接后端接口选择图标图片
    try {
      const result = await ipcBridge.dialog.showOpen.invoke({
        properties: ['openFile'],
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'] }],
      });
      const filePath = Array.isArray(result) ? result[0] : undefined;
      if (filePath) {
        const imageBase64 = await ipcBridge.fs.getImageBase64.invoke({ path: filePath });
        // 后端可能返回 null(文件不是图片 / 读取失败),此时清掉预览,
        // 让 UI 回退到 emoji 图标而不是渲染一个坏掉的 <img>。
        editor.profile.setIconPreview(imageBase64 ?? undefined);
      }
    } catch (error) {
      console.error('Failed to pick icon image:', error);
    }
  };

  const renderAgentAvatar = (backend: (typeof editor.agent.availableBackends)[number]) => {
    const avatar = resolveAgentAvatar(logos, {
      icon: backend.icon,
      custom_agent_id: backend.customAgentId,
      isExtension: backend.isExtension,
      backend: backend.runtimeKey,
    });
    if (avatar.kind === 'image') {
      return <img src={avatar.value} alt='' className='h-16px w-16px object-contain' />;
    }
    if (avatar.kind === 'emoji') {
      return <span className='text-16px leading-none'>{avatar.value}</span>;
    }
    return <Robot theme='outline' size={16} />;
  };

  const rulesContainerHeight = rulesExpanded ? '480px' : '220px';

  return (
    <div className='space-y-14px'>
      {isBuiltin ? (
        <div
          className='flex items-start gap-8px rounded-12px border border-border-2 bg-fill-1 px-14px py-10px text-12px text-t-secondary'
          data-testid='kb-builtin-readonly-banner'
        >
          <Avatar shape='square' size={20} className='!rounded-6px bg-fill-2'>
            <BookOne theme='outline' size={14} />
          </Avatar>
          <div>
            {t('settings.knowledgeBaseBuiltinReadonlyTip', {
              defaultValue: 'This is a built-in knowledge base. You can view its content but cannot modify it.',
            })}
          </div>
        </div>
      ) : null}

      <IdentitySection
        isIdentityLocked={isIdentityLocked}
        isDescriptionReadOnly={isDescriptionReadOnly}
        editIcon={editIcon}
        editName={editor.profile.name}
        setEditName={editor.profile.setName}
        editDescription={editor.profile.description}
        setEditDescription={editor.profile.setDescription}
        setEditIcon={editor.profile.setIcon}
        setEditIconPreview={editor.profile.setIconPreview}
        onPickIconImage={handlePickIconImage}
        renderIconPreview={renderIconPreview}
        builtinIconOptions={editor.profile.builtinIconOptions}
        readOnlyLabel={READ_ONLY_LABEL}
      />

      <SectionCard
        title={t('settings.knowledgeBaseAgentSection', { defaultValue: 'Agent' })}
        legend={{
          label: t('settings.knowledgeBaseAffectsChat', { defaultValue: 'Affects chat' }),
          tone: 'next',
        }}
        readOnlyLabel={isAgentLocked ? READ_ONLY_LABEL : undefined}
        testId='kb-card-agent'
      >
        <div className='flex items-start gap-12px'>
          <div className='w-86px flex-shrink-0 pt-6px text-13px leading-20px text-t-secondary'>
            {t('settings.knowledgeBaseSelectAgent', { defaultValue: 'Agent' })}
          </div>
          <div className='min-w-0 flex-1'>
            {editor.agent.availableBackends.length === 0 ? (
              <div
                className='min-h-32px rounded-8px border border-border-2 bg-fill-1 px-12px py-8px text-13px leading-20px text-t-secondary'
                data-testid='kb-no-agent'
              >
                {t('settings.knowledgeBaseNoAvailableAgent', {
                  defaultValue: 'No available agents',
                })}
              </div>
            ) : (
              <Select
                className='w-full'
                getPopupContainer={getEditorSelectPopupContainer}
                value={editor.agent.value}
                onChange={(value) => editor.agent.setValue(value as string)}
                disabled={isAgentLocked}
                data-testid='select-kb-agent'
                placeholder={t('settings.knowledgeBaseSelectAgent', { defaultValue: 'Select an agent' })}
                renderFormat={(_option, value) => {
                  const selected = editor.agent.availableBackends.find((item) => item.id === value);
                  if (!selected) return (value as string) ?? '';
                  return (
                    <span className='flex items-center gap-8px'>
                      {renderAgentAvatar(selected)}
                      <span className='truncate'>{selected.name}</span>
                    </span>
                  );
                }}
              >
                {editor.agent.availableBackends.map((option) => (
                  <Select.Option key={option.id} value={option.id}>
                    <span className='flex items-center gap-8px'>
                      {renderAgentAvatar(option)}
                      <span className='truncate'>{option.name}</span>
                      {option.isExtension ? (
                        <Tag size='small' color='arcoblue'>
                          ext
                        </Tag>
                      ) : null}
                    </span>
                  </Select.Option>
                ))}
              </Select>
            )}
            <div className='mt-6px text-11px leading-18px text-t-tertiary'>
              {t('settings.knowledgeBaseAgentHint', {
                defaultValue:
                  'Determines which agent powers chat when you start a conversation from this knowledge base.',
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <RulesSection
        isReadOnly={isRulesReadOnly}
        promptViewMode={editor.rules.viewMode}
        setPromptViewMode={editor.rules.setViewMode}
        rulesExpanded={rulesExpanded}
        setRulesExpanded={setRulesExpanded}
        rulesContainerHeight={rulesContainerHeight}
        editContext={editor.rules.content}
        setEditContext={editor.rules.setContent}
        readOnlyLabel={READ_ONLY_LABEL}
      />
    </div>
  );
};

export default KnowledgeBaseEditorSections;
