/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import { AppIcon, AsyncBoundary, ConfirmModal, EmptyState } from '@aionui/ui';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../AppContext';
import { useKnowledgeBaseOptions } from '../hooks/useKnowledgeBaseOptions';
import { useNotebookList } from '../hooks/useNotebookList';
import { useNotesEditor } from '../hooks/useNotesEditor';
import { uploadDocumentToKnowledgeBase, type KnowledgeBaseOption } from '../api/knowledgeBases';
import type { NoteItem } from '../api/types';
import { isStandaloneMockActive, mockUploadDocumentToKnowledgeBase } from '../__qiankun__/standaloneMock';
import NotesListPanel from '../components/NotesListPanel';
import StandaloneMockNotice from '../components/StandaloneMockNotice';
import VditorEditor from '../components/VditorEditor';
import { resolveNoteMarkdown } from './resolveNoteMarkdown';
import styles from './NotesPage.module.css';

const NotesPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useAppContext();
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  // Arco 把 useMessage 的返回方法标成可选(见知识库微应用 useKnowledgeBaseEditor
  // 里的同一个处理),这里统一当成必选来用。
  const [messageApi, messageContext] = Message.useMessage({ maxCount: 3 });
  const message = messageApi as Required<typeof messageApi>;

  const list = useNotebookList();
  // 「添加到知识库」下拉里的知识库列表:页面级状态,菜单只负责渲染。
  const knowledgeBases = useKnowledgeBaseOptions();
  const editor = useNotesEditor({
    notes: list.notes,
    updateNoteContent: list.updateNoteContent,
    loadNoteContent: list.loadNoteContent,
    renameNote: list.renameNote,
  });
  const { activeNote } = editor;

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

  /** 右键菜单「移动到笔记本」—— 把笔记挪到另一个分组。 */
  const handleMoveNoteToNotebook = useCallback(
    (id: string, notebookId: string) => {
      void list.moveNoteToNotebook(id, notebookId);
    },
    [list]
  );

  /**
   * 新建分组。
   *
   * `moveNoteId` 不为空时(右键菜单「移动到笔记本 › 新建笔记本」),建好把这条
   * 笔记挪进新分组;分组区的「+」新建出来的是空分组。
   */
  const handleCreateNotebook = useCallback(
    async (name: string, moveNoteId: string | null) => {
      try {
        const notebook = await list.createNotebook(name);
        if (moveNoteId) await list.moveNoteToNotebook(moveNoteId, notebook.id);
      } catch (error) {
        console.error('[NotesPage] create notebook failed', error);
      }
    },
    [list]
  );

  /** 重命名分组。 */
  const handleRenameNotebook = useCallback(
    async (id: string, name: string) => {
      try {
        await list.renameNotebook(id, name);
      } catch (error) {
        console.error('[NotesPage] rename notebook failed', error);
      }
    },
    [list]
  );

  /** 删除分组 —— 连同组里的笔记一起没了。 */
  const handleDeleteNotebook = useCallback(
    async (id: string) => {
      try {
        await list.deleteNotebook(id);
      } catch (error) {
        console.error('[NotesPage] delete notebook failed', error);
      }
    },
    [list]
  );

  /**
   * 右键菜单「添加到知识库 › 某个知识库」。
   *
   * 流程:取笔记正文(markdown)→ 当成 .md 文件上传到目标知识库。
   * 正文本就不在列表接口里,只有 `notes.raw` 这一条通道 —— 见
   * `resolveNoteMarkdown`。
   */
  const handleAddToKnowledgeBase = useCallback(
    async (knowledgeBase: KnowledgeBaseOption, note: NoteItem) => {
      try {
        const markdown = await resolveNoteMarkdown({
          note,
          activeNoteId: editor.activeNoteId,
          activeNote: editor.activeNote,
          loadNoteContent: list.loadNoteContent,
        });
        const fileName = `${(note.title || 'note').replace(/[\\/:*?"<>|]/g, '_')}.md`;
        if (isStandaloneMockActive()) {
          // 独立运行模式没有后端 —— 假装上传成功。
          mockUploadDocumentToKnowledgeBase({
            knowledgeBaseId: knowledgeBase.id,
            fileName,
            bytes: markdown.length,
          });
        } else {
          await uploadDocumentToKnowledgeBase({
            knowledgeBaseId: knowledgeBase.id,
            token: ctx.token,
            fileName,
            content: markdown,
          });
        }
        message.success(t('settings.notesContextMenuKnowledgeBaseAddSuccess', { defaultValue: '已添加到知识库' }));
      } catch (error) {
        console.error('[NotesPage] 加入知识库失败', error);
        message.error(t('settings.notesContextMenuKnowledgeBaseAddFailed', { defaultValue: '添加到知识库失败' }));
      }
    },
    [ctx.token, editor, list, message, t]
  );

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
        {messageContext}
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
            onMoveNoteToNotebook={handleMoveNoteToNotebook}
            onCreateNotebook={handleCreateNotebook}
            onRenameNotebook={handleRenameNotebook}
            onDeleteNotebook={handleDeleteNotebook}
            knowledgeBaseMenu={knowledgeBases}
            onRequestKnowledgeBases={knowledgeBases.ensureLoaded}
            onAddToKnowledgeBase={handleAddToKnowledgeBase}
          />
          <div className='flex min-w-0 flex-1 flex-col'>
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
