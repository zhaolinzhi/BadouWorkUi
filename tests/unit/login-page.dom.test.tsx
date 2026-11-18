import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, screen, act, fireEvent } from '@testing-library/react';

type ExternalLoginCompletedListener = (payload: { token: string; user: { id: string; username: string } }) => void;

const mocks = vi.hoisted(() => {
  return {
    startExternalLoginInvoke: vi.fn(),
    externalLoginCompletedListeners: [] as ExternalLoginCompletedListener[],
    completeExternalLogin: vi.fn(),
    navigate: vi.fn(),
    claimPendingInvoke: vi.fn(),
  };
});

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
      startExternalLogin: {
        invoke: mocks.startExternalLoginInvoke,
      },
      claimPending: {
        invoke: mocks.claimPendingInvoke,
      },
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

// AppLoader is rendered while `status === 'checking'`; since the mock always
// returns 'unauthenticated', it never appears, but the component must still
// resolve at module-load time.
vi.mock('@renderer/components/layout/AppLoader', () => ({
  default: () => null,
}));

// Stub changeLanguage so the language-select onChange doesn't try to call
// anything that breaks jsdom.
vi.mock('@/renderer/services/i18n', () => ({
  changeLanguage: vi.fn().mockResolvedValue(undefined),
}));

import LoginPage from '@/renderer/pages/login/index';

const successResult = { success: true as const };

beforeEach(() => {
  mocks.startExternalLoginInvoke.mockReset();
  mocks.completeExternalLogin.mockReset();
  mocks.navigate.mockReset();
  mocks.externalLoginCompletedListeners.length = 0;
  mocks.startExternalLoginInvoke.mockResolvedValue(successResult);
  mocks.claimPendingInvoke.mockReset();
  mocks.claimPendingInvoke.mockResolvedValue(null);
});

const getSubmitButton = (): HTMLElement => screen.getByRole('button', { name: /login\.submit/ });

describe('LoginPage (button-triggered deep-link flow)', () => {
  it('does NOT auto-launch the external login', async () => {
    render(<LoginPage />);
    await waitFor(() => {
      expect(getSubmitButton()).toBeInTheDocument();
    });
    expect(mocks.startExternalLoginInvoke).not.toHaveBeenCalled();
  });

  it('calls startExternalLogin.invoke() when the user clicks the login button', async () => {
    render(<LoginPage />);
    await waitFor(() => {
      expect(getSubmitButton()).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(mocks.startExternalLoginInvoke).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the AIPaSS-platform login button label by default', async () => {
    render(<LoginPage />);
    await waitFor(() => {
      // `t` mock returns the key, so the button text is the i18n key.
      expect(screen.getByRole('button', { name: 'login.submit' })).toBeInTheDocument();
    });
  });

  it('leaves the deep-link handling to AuthProvider', async () => {
    // The subscription and the pending-token claim both live in
    // AuthProvider, which is mounted for the whole app lifetime. The login
    // page is a lazily-loaded chunk: a callback that lands while it is still
    // loading would be emitted into the void.
    render(<LoginPage />);

    await waitFor(() => {
      expect(getSubmitButton()).toBeInTheDocument();
    });
    expect(mocks.externalLoginCompletedListeners.length).toBe(0);
    expect(mocks.claimPendingInvoke).not.toHaveBeenCalled();
    expect(mocks.completeExternalLogin).not.toHaveBeenCalled();
  });

  it('renders an error message when startExternalLogin.invoke() rejects', async () => {
    mocks.startExternalLoginInvoke.mockRejectedValue(new Error('could not open browser'));
    render(<LoginPage />);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(screen.getByText('could not open browser')).toBeInTheDocument();
    });
    expect(mocks.completeExternalLogin).not.toHaveBeenCalled();
  });

  it('renders an error message when startExternalLogin.invoke() returns success: false', async () => {
    mocks.startExternalLoginInvoke.mockResolvedValue({ success: false, message: 'invalid url' });
    render(<LoginPage />);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(screen.getByText('invalid url')).toBeInTheDocument();
    });
    expect(mocks.completeExternalLogin).not.toHaveBeenCalled();
  });

  it('clears previous error and re-launches when the button is clicked again', async () => {
    mocks.startExternalLoginInvoke.mockRejectedValueOnce(new Error('first failure')).mockResolvedValue(successResult);
    render(<LoginPage />);

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });
    await waitFor(() => {
      expect(screen.getByText('first failure')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(getSubmitButton());
    });

    await waitFor(() => {
      expect(mocks.startExternalLoginInvoke).toHaveBeenCalledTimes(2);
    });
  });

  it('does not leave a deep-link subscription behind on unmount', async () => {
    const { unmount } = render(<LoginPage />);
    await waitFor(() => {
      expect(getSubmitButton()).toBeInTheDocument();
    });
    unmount();
    expect(mocks.externalLoginCompletedListeners.length).toBe(0);
  });
});
