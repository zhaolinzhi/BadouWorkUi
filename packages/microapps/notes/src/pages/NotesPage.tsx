/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import { AppHeader, AppIcon, AsyncBoundary, ConfirmModal, EmptyState } from '@aionui/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { useNotebookList } from '../hooks/useNotebookList';
import { useNotesEditor } from '../hooks/useNotesEditor';
import NotesListPanel from '../components/NotesListPanel';
import NotesHint from '../components/NotesHint';
import StandaloneMockNotice from '../components/StandaloneMockNotice';
import VditorEditor from '../components/VditorEditor';
import styles from './NotesPage.module.css';

const NotesPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

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

  /**
   * 新建笔记 —— 界面上没有笔记本层级了,笔记统一落到第一个笔记本;
   * 一个笔记本都没有时先建一个默认笔记本,让笔记有落点。
   */
  const handleCreateNote = useCallback(async () => {
    const title = t('settings.notesUntitled', { defaultValue: 'Untitled note' });
    try {
      const notebookId = list.notebooks[0]?.id;
      if (!notebookId) {
        const notebook = await list.createNotebook(t('settings.notesDefaultNotebook', { defaultValue: 'My notes' }));
        const created = await list.createNote(notebook.id, title);
        editor.selectNote(created.id);
        return;
      }
      const created = await list.createNote(notebookId, title);
      editor.selectNote(created.id);
    } catch (error) {
      console.error('[NotesPage] create note failed', error);
    }
  }, [editor, list, t]);

  const requestDeleteNote = useCallback(
    (id: string) => {
      if (activeNote?.id === id) editor.deselectNote();
      setDeleteNoteId(id);
    },
    [activeNote, editor]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteNoteId) return;
    void list.deleteNote(deleteNoteId);
    setDeleteNoteId(null);
  }, [deleteNoteId, list]);

  const handleDeleteCancel = useCallback(() => setDeleteNoteId(null), []);

  return (
    /*
     * 根节点是**列**:最上面是独立运行模式的「演示数据」提示条(被 shell 托管时
     * 它返回 null,不占位),下面一行才是「列表 + 编辑器」。
     *
     * 高度链:外层 h-full → 行 flex-1 + min-h-0 → 列表面板 height:100% / 编辑器
     * flex-1。少任何一环,子应用都会退化成内容高度(下方留白)。
     *
     * loading / error 交给共享层的 `AsyncBoundary` 渲染 —— 它固定「loading >
     * error > content」的优先级,顺带保证出错时不会把上一次的列表露出来。
     */
    <AsyncBoundary
      loading={list.loading}
      error={list.error}
      errorContent={t('common.error', { defaultValue: 'Error' })}
      className='h-full min-h-0 justify-center'
    >
      <div className='flex h-full min-h-0 flex-col overflow-hidden bg-transparent'>
        <StandaloneMockNotice />
        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <NotesListPanel
            notes={list.notes}
            notebooks={list.notebooks}
            activeNoteId={editor.activeNoteId}
            onSelectNote={editor.selectNote}
            onCreateNote={() => void handleCreateNote()}
            onToggleStar={(id) => void list.toggleNoteStar(id)}
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
            visible={deleteNoteId !== null}
            title={t('settings.notesDeleteNote', { defaultValue: 'Delete Note' })}
            description={t('settings.notesDeleteNoteConfirm', {
              defaultValue: 'Are you sure you want to delete this note?',
            })}
            okText={t('common.delete', { defaultValue: 'Delete' })}
            cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
            danger
            onCancel={handleDeleteCancel}
            onOk={handleDeleteConfirm}
          />
        </div>
      </div>
    </AsyncBoundary>
  );
};

export default NotesPage;
