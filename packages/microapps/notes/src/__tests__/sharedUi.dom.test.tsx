/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * notes 消费共享 UI 层(`@aionui/ui`)的接入验证。
 *
 * 验证两件事:
 *   1. **行为不变** —— 未选中笔记时,空状态照旧渲染标题与提示文案。
 *   2. **契约生效** —— 空状态图标走共享层的 `AppIcon`,因此描边宽度是 3
 *      (icon-park 的原生默认是 4)。这是"主应用与微应用图标一致"的落点:
 *      裸写 `<Notes size={48} theme='outline' />` 拿不到这个契约。
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  // notes 通过 `@renderer/utils/formatRelativeTime` 间接依赖 shell 的 i18n 单例,
  // 后者 `i18n.use(initReactI18next).init(...)` 需要这个导出。这里给个空实现,
  // 避免测试真的去初始化 13 种语言的词条。
  initReactI18next: { type: '3rdParty' as const, init: () => {} },
  useTranslation: () => ({
    // 与 react-i18next 未初始化时的行为一致:有 defaultValue 就用它,没有就返回 key。
    t: (k: string, opts?: Record<string, unknown>) => (typeof opts?.defaultValue === 'string' ? opts.defaultValue : k),
  }),
}));

const listState = vi.hoisted(() => ({
  notebooks: [] as unknown[],
  notes: [] as unknown[],
}));

vi.mock('../hooks/useNotebookList', () => ({
  useNotebookList: () => ({
    notebooks: listState.notebooks,
    notes: listState.notes,
    loading: false,
    error: null,
    getNotesByNotebookId: () => [],
    getNoteById: () => undefined,
    getNotebookById: () => undefined,
    loadNoteContent: vi.fn(),
    createNotebook: vi.fn(),
    renameNotebook: vi.fn(),
    deleteNotebook: vi.fn(),
    createNote: vi.fn(),
    renameNote: vi.fn(),
    updateNoteContent: vi.fn(),
    deleteNote: vi.fn(),
    toggleNoteStar: vi.fn(),
    setNoteStar: vi.fn(),
  }),
}));

vi.mock('../hooks/useNotesEditor', () => ({
  useNotesEditor: () => ({
    activeNoteId: null,
    setActiveNoteId: vi.fn(),
    activeNote: null,
    loadingContent: false,
    selectNote: vi.fn(),
    deselectNote: vi.fn(),
    handleContentChange: vi.fn(),
    commitTitle: vi.fn(),
  }),
}));

vi.mock('../AppContext', () => ({
  useAppContext: () => ({
    token: 'test-token',
    userInfo: { id: 'u1', username: 'tester', permissions: [], tenantId: 't1' },
    systemCode: 'notes-test',
    baseApi: 'http://localhost:0/api',
    shellVersion: '0.0.0',
    theme: 'light',
    locale: 'zh-CN',
    isMobile: false,
    on: () => () => {},
    emit: vi.fn(),
    navigate: vi.fn(),
    navigateExternal: vi.fn(),
  }),
}));

// 独立运行提示条在 shell 托管下不出现,这里直接让它保持关闭。
vi.mock('../components/StandaloneMockNotice', () => ({
  default: () => null,
}));

import NotesPage from '../pages/NotesPage';

describe('notes 接入 @aionui/ui', () => {
  beforeEach(() => {
    listState.notebooks = [];
    listState.notes = [];
  });

  it('未选中笔记时渲染空状态标题', () => {
    render(<NotesPage />);

    expect(screen.getByText('Select a note to start editing')).toBeTruthy();
  });

  it('未选中笔记时渲染空状态提示文案', () => {
    render(<NotesPage />);

    expect(screen.getByText('Choose a note from the sidebar, or create a new one.')).toBeTruthy();
  });

  it('空状态图标走共享层的 AppIcon 契约(描边宽度 3)', () => {
    const { container } = render(<NotesPage />);

    // 必须限定在空状态容器内 —— 页面上还有侧栏等处的裸 icon-park 图标(描边 4)
    const iconBox = container.querySelector('[data-testid="empty-state-icon"]');
    expect(iconBox).toBeTruthy();
    expect(iconBox?.querySelector('path')?.getAttribute('stroke-width')).toBe('3');
  });
});
