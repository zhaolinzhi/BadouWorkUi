/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The backend data is per-account, but the renderer caches it in memory:
 * ~15 module-level singletons (the conversation list, the project tree, the
 * runtime views, the send-box drafts), ~30 SWR keys, and `configService`'s own
 * cache. Switching accounts restarts the backend against the other account's
 * data directory, and nothing told the renderer to re-read it — so the sidebar
 * kept listing the PREVIOUS account's conversations.
 *
 * A renderer reload is the only mechanism that is provably complete: it tears
 * down every module-level singleton and the whole SWR cache, and re-runs the
 * config bootstrap against the new backend port.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';

const { setActive, clearActive, resetWs, setBackendPort } = vi.hoisted(() => ({
  setActive: vi.fn(async () => ({ backendPort: 4321, restarted: true })),
  clearActive: vi.fn(async () => {}),
  resetWs: vi.fn(),
  setBackendPort: vi.fn(),
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
  return { ...actual, resetWsForBackendRestart: resetWs, setBackendPort };
});

import { AuthProvider, useAuth } from '@/renderer/hooks/context/AuthContext';

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
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('account switch reloads the renderer', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    reload = vi.fn();
    // jsdom's location.reload is not implemented; stub it so the switch can
    // request a reload without tearing down the test environment.
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('reloads the renderer when the backend restarted on a new port', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
  });

  it('reloads only after the new port is adopted', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    // The reload must not happen before the renderer knows the new port,
    // otherwise the fresh renderer would start on the dead one.
    expect(setBackendPort).toHaveBeenCalledWith(4321);
    expect(setBackendPort.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });

  it('does not reload when the backend was not restarted', async () => {
    setActive.mockResolvedValueOnce({ backendPort: 4321, restarted: false });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });

    await waitFor(() => {
      expect(setActive).toHaveBeenCalled();
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads on sign-out so the signed-out session keeps no account data', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

    await act(async () => {
      screen.getByTestId('complete').click();
    });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    reload.mockClear();

    await act(async () => {
      screen.getByTestId('logout').click();
    });

    await waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
  });
});
