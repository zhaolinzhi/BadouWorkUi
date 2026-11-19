/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「加入知识库」前取笔记正文的规则。
 *
 * 锁三件事:
 *   1. 正开着的那条 → 用编辑器手上的正文,不再发请求。
 *   2. 没开着的 → 走 `notes.raw` 拉一次。
 *   3. 正开着但正文还没加载出来 → 照样去拉(不能返回空正文)。
 */
import { describe, expect, it, vi } from 'vitest';
import type { NoteItem } from '../../api/types';
import { resolveNoteMarkdown } from '../resolveNoteMarkdown';

const now = new Date().toISOString();

const makeNote = (id: string, content?: string): NoteItem => ({
  id,
  title: `note ${id}`,
  notebookId: 'nb-1',
  filePath: `/tmp/${id}.md`,
  summary: '',
  tags: [],
  star: false,
  createdAt: now,
  updatedAt: now,
  ...(content === undefined ? {} : { content }),
});

describe('resolveNoteMarkdown', () => {
  it('正开着的那条:用编辑器手上的正文,不再发请求', async () => {
    const loadNoteContent = vi.fn(async () => 'raw 内容');
    const note = makeNote('n-1', '编辑器里的内容');

    const markdown = await resolveNoteMarkdown({
      note,
      activeNoteId: 'n-1',
      activeNote: note,
      loadNoteContent,
    });

    expect(markdown).toBe('编辑器里的内容');
    expect(loadNoteContent).not.toHaveBeenCalled();
  });

  it('没开着的那条:走 raw 拉一次', async () => {
    const loadNoteContent = vi.fn(async () => 'raw 内容');
    const note = makeNote('n-2');

    const markdown = await resolveNoteMarkdown({
      note,
      activeNoteId: 'n-1',
      activeNote: makeNote('n-1', '别的笔记'),
      loadNoteContent,
    });

    expect(markdown).toBe('raw 内容');
    expect(loadNoteContent).toHaveBeenCalledWith('n-2');
  });

  it('正开着但正文还没加载出来:照样去拉,不能返回空正文', async () => {
    const loadNoteContent = vi.fn(async () => 'raw 内容');
    const note = makeNote('n-1');

    const markdown = await resolveNoteMarkdown({
      note,
      activeNoteId: 'n-1',
      activeNote: note,
      loadNoteContent,
    });

    expect(markdown).toBe('raw 内容');
    expect(loadNoteContent).toHaveBeenCalledWith('n-1');
  });
});
