/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const messageWarningMock = vi.fn();

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: { ...actual.Message, warning: messageWarningMock },
  };
});

vi.mock('@/renderer/api', () => ({
  AIPAAS_BASE_URL: 'http://example.test',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { AuthProvider, useAuth } = await import('@/renderer/hooks/context/AuthContext');

const Probe: React.FC<{ onReady: (api: ReturnType<typeof useAuth>) => void }> = ({ onReady }) => {
  const api = useAuth();
  React.useEffect(() => {
    onReady(api);
  }, [api, api.ready, api.status, api.user, onReady]);
  return <span data-testid='probe-status'>{api.status}</span>;
};

beforeEach(() => {
  messageWarningMock.mockReset();
  localStorage.clear();
  // fetch is invoked inside logout() to ping the AIPAAS logout endpoint. Mock it so the
  // logout promise resolves synchronously under fake timers; otherwise the setStatus call
  // inside logout never runs and our post-1s assertion sees status === 'authenticated'.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true } as Response))
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AuthContext.notifyTokenExpired', () => {
  it('shows toast and logs out after 1s delay', async () => {
    // Simulate a logged-in session so the post-logout transition is observable.
    localStorage.setItem('external_auth', JSON.stringify({ token: 'tok', userId: 'u1', username: 'u1' }));

    let captured: ReturnType<typeof useAuth> | undefined;
    await act(async () => {
      render(
        <AuthProvider>
          <Probe
            onReady={(api) => {
              captured = api;
            }}
          />
        </AuthProvider>
      );
    });

    expect(captured).toBeDefined();
    if (!captured) throw new Error('probe did not capture api');
    expect(captured.status).toBe('authenticated');

    act(() => {
      captured!.notifyTokenExpired('task-center');
    });

    expect(messageWarningMock).toHaveBeenCalledWith('common.sessionExpired');
    expect(captured.status).toBe('authenticated');

    // Drive time forward and let any pending microtasks + state updates settle.
    await act(async () => {
      vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(captured.status).toBe('unauthenticated');
  });

  it('fires only once per session even when invoked twice', async () => {
    localStorage.setItem('external_auth', JSON.stringify({ token: 'tok', userId: 'u1', username: 'u1' }));

    let captured: ReturnType<typeof useAuth> | undefined;
    await act(async () => {
      render(
        <AuthProvider>
          <Probe
            onReady={(api) => {
              captured = api;
            }}
          />
        </AuthProvider>
      );
    });

    if (!captured) throw new Error('probe did not capture api');
    expect(captured.status).toBe('authenticated');

    act(() => {
      captured!.notifyTokenExpired('task-center');
      captured!.notifyTokenExpired('kb-chat');
    });

    expect(messageWarningMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(captured.status).toBe('unauthenticated');
  });

  it('resets the guard on successful login', async () => {
    localStorage.setItem('external_auth', JSON.stringify({ token: 'tok', userId: 'u1', username: 'u1' }));

    let captured: ReturnType<typeof useAuth> | undefined;
    await act(async () => {
      render(
        <AuthProvider>
          <Probe
            onReady={(api) => {
              captured = api;
            }}
          />
        </AuthProvider>
      );
    });

    if (!captured) throw new Error('probe did not capture api');
    expect(captured.status).toBe('authenticated');

    act(() => {
      captured!.notifyTokenExpired('task-center');
    });
    expect(messageWarningMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      captured!.completeExternalLogin('new-tok', { id: 'u2', username: 'u2' });
    });

    act(() => {
      captured!.notifyTokenExpired('task-center');
    });

    expect(messageWarningMock).toHaveBeenCalledTimes(2);
  });
});
