/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppIcon, MoreMenu } from '@aionui/ui';
import { Input } from '@arco-design/web-react';
import type { RefInputType } from '@arco-design/web-react/es/Input/interface';
import { Down, FolderOpen, Plus } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NoteItemRow from './NoteItem';
import type { NoteItem, Notebook } from '../api/types';

type NotebookItemProps = {
  notebook: Notebook;
  notes: NoteItem[];
  activeNoteId: string | null;
  defaultExpanded?: boolean;
  onSelectNote: (id: string) => void;
  onRenameNotebook: (id: string, name: string) => void;
  onDeleteNotebook: (id: string) => void;
  onCreateNote: (notebookId: string, title: string) => void;
  onRenameNote: (id: string, title: string) => void;
  onDeleteNote: (id: string) => void;
};

const NotebookItem: React.FC<NotebookItemProps> = ({
  notebook,
  notes,
  activeNoteId,
  defaultExpanded = true,
  onSelectNote,
  onRenameNotebook,
  onDeleteNotebook,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(notebook.name);
  const inputRef = useRef<RefInputType | null>(null);

  useEffect(() => {
    setDraftName(notebook.name);
  }, [notebook.name]);

  useEffect(() => {
    if (isEditing) {
      const handle = window.setTimeout(() => {
        const dom = inputRef.current?.dom as HTMLInputElement | undefined;
        inputRef.current?.focus();
        dom?.select();
      }, 0);
      return () => window.clearTimeout(handle);
    }
  }, [isEditing]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== notebook.name) {
      void onRenameNotebook(notebook.id, trimmed);
    }
    setIsEditing(false);
  };

  const cancelName = () => {
    setDraftName(notebook.name);
    setIsEditing(false);
  };

  return (
    <div className='flex flex-col gap-2px'>
      <div
        className={classNames(
          'group flex items-center gap-6px rounded-6px px-6px py-4px text-12px transition-colors',
          'text-t-primary hover:bg-fill-2'
        )}
      >
        <button
          type='button'
          onClick={() => setIsExpanded((prev) => !prev)}
          className='flex h-14px w-14px flex-shrink-0 items-center justify-center'
        >
          <Down
            size={12}
            theme='outline'
            fill='currentColor'
            className={classNames('transition-transform', !isExpanded && '-rotate-90')}
          />
        </button>
        <FolderOpen size={14} theme='outline' fill='currentColor' className='flex-shrink-0' />
        {isEditing ? (
          <Input
            ref={inputRef}
            size='mini'
            value={draftName}
            onChange={setDraftName}
            onPressEnter={commitName}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelName();
            }}
            placeholder={t('settings.notesNotebookPlaceholder', { defaultValue: 'Notebook name' })}
            className='flex-1'
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className='flex-1 truncate font-500'>
            {notebook.name}
            <span className='ml-4px text-t-secondary font-400'>({notes.length})</span>
          </span>
        )}
        {!isEditing && (
          <>
            <button
              type='button'
              title={t('settings.notesNewNote', { defaultValue: 'New Note' })}
              onClick={(e) => {
                e.stopPropagation();
                void onCreateNote(notebook.id, '未命名笔记');
              }}
              className='flex h-18px w-18px flex-shrink-0 cursor-pointer items-center justify-center rounded-4px opacity-0 transition-opacity hover:bg-fill-3 group-hover:!opacity-100'
            >
              <Plus size={12} theme='outline' fill='currentColor' />
            </button>
            <MoreMenu
              items={[
                { key: 'rename', label: t('settings.notesRename', { defaultValue: 'Rename' }) },
                {
                  key: 'delete',
                  label: t('settings.notesDeleteNotebook', { defaultValue: 'Delete Notebook' }),
                  danger: true,
                },
              ]}
              label={t('common.more', { defaultValue: 'More' })}
              icon={<AppIcon name='more-one' size={12} />}
              onSelect={(key) => {
                if (key === 'rename') setIsEditing(true);
                else if (key === 'delete') onDeleteNotebook(notebook.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className='!h-18px !w-18px flex-shrink-0 opacity-0 transition-opacity group-hover:!opacity-100'
            />
          </>
        )}
      </div>
      {isExpanded && (
        <div className='flex flex-col gap-2px pl-22px'>
          {notes.map((note) => (
            <NoteItemRow
              key={note.id}
              note={note}
              isActive={activeNoteId === note.id}
              onSelect={onSelectNote}
              onRename={onRenameNote}
              onDelete={onDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotebookItem;
