/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';

/**
 * The sidebar must not show the previous account's conversations while the
 * switch is in flight.
 *
 * The switch has two phases: the backend is restarted against the new
 * account's data directory (slow — seconds), and only then is the new
 * account's list fetched. The rows on screen belong to the old account for
 * that whole window, so the list is dropped and a loading state shown until
 * the new data arrives.
 */

const mocks = vi.hoisted(() => ({
  setActive: vi.fn(),
  getActive: vi.fn(async (): Promise<{ userId: string; username: string } | null> => null),
  resetAccountState: vi.fn(async () => {}),
  getUserConversations: vi.fn(async () => ({ items: [] })),
}));

vi.mock('@/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common')>();
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      account: {
        ...actual.ipcBridge.account,
        setActive: { invoke: mocks.setActive },
        getActive: { invoke: mocks.getActive },
        clearActive: { invoke: vi.fn(async () => {}) },
      },
      database: {
        ...actual.ipcBridge.database,
        getUserConversations: { invoke: mocks.getUserConversations },
      },
      conversation: {
        ...actual.ipcBridge.conversation,
        listChanged: { on: vi.fn(() => () => {}) },
        responseStream: { on: vi.fn(() => () => {}) },
        turnCompleted: { on: vi.fn(() => () => {}) },
      },
    },
  };
});

vi.mock('@/renderer/services/account/resetAccountState', async () => {
  const { resetConversationListSyncStore } =
    await import('@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync');
  return {
    // The real reset drops the account-scoped state and — with `reload` —
    // asks the conversation list to fetch the new account's data. That is
    // what puts the new rows on screen, so the mock has to do it too.
    resetAccountState: async (options?: { reload?: boolean; keepAuth?: boolean }) => {
      await mocks.resetAccountState(options);
      resetConversationListSyncStore({ reload: options?.reload });
    },
    isAccountStorageKey: vi.fn(() => false),
  };
});

vi.mock('@/renderer/services/newapi', () => ({
  runNewapiPostLogin: vi.fn(),
}));

vi.mock('@/renderer/hooks/mcp/ensureDefaultMcpServers', () => ({
  ensureKnowledgeServerMcp: vi.fn(),
}));

vi.mock('@/renderer/utils/perf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/renderer/utils/perf')>();
  return {
    ...actual,
    mark: vi.fn(),
    perfTimeAsync: vi.fn((_entry: unknown, fn: () => unknown) => fn()),
  };
});

import { AuthProvider, useAuth } from '@/renderer/hooks/context/AuthContext';
import {
  resetConversationListSyncInitForTest,
  useConversationListSync,
} from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';

function AuthProbe() {
  const ctx = useAuth();
  return (
    <button data-testid='complete' onClick={() => ctx.completeExternalLogin('tok', { id: 'u1', username: 'alice' })}>
      complete
    </button>
  );
}

function ListProbe() {
  const { conversations, switching } = useConversationListSync();
  return (
    <div>
      <span data-testid='count'>{conversations.length}</span>
      <span data-testid='switching'>{String(switching)}</span>
    </div>
  );
}

function renderedCount(): number {
  return Number(document.querySelector('[data-testid="count"]')?.textContent ?? '-1');
}

function renderedSwitching(): boolean {
  return document.querySelector('[data-testid="switching"]')?.textContent === 'true';
}

beforeEach(() => {
  localStorage.clear();
  resetConversationListSyncInitForTest();
  mocks.setActive.mockReset();
  mocks.getActive.mockReset();
  // No account is active yet — the one signing in is a different one.
  mocks.getActive.mockResolvedValue(null);
  mocks.resetAccountState.mockClear();
  mocks.resetAccountState.mockResolvedValue(undefined);
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the account switch hides the previous account conversations', () => {
  it('shows a loading state while the backend restarts, and the new list afterwards', async () => {
    // The previous account's conversation is in the list.
    mocks.getUserConversations.mockResolvedValue({
      items: [{ id: 'old', title: 'Previous account', project_id: null }],
    });

    // The backend restart takes a while — that is the window in which the
    // previous account's conversations would be visible.
    let releaseSwitch: () => void = () => {};
    mocks.setActive.mockImplementation(
      async () =>
        new Promise((resolve) => {
          releaseSwitch = () => resolve({ backendPort: 4321, restarted: true });
        })
    );

    render(
      <AuthProvider>
        <AuthProbe />
        <ListProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(renderedCount()).toBe(1));
    expect(renderedSwitching()).toBe(false);

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    // The switch is in flight: the list must be empty and the sidebar must
    // show a loading state.
    expect(renderedSwitching()).toBe(true);
    expect(renderedCount()).toBe(0);

    // The backend is up on the new account's data directory; the new list
    // arrives.
    mocks.getUserConversations.mockResolvedValue({
      items: [{ id: 'new', title: 'Current account', project_id: null }],
    });

    await act(async () => {
      releaseSwitch();
    });

    await waitFor(() => expect(renderedSwitching()).toBe(false));
    await waitFor(() => expect(renderedCount()).toBe(1));
  });

  it('does not enter the switching state when the same account signs in again', async () => {
    // The same account signs in again: no data directory change, so no
    // backend restart and no stale data — there is nothing to hide. The
    // sidebar must not flicker into a loading state for it.
    mocks.getActive.mockResolvedValue({ userId: 'u1', username: 'alice' });
    mocks.setActive.mockResolvedValue({ backendPort: 4321, restarted: false });

    render(
      <AuthProvider>
        <AuthProbe />
        <ListProbe />
      </AuthProvider>
    );
    await waitFor(() => expect(renderedSwitching()).toBe(false));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => expect(mocks.setActive).toHaveBeenCalled());
    expect(renderedSwitching()).toBe(false);
  });
});
