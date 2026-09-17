/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAgentLogos } from '@/renderer/utils/model/agentLogo';
import FlexFullContainer from '@/renderer/components/layout/FlexFullContainer';
import { usePresetAssistantInfo } from '@/renderer/hooks/agent/usePresetAssistantInfo';
import { CronJobIndicator } from '@/renderer/pages/cron';
import { resolveConversationLeadingMark } from '@/renderer/pages/conversation/utils/conversationAssistantIdentity';
import { cleanupSiderTooltips } from '@/renderer/utils/ui/siderTooltip';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { Checkbox, Dropdown, Menu, Spin, Tooltip } from '@arco-design/web-react';
import { DeleteOne, EditOne, Export, MessageOne, MoreOne, Pushpin, Robot, Timer } from '@icon-park/react';
import ForkBranchIcon from '@renderer/components/base/ForkBranchIcon';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConversationRowProps } from './types';
import { isConversationPinned } from './utils/groupingHelpers';

const ConversationRow: React.FC<ConversationRowProps> = (props) => {
  const {
    conversation,
    isGenerating,
    hasCompletionUnread,
    batchMode,
    checked,
    selected,
    menuVisible,
    dimIcon = false,
    dragHandle,
  } = props;
  const logos = useAgentLogos();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const {
    onToggleChecked,
    onConversationClick,
    onOpenMenu,
    onMenuVisibleChange,
    onEditStart,
    onCreateCronTask,
    onDelete,
    onExport,
    onTogglePin,
    getJobStatus,
  } = props;
  const { t } = useTranslation();
  const { info: assistantInfo } = usePresetAssistantInfo(conversation);
  const isPinned = isConversationPinned(conversation);
  // Fork-lineage badge: present only on forked conversations (extra.fork is
  // server-minted by the fork API). Parent name resolves from the loaded
  // sidebar list; a deleted/unloaded parent degrades to the generic tip.
  const forkLineage = (conversation.extra as { fork?: { parent_conversation_id?: string } } | undefined)?.fork;
  const forkParentName = forkLineage?.parent_conversation_id
    ? props.resolveConversationName?.(forkLineage.parent_conversation_id)
    : undefined;
  const cronStatus = getJobStatus(conversation.id);

  const renderLeadingIcon = () => {
    if (cronStatus !== 'none') {
      return <CronJobIndicator status={cronStatus} size={16} className='flex-shrink-0' />;
    }

    // When the row is pinned, hovering reveals an overlay on the leading icon —
    // the drag handle when the row is sortable, otherwise a pushpin marker.
    // We dim the resting icon on hover so the overlay reads cleanly.
    const pinnedHoverFade = isPinned ? 'group-hover:opacity-0 transition-opacity' : '';
    const composedClass = classNames(pinnedHoverFade);

    const leadingMark = resolveConversationLeadingMark(conversation, assistantInfo, logos);
    if (leadingMark.kind === 'emoji') {
      return (
        <span className={classNames('text-16px leading-none flex-shrink-0', composedClass)}>{leadingMark.value}</span>
      );
    }
    if (leadingMark.kind === 'image') {
      return (
        <img
          src={leadingMark.value}
          alt={leadingMark.label}
          className={classNames('w-16px h-16px rounded-50% flex-shrink-0', composedClass)}
        />
      );
    }
    if (leadingMark.kind === 'assistant_fallback') {
      return (
        <Robot
          theme='outline'
          size='16'
          className={classNames('line-height-0 flex-shrink-0 text-t-secondary', composedClass)}
        />
      );
    }

    return (
      <MessageOne
        theme='outline'
        size='16'
        className={classNames('line-height-0 flex-shrink-0 text-t-secondary', composedClass)}
      />
    );
  };

  const handleRowClick = () => {
    cleanupSiderTooltips();
    if (batchMode) {
      onToggleChecked(conversation);
      return;
    }
    onConversationClick(conversation);
  };

  const handleRowContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupSiderTooltips();
    if (batchMode) {
      return;
    }
    onOpenMenu(conversation);
  };

  const renderCompletionUnreadDot = () => {
    if (batchMode || !hasCompletionUnread || isGenerating) {
      return null;
    }

    return (
      <span className='absolute right-8px top-1/2 -translate-y-1/2 flex items-center justify-center group-hover:hidden'>
        <span className='h-8px w-8px rounded-full bg-#2C7FFF shadow-[0_0_0_2px_rgba(44,127,255,0.18)]' />
      </span>
    );
  };

  // Single unified render. The sider's collapsed/expanded look is driven by
  // the `.collapsed` ancestor class on `ArcoLayout.Sider` — name + menu are
  // hidden via the existing `.collapsed-hidden` / `.\!collapsed-hidden` CSS,
  // row padding/justify-content via the unified rules in `layout.css`. This
  // keeps the React subtree structurally identical between states so a sider
  // toggle does not unmount/remount the tooltip/dropdown tree per row.
  return (
    <div
      id={'c-' + conversation.id}
      className={classNames(
        'chat-history__item h-34px rd-8px group cursor-pointer relative overflow-hidden shrink-0 conversation-item [&.conversation-item+&.conversation-item]:mt-2px min-w-0 transition-colors',
        {
          'hover:bg-fill-3': !batchMode && !selected,
          '!bg-fill-3': selected,
          'bg-[rgba(var(--primary-6),0.08)]': batchMode && checked,
        }
      )}
      data-dim-icon={dimIcon ? 'true' : undefined}
      data-name={conversation.name || undefined}
      onClick={handleRowClick}
      onContextMenu={handleRowContextMenu}
    >
      {batchMode && (
        <span
          className='mr-8px flex-center'
          onClick={(event) => {
            event.stopPropagation();
            onToggleChecked(conversation);
          }}
        >
          <Checkbox checked={checked} />
        </span>
      )}
      <span className='size-22px flex items-center justify-center shrink-0 relative'>
        {isGenerating && !batchMode ? <Spin size={16} /> : renderLeadingIcon()}
        {!batchMode &&
          isPinned &&
          !isMobile &&
          !isGenerating &&
          (dragHandle ?? (
            <span
              className='absolute inset-0 flex-center text-t-secondary pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity'
              style={{ lineHeight: 0 }}
            >
              <Pushpin theme='outline' size='14' />
            </span>
          ))}
      </span>
      <FlexFullContainer className='h-24px min-w-0 flex-1 collapsed-hidden'>
        {/* Native title for truncated-name tooltip — zero React/Arco cost so
              it stays available when the row's toggle-derived props are
              removed (the row no longer subscribes to sider state). */}
        <div
          className='chat-history__item-name overflow-hidden text-ellipsis flex items-center gap-4px w-full text-14px font-[500] lh-24px whitespace-nowrap min-w-0 text-t-primary'
          title={conversation.name}
        >
          <span className='block overflow-hidden text-ellipsis whitespace-nowrap min-w-0'>{conversation.name}</span>
          {forkLineage && (
            <Tooltip
              content={
                forkParentName
                  ? t('conversation.history.forkedFrom', { name: forkParentName })
                  : t('conversation.history.forkedConversation')
              }
              position='top'
            >
              <span className='flex-shrink-0 line-height-0 text-t-tertiary' data-testid='conversation-fork-badge'>
                <ForkBranchIcon size={12} />
              </span>
            </Tooltip>
          )}
        </div>
      </FlexFullContainer>

      {renderCompletionUnreadDot()}
      {!batchMode && (
        <div
          className={classNames(
            'absolute right-8px top-1/2 -translate-y-1/2 items-center justify-end !collapsed-hidden',
            {
              flex: isMobile || menuVisible,
              'hidden group-hover:flex': !isMobile && !menuVisible,
            }
          )}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Dropdown
            droplist={
              <Menu
                onClickMenuItem={(key) => {
                  if (key === 'pin') {
                    onTogglePin(conversation);
                    return;
                  }
                  if (key === 'rename') {
                    onEditStart(conversation);
                    return;
                  }
                  if (key === 'createCronTask') {
                    onCreateCronTask(conversation);
                    return;
                  }
                  if (key === 'export') {
                    onExport?.(conversation);
                    return;
                  }
                  if (key === 'delete') {
                    onDelete(conversation.id);
                  }
                }}
              >
                <Menu.Item key='pin'>
                  <div className='flex items-center gap-8px'>
                    <Pushpin theme='outline' size='14' />
                    <span>{isPinned ? t('conversation.history.unpin') : t('conversation.history.pin')}</span>
                  </div>
                </Menu.Item>
                <Menu.Item key='rename'>
                  <div className='flex items-center gap-8px'>
                    <EditOne theme='outline' size='14' />
                    <span>{t('conversation.history.rename')}</span>
                  </div>
                </Menu.Item>
                <Menu.Item key='createCronTask'>
                  <div className='flex items-center gap-8px'>
                    <Timer theme='outline' size='14' />
                    <span>{t('conversation.history.createCronTask')}</span>
                  </div>
                </Menu.Item>
                {onExport && (
                  <Menu.Item key='export'>
                    <div className='flex items-center gap-8px'>
                      <Export theme='outline' size='14' />
                      <span>{t('conversation.history.export')}</span>
                    </div>
                  </Menu.Item>
                )}
                <Menu.Item key='delete'>
                  <div className='flex items-center gap-8px text-[rgb(var(--warning-6))]'>
                    <DeleteOne theme='outline' size='14' />
                    <span>{t('conversation.history.deleteTitle')}</span>
                  </div>
                </Menu.Item>
              </Menu>
            }
            trigger='click'
            position='br'
            popupVisible={menuVisible}
            onVisibleChange={(visible) => onMenuVisibleChange(conversation.id, visible)}
            getPopupContainer={() => document.body}
            unmountOnExit={false}
          >
            <span
              data-testid={`conversation-row-menu-${conversation.id}`}
              className={classNames(
                'flex-center cursor-pointer transition-colors text-t-secondary hover:text-t-primary size-20px rd-4px sider-action-btn',
                {
                  flex: isMobile || menuVisible,
                  'hidden group-hover:flex': !isMobile && !menuVisible,
                }
              )}
              onClick={(event) => {
                event.stopPropagation();
                onOpenMenu(conversation);
              }}
            >
              <MoreOne theme='outline' size='14' fill='currentColor' className='block leading-none' />
            </span>
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default React.memo(ConversationRow);
