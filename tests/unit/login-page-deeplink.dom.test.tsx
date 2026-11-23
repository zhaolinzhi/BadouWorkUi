import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * The login page must not subscribe to the deep-link login callback itself.
 *
 * `AuthProvider` is mounted for the whole app lifetime and already applies the
 * token from `externalLoginCompleted` — with a dedup so the same token is not
 * applied twice (applying it twice would switch the account twice). A second
 * handler on the login page would bypass that dedup.
 *
 * A bad merge once re-added the subscription here while dropping the
 * `completeExternalLogin` destructure from `useAuth()`, which threw
 * `ReferenceError: completeExternalLogin is not defined` on every render of
 * the login page.
 *
 * The assertions here use plain matchers rather than jest-dom's
 * `toBeInTheDocument`, because jest-dom's matchers are not registered in this
 * workspace (a pre-existing dependency-resolution issue) and would mask the
 * real failure.
 */

type ExternalLoginCompletedListener = (payload: { token: string; user: { id: string; username: string } }) => void;

const mocks = vi.hoisted(() => ({
  startExternalLoginInvoke: vi.fn(),
  externalLoginCompletedListeners: [] as ExternalLoginCompletedListener[],
  completeExternalLogin: vi.fn(),
  navigate: vi.fn(),
  claimPendingInvoke: vi.fn(),
}));

vi.mock('@/renderer/hooks/context/AuthContext', () => ({
  useAuth: () => ({
    ready: true,
    user: null,
    status: 'unauthenticated',
    completeExternalLogin: mocks.completeExternalLogin,
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    auth: {
      startExternalLogin: { invoke: mocks.startExternalLoginInvoke },
      claimPending: { invoke: mocks.claimPendingInvoke },
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
}));

vi.mock('@renderer/components/layout/AppLoader', () => ({
  default: () => null,
}));

vi.mock('@/renderer/services/i18n', () => ({
  changeLanguage: vi.fn().mockResolvedValue(undefined),
}));

import LoginPage from '@/renderer/pages/login/index';

beforeEach(() => {
  mocks.startExternalLoginInvoke.mockReset();
  mocks.completeExternalLogin.mockReset();
  mocks.navigate.mockReset();
  mocks.claimPendingInvoke.mockReset();
  mocks.claimPendingInvoke.mockResolvedValue(null);
  mocks.startExternalLoginInvoke.mockResolvedValue({ success: true });
  mocks.externalLoginCompletedListeners.length = 0;
});

describe('LoginPage deep-link handling', () => {
  it('renders without throwing when the deep-link callback fires', async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'login.submit' })).toBeTruthy();
    });

    // A listener registered by the page would be invoked here; the page must
    // not have registered one at all.
    expect(mocks.externalLoginCompletedListeners.length).toBe(0);
  });

  it('does not subscribe to externalLoginCompleted', async () => {
    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'login.submit' })).toBeTruthy();
    });

    expect(mocks.externalLoginCompletedListeners.length).toBe(0);
    expect(mocks.claimPendingInvoke).not.toHaveBeenCalled();
  });

  it('does not leave a deep-link subscription behind on unmount', async () => {
    const { unmount } = render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'login.submit' })).toBeTruthy();
    });

    unmount();
    expect(mocks.externalLoginCompletedListeners.length).toBe(0);
  });
});
