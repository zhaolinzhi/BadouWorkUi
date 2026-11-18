/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';

/**
 * The account switch must not delete the identity it just switched to.
 *
 * `performExternalLogin` writes `external_auth` and then — when the backend
 * restarts against the new account's data directory — calls
 * `resetAccountState()`, which clears the account-scoped localStorage keys.
 * `external_auth` used to be one of those keys, so the switch deleted the
 * session it had just established: the renderer kept working from memory, but
 * the next reload found no session and bounced the user back to the login
 * page.
 *
 * This test drives the real `resetAccountState` — mocking it away is what
 * let the bug through in the first place.
 */

const mocks = vi.hoisted(() => ({
  setActive: vi.fn(async () => ({ backendPort: 4321, restarted: true })),
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
        getActive: { invoke: vi.fn(async () => null) },
        clearActive: { invoke: vi.fn(async () => {}) },
      },
    },
  };
});

vi.mock('@/renderer/services/newapi', () => ({
  runNewapiPostLogin: vi.fn(),
}));

vi.mock('@/renderer/hooks/mcp/ensureDefaultMcpServers', () => ({
  ensureKnowledgeServerMcp: vi.fn(),
}));

import { AuthProvider, useAuth } from '@/renderer/hooks/context/AuthContext';

const STORAGE_KEY = 'external_auth';

function Probe() {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid='status'>{ctx.status}</span>
      <span data-testid='username'>{ctx.user?.username ?? ''}</span>
      <button
        data-testid='complete'
        onClick={() => ctx.completeExternalLogin('tok-abc', { id: 'u1', username: 'alice' })}
      >
        complete
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.setActive.mockClear();
  mocks.setActive.mockResolvedValue({ backendPort: 4321, restarted: true });
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Account switch keeps the identity it just signed in with', () => {
  it('leaves external_auth in localStorage when the backend restarts for the new account', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    // The deep link arrives and the backend restarts against the new
    // account's data directory — the case where `resetAccountState` runs.
    await act(async () => {
      screen.getByTestId('complete').click();
    });

    expect(mocks.setActive).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('authenticated');

    // The session must survive the switch: the next renderer reload reads it
    // back and stays signed in.
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? 'null')).toEqual({ token: 'tok-abc', userId: 'u1', username: 'alice' });
  });
});
