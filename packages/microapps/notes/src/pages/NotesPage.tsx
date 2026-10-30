/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spin } from '@arco-design/web-react';
import { AppHeader, AppIcon, ConfirmModal, EmptyState } from '@aionui/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { useNotebookList } from '../hooks/useNotebookList';
import { useNotesEditor } from '../hooks/useNotesEditor';
import NotesSidebar from '../components/NotesSidebar';
import NotesHint from '../components/NotesHint';
import StandaloneMockNotice from '../components/StandaloneMockNotice';
import VditorEditor from '../components/VditorEditor';
import styles from './NotesPage.module.css';

type DeleteTarget = { type: 'notebook' | 'note'; id: string };

const NotesPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const list = useNotebookList();
  const editor = useNotesEditor({
    notes: list.notes,
    updateNoteContent: list.updateNoteContent,
    loadNoteContent: list.loadNoteContent,
    renameNote: list.renameNote,
  });
  const { activeNote } = editor;

  const handleBack = useCallback(() => {
    ctx.navigate('/guid');
  }, [ctx]);

  const handleExport = useCallback(() => {
    if (!activeNote) return;
    // The list response omits the body — fall back to the lazily loaded content.
    const blob = new Blob([activeNote.content ?? ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (activeNote.title || 'note').replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${safeTitle}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeNote]);

  const handleClear = useCallback(() => {
    if (!activeNote) return;
    setClearModalVisible(true);
  }, [activeNote]);

  const handleClearConfirm = useCallback(() => {
    if (activeNote) {
      void list.updateNoteContent(activeNote.id, '');
    }
    setClearModalVisible(false);
  }, [activeNote, list]);

  const requestDeleteNotebook = useCallback((id: string) => setDeleteTarget({ type: 'notebook', id }), []);
  const requestDeleteNote = useCallback(
    (id: string) => {
      if (activeNote?.id === id) editor.deselectNote();
      setDeleteTarget({ type: 'note', id });
    },
    [activeNote, editor]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'notebook') {
      void list.deleteNotebook(deleteTarget.id);
    } else {
      void list.deleteNote(deleteTarget.id);
    }
    setDeleteTarget(null);
  }, [deleteTarget, list]);

  const handleDeleteCancel = useCallback(() => setDeleteTarget(null), []);

  if (list.loading) {
    return (
      <div className='flex h-full min-h-0 items-center justify-center bg-transparent'>
        <Spin />
      </div>
    );
  }

  if (list.error) {
    return (
      <div className='flex h-full min-h-0 items-center justify-center bg-transparent p-24px text-t-secondary'>
        {list.error}
      </div>
    );
  }

  return (
    /*
     * 根节点是**列**:最上面是独立运行模式的「演示数据」提示条(被 shell 托管时
     * 它返回 null,不占位),下面一行才是「侧栏 + 编辑器」。
     *
     * 高度链:外层 h-full → 行 flex-1 + min-h-0 → 侧栏 height:100% / 编辑器
     * flex-1。少任何一环,子应用都会退化成内容高度(下方留白)。
     */
    <div className='flex h-full min-h-0 flex-col overflow-hidden bg-transparent'>
      <StandaloneMockNotice />
      <div className='flex min-h-0 flex-1 overflow-hidden'>
        <NotesSidebar
          notebooks={list.notebooks}
          notes={list.notes}
          activeNoteId={editor.activeNoteId}
          onSelectNote={editor.selectNote}
          onCreateNotebook={list.createNotebook}
          onRenameNotebook={list.renameNotebook}
          onDeleteNotebook={requestDeleteNotebook}
          onCreateNote={list.createNote}
          onRenameNote={list.renameNote}
          onDeleteNote={requestDeleteNote}
        />
        <div className='flex min-w-0 flex-1 flex-col'>
          <AppHeader
            leading={
              <Button
                type='text'
                icon={<AppIcon name='arrow-left' />}
                onClick={handleBack}
                className='!flex !items-center !gap-4px !rounded-8px !px-6px !text-t-primary'
              >
                {t('common.back', { defaultValue: 'Back' })}
              </Button>
            }
            title={activeNote?.title ?? t('settings.notes', { defaultValue: 'Notes' })}
            trailing={
              <>
                <Button
                  icon={<AppIcon name='download' />}
                  onClick={handleExport}
                  disabled={!activeNote}
                  className='!rounded-8px'
                >
                  {t('settings.notesExport', { defaultValue: 'Export' })}
                </Button>
                <Button
                  status='danger'
                  icon={<AppIcon name='delete' />}
                  onClick={handleClear}
                  disabled={!activeNote}
                  className='!rounded-8px'
                  style={{ backgroundColor: 'rgb(var(--danger-1))' }}
                >
                  {t('settings.notesClear', { defaultValue: 'Clear' })}
                </Button>
              </>
            }
          />
          {activeNote && <NotesHint />}
          <div className={styles.editorContainer}>
            {activeNote ? (
              <VditorEditor
                key={activeNote.id}
                value={activeNote.content ?? ''}
                onChange={(value) => void editor.handleContentChange(activeNote.id, value)}
                onBlur={() => editor.commitTitle(activeNote.id)}
                onLeaveFirstLine={(content) => editor.commitTitle(activeNote.id, content)}
                theme={ctx.theme}
                placeholder={t('settings.notesPlaceholder', { defaultValue: 'Start writing in Markdown...' })}
              />
            ) : (
              <EmptyState
                icon={<AppIcon name='notes' size={48} />}
                title={t('settings.notesNoSelection', { defaultValue: 'Select a note to start editing' })}
                description={t('settings.notesNoSelectionHint', {
                  defaultValue: 'Choose a note from the sidebar, or create a new one.',
                })}
              />
            )}
          </div>
        </div>
        <ConfirmModal
          visible={clearModalVisible}
          title={t('common.confirmDelete', { defaultValue: 'Confirm Delete' })}
          description={t('settings.notesClearConfirm', { defaultValue: 'Are you sure you want to clear the note?' })}
          okText={t('settings.notesClear', { defaultValue: 'Clear' })}
          cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
          danger
          onCancel={() => setClearModalVisible(false)}
          onOk={handleClearConfirm}
        />
        <ConfirmModal
          visible={deleteTarget !== null}
          title={
            deleteTarget?.type === 'notebook'
              ? t('settings.notesDeleteNotebook', { defaultValue: 'Delete Notebook' })
              : t('settings.notesDeleteNote', { defaultValue: 'Delete Note' })
          }
          description={
            deleteTarget?.type === 'notebook'
              ? t('settings.notesDeleteNotebookConfirm', {
                  defaultValue: 'Are you sure you want to delete this notebook and all its notes?',
                })
              : t('settings.notesDeleteNoteConfirm', { defaultValue: 'Are you sure you want to delete this note?' })
          }
          okText={t('common.delete', { defaultValue: 'Delete' })}
          cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
          danger
          onCancel={handleDeleteCancel}
          onOk={handleDeleteConfirm}
        />
      </div>
    </div>
  );
};

export default NotesPage;
