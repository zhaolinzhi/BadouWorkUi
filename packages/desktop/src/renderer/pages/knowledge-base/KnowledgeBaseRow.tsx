/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { KnowledgeBaseItem } from './types';
import KnowledgeBaseAvatar from './KnowledgeBaseAvatar';
import { Button, Dropdown, Menu } from '@arco-design/web-react';
import { MoreOne } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type KnowledgeBaseRowProps = {
  item: KnowledgeBaseItem;
  onEdit: (item: KnowledgeBaseItem) => void;
  onDelete: (item: KnowledgeBaseItem) => void;
  /** Handler invoked when the row body is clicked. */
  onOpen: (item: KnowledgeBaseItem) => void;
  /** Handler invoked when the "edit" menu item is clicked. Falls back to
   *  onOpen when not provided, so callers that want both entry points to
   *  share a destination can pass only onOpen. */
  onOpenEdit?: (item: KnowledgeBaseItem) => void;
  onStartChat: (item: KnowledgeBaseItem) => void;
  /** Hides the edit/delete more menu — used for read-only shared bases. */
  readonly?: boolean;
  /** Hides the delete menu item. Used by the personal and shared KB lists,
   *  which do not expose in-app delete. The more menu (with the edit item)
   *  is still rendered. */
  hideDelete?: boolean;
  /** Hides the more menu entirely (no "edit"/"delete" button rendered).
   *  Used by the shared KB list, which does not expose in-app editing. */
  noMenu?: boolean;
};

/**
 * A single row in the knowledge base list. Clicking the row opens detail;
 * the more menu exposes edit/delete (when allowed); the chat button starts a
 * conversation using the knowledge base's configured agent.
 */
const KnowledgeBaseRow: React.FC<KnowledgeBaseRowProps> = ({
  item,
  onEdit,
  onDelete,
  onOpen,
  onOpenEdit,
  onStartChat,
  readonly = false,
  hideDelete = false,
  noMenu = false,
}) => {
  const { t } = useTranslation();
  const canDelete = !readonly && !hideDelete && item.source !== 'builtin';

  const actionMenu = (
    <Menu
      onClickMenuItem={(key) => {
        // The "edit" menu item routes to onOpenEdit (when provided) or
        // falls back to onOpen. The row click separately calls onOpen, so
        // the two entry points can land on different destinations — e.g.
        // personal KBs use onOpen (view URL) for the row and onOpenEdit
        // (edit URL) for the menu.
        if (key === 'edit') (onOpenEdit ?? onOpen)(item);
        if (key === 'delete') onDelete(item);
      }}
    >
      <Menu.Item key='edit'>
        <span data-testid={`kb-menu-edit-${item.id}`}>{t('common.edit', { defaultValue: 'Edit' })}</span>
      </Menu.Item>
      {canDelete ? (
        <Menu.Item key='delete'>
          <span data-testid={`kb-menu-delete-${item.id}`} className='text-[rgb(var(--danger-6))]'>
            {t('common.delete', { defaultValue: 'Delete' })}
          </span>
        </Menu.Item>
      ) : null}
    </Menu>
  );

  return (
    <div
      data-testid={`kb-card-${item.id}`}
      className='group flex cursor-pointer items-center justify-between gap-12px rounded-12px border border-solid border-transparent bg-base px-14px py-12px transition-all duration-180 hover:border-border-2'
      onClick={() => onOpen(item)}
    >
      <div className='flex min-w-0 flex-1 items-center gap-12px'>
        <KnowledgeBaseAvatar knowledgeBase={item} size={36} />
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-8px'>
            <span className='truncate text-14px font-medium text-t-primary'>{item.name}</span>
            {typeof item.documentCount === 'number' ? (
              <span className='rounded-999px bg-fill-2 px-6px py-1px text-10px font-500 text-t-tertiary'>
                {t('settings.knowledgeBaseDocumentCount', {
                  count: item.documentCount,
                  defaultValue: `${item.documentCount} docs`,
                })}
              </span>
            ) : null}
          </div>
          <div className='truncate text-12px text-t-secondary'>{item.description || ''}</div>
        </div>
        {item.updatedAt ? (
          <div className='hidden flex-shrink-0 text-11px text-t-tertiary sm:block'>{item.updatedAt}</div>
        ) : null}
      </div>
      <div className='ml-10px flex flex-shrink-0 items-center gap-8px' onClick={(e) => e.stopPropagation()}>
        <Button
          type='text'
          size='small'
          data-testid={`btn-kb-chat-${item.id}`}
          className='!inline-flex !h-28px !items-center !justify-center !rounded-8px !bg-fill-2 !px-12px !leading-none !text-t-secondary !opacity-100 hover:!bg-primary-6 hover:!text-white'
          onClick={() => onStartChat(item)}
        >
          {t('settings.knowledgeBaseGoChat', { defaultValue: 'Chat' })}
        </Button>
        {readonly || noMenu ? null : (
          <Dropdown droplist={actionMenu} trigger='click' position='br' getPopupContainer={() => document.body}>
            <Button
              type='text'
              size='small'
              icon={<MoreOne theme='outline' size='16' fill='currentColor' />}
              aria-label={t('common.more', { defaultValue: 'More' })}
              className='!flex !h-30px !w-30px !items-center !justify-center !rounded-8px !p-0 !text-t-tertiary hover:!bg-fill-2 hover:!text-t-primary'
              data-testid={`btn-kb-more-${item.id}`}
            />
          </Dropdown>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseRow;
