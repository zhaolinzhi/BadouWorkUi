import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, screen, waitFor } from '@testing-library/react';
import { Message } from '@arco-design/web-react';

type ExternalLoginCompletedListener = (payload: { token: string; user: { id: string; username: string } }) => void;

/** The provider's `notifyTokenExpired`, so a test can simulate an expired token. */
const notifyTokenExpiredRef: { current: ((source: 'knowledge-base') => void) | null } = { current: null };

const mocks = vi.hoisted(() => ({
  externalLoginCompletedListeners: [] as ExternalLoginCompletedListener[],
  setActive: vi.fn(async () => ({ backendPort: 4321, restarted: false })),
  claimPending: vi.fn(async (): Promise<{ token: string; user: { id: string; username: string } } | null> => null),
}));

vi.mock('@/renderer/services/account/resetAccountState', () => ({
  resetAccountState: vi.fn(async () => {}),
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
        setActive: { invoke: mocks.setActive },
        clearActive: { invoke: vi.fn(async () => {}) },
      },
      auth: {
        ...actual.ipcBridge.auth,
        claimPending: { invoke: mocks.claimPending },
        externalLoginCompleted: {
          on: (listener: ExternalLoginCompletedListener) => {
            mocks.externalLoginCompletedListeners.push(listener);
            return () => {
              const idx = mocks.externalLoginCompletedListeners.indexOf(listener);
              if (idx >= 0) mocks.externalLoginCompletedListeners.splice(idx, 1);
            };
          },
        },
      },
    },
  };
});

import { AuthProvider, useAuth } from '@/renderer/hooks/context/AuthContext';

const STORAGE_KEY = 'external_auth';

function Probe() {
  const ctx = useAuth();
  notifyTokenExpiredRef.current = ctx.notifyTokenExpired;
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

describe('AuthContext (external login)', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.externalLoginCompletedListeners.length = 0;
    mocks.setActive.mockClear();
    mocks.claimPending.mockReset();
    mocks.claimPending.mockResolvedValue(null);
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('starts unauthenticated when no external_auth is stored', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
  });

  it('starts authenticated when external_auth is stored', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'tok-xyz', userId: 'u9', username: 'bob' }));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('username').textContent).toBe('bob');
  });

  it('completeExternalLogin writes localStorage and updates state', async () => {
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    await act(async () => {
      screen.getByTestId('complete').click();
    });
    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('username').textContent).toBe('alice');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    expect(stored).toEqual({ token: 'tok-abc', userId: 'u1', username: 'alice' });
  });

  it('handles the deep-link login callback without the login page being mounted', async () => {
    // The deep link is delivered straight through IPC with no buffering. The
    // provider is mounted for the whole app lifetime, so a callback that
    // arrives before the (lazily-loaded) login page is ready is not lost.
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(mocks.externalLoginCompletedListeners.length).toBe(1);

    act(() => {
      for (const listener of mocks.externalLoginCompletedListeners) {
        listener({ token: 'deep-link-token', user: { id: 'u9', username: 'deeplink' } });
      }
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('username').textContent).toBe('deeplink');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('deep-link-token');
  });

  it('claims a deep-link token that arrived before the provider subscribed', async () => {
    // The deep link is delivered straight through IPC with no buffering. The
    // provider subscribes on mount, but the callback can land before that
    // happens — the main process holds the payload so it is not lost.
    mocks.claimPending.mockResolvedValue({
      token: 'pending-token',
      user: { id: 'u8', username: 'pending' },
    });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('username').textContent).toBe('pending');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('pending-token');
  });

  it('applies a deep-link payload only once when it arrives by both routes', async () => {
    // The main process holds the payload AND emits it, so a renderer that
    // was already listening receives the same login twice: once from the
    // emit and once from the claim. The second application restarts the
    // backend a second time — and if the user signs out in between, that
    // second switch races the sign-out and fails with "切换到该账号的数据目录失败".
    mocks.claimPending.mockResolvedValue({
      token: 'same-token',
      user: { id: 'u9', username: 'deeplink' },
    });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    // The same payload also arrives over the event channel.
    act(() => {
      for (const listener of mocks.externalLoginCompletedListeners) {
        listener({ token: 'same-token', user: { id: 'u9', username: 'deeplink' } });
      }
    });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    // The account was switched once, not twice.
    expect(mocks.setActive).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from the deep-link callback on unmount', async () => {
    const { unmount } = renderProbe();
    await waitFor(() => expect(mocks.externalLoginCompletedListeners.length).toBe(1));

    unmount();

    expect(mocks.externalLoginCompletedListeners.length).toBe(0);
  });

  it('logout clears external_auth and resets state', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'tok-1', userId: 'u1', username: 'alice' }));
    renderProbe();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    await act(async () => {
      screen.getByTestId('logout').click();
    });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reports an expired session and signs the user out', async () => {
    // The real expiry path: the user is still signed in, the token expired.
    // The user must be told and must end up signed out.
    const warnings: string[] = [];
    const messageSpy = vi.spyOn(Message, 'warning').mockImplementation((content: unknown) => {
      warnings.push(String(content));
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'tok-1', userId: 'u1', username: 'alice' }));
      renderProbe();
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

      await act(async () => {
        notifyTokenExpiredRef.current?.('knowledge-base');
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('common.sessionExpired');

      // The logout it schedules runs a second later.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 1100));
      });
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    } finally {
      messageSpy.mockRestore();
    }
  });

  it('does not report the session as expired when it expires after a sign-out', async () => {
    // Signing out invalidates the token, so a request that was already in
    // flight comes back 401. That is expected — the user just signed out on
    // purpose. Telling them "登录已过期，请重新登录" on top of the sign-out
    // they just performed is noise, and the second logout it triggers would
    // race the first one's account teardown.
    const warnings: string[] = [];
    const messageSpy = vi.spyOn(Message, 'warning').mockImplementation((content: unknown) => {
      warnings.push(String(content));
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: 'tok-1', userId: 'u1', username: 'alice' }));
      renderProbe();
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

      await act(async () => {
        screen.getByTestId('logout').click();
      });
      await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));

      // The in-flight request comes back with an expired token.
      await act(async () => {
        notifyTokenExpiredRef.current?.('knowledge-base');
      });

      expect(warnings).toHaveLength(0);
    } finally {
      messageSpy.mockRestore();
    }
  });
});
