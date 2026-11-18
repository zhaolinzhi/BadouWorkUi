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
  useConversationListSync,
} from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';

function Probe() {
  const { conversations } = useConversationListSync();
  return <div data-testid='count'>{conversations.length}</div>;
}

function renderedCount(): number {
  return Number(document.querySelector('[data-testid="count"]')?.textContent ?? '-1');
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
