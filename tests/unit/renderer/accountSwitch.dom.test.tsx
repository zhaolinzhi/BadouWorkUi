/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';

// `vi.mock` factories are hoisted above the module body, so the spies must be
// created with `vi.hoisted` to be available inside the factory.
const { setActive, clearActive, resetWs, resetAccountState } = vi.hoisted(() => ({
  setActive: vi.fn(async () => ({ backendPort: 4321, restarted: true })),
  clearActive: vi.fn(async () => {}),
  resetWs: vi.fn(),
  resetAccountState: vi.fn(async () => {}),
}));

vi.mock('@/renderer/services/account/resetAccountState', () => ({
  resetAccountState,
  isAccountStorageKey: vi.fn(() => false),
}));

vi.mock('@/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common')>();
  return {
    ...actual,
    ipcBridge: {
      ...actual.ipcBridge,
      account: {
        ...actual.ipcBridge.account,
        setActive: { invoke: setActive },
        clearActive: { invoke: clearActive },
      },
    },
  };
});

vi.mock('@/renderer/services/newapi', () => ({
  runNewapiPostLogin: vi.fn(async () => {}),
}));

vi.mock('@/renderer/hooks/mcp/ensureDefaultMcpServers', () => ({
  ensureKnowledgeServerMcp: vi.fn(async () => {}),
}));

vi.mock('@/common/adapter/httpBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common/adapter/httpBridge')>();
  // `setBackendPort` stays real: the account switch must be able to move the
  // renderer onto the new backend port.
  return { ...actual, resetWsForBackendRestart: resetWs };
});

import { AuthProvider, useAuth } from '@/renderer/hooks/context/AuthContext';
import { getBaseUrl } from '@/common/adapter/httpBridge';

function Probe() {
  const ctx = useAuth();
  return (
    <div>
      <span data-testid='status'>{ctx.status}</span>
      <button
        data-testid='complete'
        onClick={() => void ctx.completeExternalLogin('tok', { id: 'u1', username: 'Alice' })}
      >
        complete
      </button>
      <button data-testid='logout' onClick={() => void ctx.logout()}>
        logout
      </button>
      <button
        data-testid='complete-named'
        onClick={(e) =>
          void ctx.completeExternalLogin('tok', { id: e.currentTarget.dataset.id ?? 'u1', username: 'Alice' })
        }
      >
        complete named
      </button>
    </div>
  );
}

function completeNamed(id: string): void {
  const button = document.querySelector<HTMLButtonElement>('[data-testid="complete-named"]');
  if (!button) throw new Error('complete-named button not found');
  button.dataset.id = id;
  button.click();
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('account switch wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // The real preload installs the port with `contextBridge.exposeInMainWorld`,
    // which freezes primitives across the context isolation boundary. Mirror
    // that here, otherwise the test would pass against an implementation that
    // throws in the real app.
    Object.defineProperty(window, '__backendPort', {
      value: 13400,
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as Window & { __backendPort?: number }).__backendPort;
  });

  it('activates the account in the main process on login', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(setActive).toHaveBeenCalledWith({ userId: 'u1', username: 'Alice' });
    });
  });

  it('updates the backend port and resets the websocket after a restart', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(getBaseUrl()).toBe('http://127.0.0.1:4321');
    });
    expect(resetWs).toHaveBeenCalled();
  });

  it('resets the websocket even when the port cannot be applied', async () => {
    // `window.__backendPort` is frozen by contextBridge in the real app, so
    // writing to it throws. The websocket reset must not be skipped by that
    // failure — otherwise the renderer keeps retrying the dead backend.
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(resetWs).toHaveBeenCalled();
    });
  });

  it('clears the active account on logout', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });
    await waitFor(() => expect(setActive).toHaveBeenCalled());

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    await waitFor(() => {
      expect(clearActive).toHaveBeenCalled();
    });
  });

  it('reports a failed account switch instead of hanging on it', async () => {
    // The main process can fail to switch (a backend that could not start, a
    // cancelled startup). The invoke must reject — when it did not, the
    // promise stayed pending forever, the switch queue wedged behind it, and
    // every later login was stuck on the login page.
    setActive.mockRejectedValueOnce(new Error('backend startup cancelled'));

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    // The switch was attempted and its failure surfaced.
    await waitFor(() => expect(setActive).toHaveBeenCalled());
    // The session is still usable — the next attempt must not be blocked by
    // a wedged queue. The reset only runs for a successful switch.
    expect(resetAccountState).not.toHaveBeenCalled();
  });

  it('does not reload the page after a backend restart', async () => {
    // The reload used to be the way to drop the previous account's cached
    // data. It also tore down the renderer and left the window blank while it
    // came back, so the state is now cleared explicitly instead.
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload },
      writable: true,
      configurable: true,
    });

    try {
      renderProbe();
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

      await act(async () => {
        screen.getByTestId('complete').click();
      });

      await waitFor(() => expect(setActive).toHaveBeenCalled());
      expect(reload).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });

  it('clears the previous account state after a backend restart', async () => {
    // The reload used to be what dropped the previous account's cached data.
    // Without it, the reset has to happen explicitly — and it has to ask for
    // a reload, because the backend now serves a different data directory.
    //
    // `keepAuth` keeps the identity the switch just wrote. The reset clears
    // the account-scoped localStorage keys, and `external_auth` is one of
    // them — clearing it would delete the session the switch established, and
    // the next renderer reload would sign the user out.
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(resetAccountState).toHaveBeenCalledWith({ reload: true, keepAuth: true });
    });
  });

  it('serializes overlapping account switches', async () => {
    // The deep-link callback can fire twice. Two overlapping switches would
    // each restart the backend and each reset the renderer's caches — the
    // second one clearing what the first one just loaded.
    const order: string[] = [];
    setActive.mockImplementation(async ({ userId }: { userId: string }) => {
      order.push(`start:${userId}`);
      await new Promise((r) => setTimeout(r, 20));
      order.push(`done:${userId}`);
      return { backendPort: 4321, restarted: true };
    });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      void completeNamed('first');
      void completeNamed('second');
    });

    await waitFor(() => expect(order.length).toBe(4));
    // The second switch must not start before the first one finished.
    expect(order).toEqual(['start:first', 'done:first', 'start:second', 'done:second']);
  });

  it('does not reload the page on logout', async () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload },
      writable: true,
      configurable: true,
    });

    try {
      renderProbe();
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

      await act(async () => {
        screen.getByTestId('logout').click();
      });

      await waitFor(() => expect(clearActive).toHaveBeenCalled());
      expect(reload).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });
});
