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
const { setActive, clearActive, resetWs } = vi.hoisted(() => ({
  setActive: vi.fn(async () => ({ backendPort: 4321, restarted: true })),
  clearActive: vi.fn(async () => {}),
  resetWs: vi.fn(),
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
});
