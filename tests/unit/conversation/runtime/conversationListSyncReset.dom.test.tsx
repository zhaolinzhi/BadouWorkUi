/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, cleanup, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserConversations } = vi.hoisted(() => ({
  getUserConversations: vi.fn(async () => ({ items: [] })),
}));

vi.mock('@/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common')>();
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      database: {
        ...actual.ipcBridge.database,
        getUserConversations: { invoke: getUserConversations },
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

vi.mock('@/renderer/utils/perf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/renderer/utils/perf')>();
  return {
    ...actual,
    mark: vi.fn(),
    perfTimeAsync: vi.fn((_entry: unknown, fn: () => unknown) => fn()),
  };
});

import {
  resetConversationListSyncInitForTest,
  resetConversationListSyncStore,
  setConversationListSwitching,
  useConversationListSync,
} from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';

function Probe() {
  const { conversations, switching } = useConversationListSync();
  return (
    <div>
      <div data-testid='count'>{conversations.length}</div>
      <div data-testid='switching'>{String(switching)}</div>
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
  // The store subscribes to backend events once per module lifetime, so its
  // init latch has to be cleared between tests or the mount-time fetch is
  // skipped and the test would observe a store that loads nothing.
  resetConversationListSyncInitForTest();
  getUserConversations.mockReset();
  getUserConversations.mockResolvedValue({ items: [] });
});

afterEach(() => {
  cleanup();
});

describe('resetConversationListSyncStore', () => {
  it('re-fetches the conversation list after an account switch', async () => {
    // The old backend's list must not survive the switch, and the new
    // account's list must be fetched — clearing the state alone leaves the
    // list empty forever, because the store only fetches once on mount.
    getUserConversations.mockResolvedValue({
      items: [{ id: 'c1', title: 'Old account conversation', project_id: null }],
    });

    render(<Probe />);
    await waitFor(() => expect(renderedCount()).toBe(1));

    const callsAfterMount = getUserConversations.mock.calls.length;

    // The account switched: the backend now serves a different data
    // directory, so the list is empty for the new account.
    getUserConversations.mockResolvedValue({ items: [] });
    await act(async () => {
      resetConversationListSyncStore({ reload: true });
    });

    // A fetch must have been issued for the new account.
    await waitFor(() => expect(getUserConversations.mock.calls.length).toBeGreaterThan(callsAfterMount));
    expect(renderedCount()).toBe(0);
  });

  it('does not fetch on a sign-out, when there is no account to load', async () => {
    getUserConversations.mockResolvedValue({
      items: [{ id: 'c1', title: 'Old account conversation', project_id: null }],
    });

    render(<Probe />);
    await waitFor(() => expect(renderedCount()).toBe(1));

    const callsAfterMount = getUserConversations.mock.calls.length;

    await act(async () => {
      resetConversationListSyncStore();
    });

    // The list is cleared, but no request is made: the backend is stopping
    // and nobody is signed in to fetch for.
    expect(renderedCount()).toBe(0);
    expect(getUserConversations.mock.calls.length).toBe(callsAfterMount);
  });

  it('drops a response that was already in flight when the switch happened', async () => {
    // The request issued before the switch belongs to the previous account.
    // If its response is applied after the reset, the previous account's
    // conversations reappear in the new account's list.
    let resolveOld: (value: unknown) => void = () => {};
    let callIndex = 0;
    getUserConversations.mockImplementation(() => {
      callIndex += 1;
      if (callIndex === 1) {
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      }
      return Promise.resolve({ items: [] });
    });

    render(<Probe />);

    // The mount-time request is still pending; the switch happens now.
    await waitFor(() => expect(getUserConversations).toHaveBeenCalledTimes(1));

    await act(async () => {
      resetConversationListSyncStore({ reload: true });
    });

    // The stale response arrives late.
    await act(async () => {
      resolveOld({ items: [{ id: 'stale', title: 'Previous account', project_id: null }] });
    });

    // It must not be applied — the list stays empty.
    expect(renderedCount()).toBe(0);
  });
});

describe('the switching flag', () => {
  it('reports switching while the account is being switched', async () => {
    getUserConversations.mockResolvedValue({
      items: [{ id: 'c1', title: 'Old account conversation', project_id: null }],
    });

    render(<Probe />);
    await waitFor(() => expect(renderedCount()).toBe(1));
    expect(renderedSwitching()).toBe(false);

    // The switch starts: the backend is being restarted, so the list must
    // not show the previous account's conversations.
    await act(async () => {
      setConversationListSwitching(true);
    });

    expect(renderedSwitching()).toBe(true);
    // The old account's conversation is gone — it must not be visible while
    // the switch is in flight.
    expect(renderedCount()).toBe(0);
  });

  it('clears the flag once the new account data has arrived', async () => {
    getUserConversations.mockResolvedValue({
      items: [{ id: 'c1', title: 'Old account conversation', project_id: null }],
    });

    render(<Probe />);
    await waitFor(() => expect(renderedCount()).toBe(1));

    await act(async () => {
      setConversationListSwitching(true);
    });
    expect(renderedSwitching()).toBe(true);

    // The switch finished: the new account's list is loaded and the sidebar
    // must show it again.
    getUserConversations.mockResolvedValue({
      items: [{ id: 'c2', title: 'New account conversation', project_id: null }],
    });
    await act(async () => {
      resetConversationListSyncStore({ reload: true });
      setConversationListSwitching(false);
    });

    await waitFor(() => expect(renderedCount()).toBe(1));
    expect(renderedSwitching()).toBe(false);
  });

  it('keeps the flag when the store is reset with switching on', async () => {
    render(<Probe />);
    await waitFor(() => expect(renderedSwitching()).toBe(false));

    await act(async () => {
      resetConversationListSyncStore({ switching: true });
    });

    expect(renderedSwitching()).toBe(true);
  });

  it('clears the flag on a sign-out, which has no account to switch to', async () => {
    render(<Probe />);
    await waitFor(() => expect(renderedSwitching()).toBe(false));

    await act(async () => {
      setConversationListSwitching(true);
    });
    expect(renderedSwitching()).toBe(true);

    // A sign-out has no account to switch to, so the flag must not survive
    // it — the sidebar would show a loading state for a list that is never
    // coming back.
    await act(async () => {
      resetConversationListSyncStore();
    });

    expect(renderedSwitching()).toBe(false);
  });
});
