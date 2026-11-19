/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 取一条笔记的正文(markdown)。
 *
 * 正文本就不在笔记列表接口里 —— 列表只给元信息(标题 / 摘要 / 标签 / 时间),
 * 正文只有 `notes.raw` 这一条通道(`GET /api/notes/{id}/raw`)。
 *
 * 正开着的那条直接用编辑器手上的内容,其余的现拉一次(拉回来的正文会缓存进
 * 列表状态,之后打开这条笔记就不用再拉)。
 */
import type { NoteItem } from '../api/types';

export type ResolveNoteMarkdownParams = {
  /** 要取正文的笔记。 */
  note: NoteItem;
  /** 编辑器当前打开的是哪条笔记(没打开就是 null)。 */
  activeNoteId: string | null;
  /** 编辑器当前打开的笔记(正文已经在上面时才有 content)。 */
  activeNote: NoteItem | null;
  /** 拉正文的通道(内部就是 `notes.raw`)。 */
  loadNoteContent: (id: string) => Promise<string>;
};

export async function resolveNoteMarkdown(params: ResolveNoteMarkdownParams): Promise<string> {
  const { note, activeNoteId, activeNote, loadNoteContent } = params;
  // 正开着、且正文已经在手上 → 用编辑器那份,不用再发请求。
  if (activeNoteId === note.id && activeNote?.content !== undefined) return activeNote.content;
  return loadNoteContent(note.id);
}
