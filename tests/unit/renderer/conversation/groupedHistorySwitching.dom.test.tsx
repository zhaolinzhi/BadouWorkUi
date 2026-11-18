/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@/renderer/pages/cron', () => ({
  useCronJobsMap: () => ({ getJobStatus: () => 'none', markAsRead: vi.fn(), setActiveConversation: vi.fn() }),
  CronJobIndicator: () => null,
}));

vi.mock('@/renderer/pages/conversation/GroupedHistory/hooks/useConversations', () => ({
  useConversations: () => mocks.useConversations(),
}));

vi.mock('@/renderer/pages/conversation/GroupedHistory/hooks/useBatchSelection', () => ({
  useBatchSelection: () => ({
    selectedConversationIds: new Set<string>(),
    setSelectedConversationIds: vi.fn(),
    selectedCount: 0,
    allSelected: false,
    toggleSelectedConversation: vi.fn(),
    toggleSelectAll: vi.fn(),
  }),
}));

vi.mock('@/renderer/pages/conversation/GroupedHistory/hooks/useConversationActions', () => ({
  useConversationActions: () => ({
    renameModalVisible: false,
    renameModalName: '',
    renameLoading: false,
    dropdownVisibleId: null,
    handleConversationClick: vi.fn(),
    handleDeleteClick: vi.fn(),
    handleBatchDelete: vi.fn(),
    handleEditStart: vi.fn(),
    handleRenameConfirm: vi.fn(),
    handleRenameCancel: vi.fn(),
    handleTogglePin: vi.fn(),
    handleCreateCronTask: vi.fn(),
    removeProjectTarget: null,
    removeProjectLoading: false,
    handleRemoveProject: vi.fn(),
    handleRemoveProjectConfirm: vi.fn(),
  }),
}));

vi.mock('@/renderer/pages/conversation/GroupedHistory/hooks/useDragAndDrop', () => ({
  useDragAndDrop: () => ({
    sensors: [],
    isDragEnabled: false,
    pinnedIds: [],
    handleDragEnd: vi.fn(),
    getStableRowProps: vi.fn(),
  }),
}));

import WorkspaceGroupedHistory from '@/renderer/pages/conversation/GroupedHistory';

const mocks = vi.hoisted(() => ({
  useConversations: vi.fn(),
}));

function baseConversations(overrides: Record<string, unknown> = {}) {
  return {
    conversations: [],
    switching: false,
    isConversationGenerating: () => false,
    hasCompletionUnread: () => false,
    expandedWorkspaces: [],
    pinnedConversations: [],
    timelineSections: [],
    handleToggleWorkspace: vi.fn(),
    collapsedSections: new Set<string>(),
    toggleSection: vi.fn(),
    ...overrides,
  };
}

describe('the conversation list while switching accounts', () => {
  it('shows a loading state instead of the empty state', () => {
    mocks.useConversations.mockReturnValue(baseConversations({ switching: true }));

    render(
      <MemoryRouter>
        <WorkspaceGroupedHistory onSessionClick={vi.fn()} />
      </MemoryRouter>
    );

    // The empty state would read as "this account has no conversations".
    expect(screen.queryByText('conversation.history.noHistory')).toBeNull();
    expect(screen.getByTestId('conversation-list-switching')).toBeTruthy();
  });

  it('shows the empty state when there is nothing to switch to', () => {
    mocks.useConversations.mockReturnValue(baseConversations({ switching: false }));

    render(
      <MemoryRouter>
        <WorkspaceGroupedHistory onSessionClick={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('conversation-list-switching')).toBeNull();
    expect(screen.getByText('conversation.history.noHistory')).toBeTruthy();
  });
});
