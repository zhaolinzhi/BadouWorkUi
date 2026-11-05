import { Message } from '@arco-design/web-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PREVIEW_SCOPE_KEY_PREFIX } from '@/renderer/pages/conversation/Preview/context/previewScope';
import { AIPAAS_BASE_URL } from '@/renderer/api';
import { ensureKnowledgeServerMcp } from '@/renderer/hooks/mcp/ensureDefaultMcpServers';
import { runNewapiPostLogin } from '@/renderer/services/newapi';
import { ipcBridge } from '@/common';
import { resetWsForBackendRestart } from '@/common/adapter/httpBridge';

const LOGOUT_ENDPOINT = `${AIPAAS_BASE_URL}/system/security/logout/logout`;

/**
 * Tell the main process which account is signed in, and adopt the backend
 * port it reports.
 *
 * The main process may need to restart the backend against the account's own
 * data directory, which changes the port the renderer must talk to.
 *
 * Errors are re-thrown so the caller can surface them with the translation
 * function, which is only available inside the React component.
 */
async function activateAccount(userId: string, username: string): Promise<void> {
  const result = await ipcBridge.account.setActive.invoke({ userId, username });
  if (result.restarted) {
    window.__backendPort = result.backendPort;
    resetWsForBackendRestart();
  }
  // The in-app browser partition holds site cookies that may be logged in.
  // Clear it so accounts cannot see each other's sessions.
  //
  // Fire-and-forget: clearing browser data is a hygiene step, not a
  // precondition for the login, and it must not delay the post-login
  // bootstrap that follows.
  void ipcBridge.application.clearBrowserData.invoke().catch((error: unknown) => {
    console.warn('Failed to clear the browser session on account switch:', error);
  });
}

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  username: string;
  token: string;
}

interface ExternalAuthPayload {
  token: string;
  userId: string;
  username: string;
}

export type TokenExpiredSource = 'task-center' | 'kb-chat' | 'knowledge-base' | 'feedback';

interface AuthContextValue {
  ready: boolean;
  user: AuthUser | null;
  status: AuthStatus;
  completeExternalLogin: (token: string, user: { id: string; username: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  notifyTokenExpired: (source: TokenExpiredSource) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EXTERNAL_AUTH_STORAGE_KEY = 'external_auth';

function clearAuthCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.includes('auth') ||
          key.includes('csrf') ||
          key.includes('token') ||
          key.startsWith(PREVIEW_SCOPE_KEY_PREFIX))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear auth cache:', error);
  }
}

function readExternalAuth(): ExternalAuthPayload | null {
  try {
    const raw = localStorage.getItem(EXTERNAL_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ExternalAuthPayload>;
    if (typeof parsed.token !== 'string' || !parsed.token) return null;
    if (typeof parsed.userId !== 'string' || !parsed.userId) return null;
    if (typeof parsed.username !== 'string' || !parsed.username) return null;
    return { token: parsed.token, userId: parsed.userId, username: parsed.username };
  } catch (error) {
    console.error('Failed to read external_auth:', error);
    return null;
  }
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [ready, setReady] = useState(false);

  const tokenExpiredFiredRef = useRef(false);
  const { t } = useTranslation();

  const refresh = useCallback(async () => {
    setStatus('checking');
    const stored = readExternalAuth();
    if (stored) {
      setUser({ id: stored.userId, username: stored.username, token: stored.token });
      setStatus('authenticated');
    } else {
      setUser(null);
      setStatus('unauthenticated');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completeExternalLogin = useCallback(
    async (token: string, payload: { id: string; username: string }) => {
      const record: ExternalAuthPayload = {
        token,
        userId: payload.id,
        username: payload.username,
      };
      try {
        localStorage.setItem(EXTERNAL_AUTH_STORAGE_KEY, JSON.stringify(record));
      } catch (error) {
        console.error('Failed to persist external_auth:', error);
      }
      setUser({ id: payload.id, username: payload.username, token });
      setStatus('authenticated');
      setReady(true);
      tokenExpiredFiredRef.current = false;

      // Switch the backend to this account's data directory before anything
      // talks to it — the backend may have been serving another account's
      // database.
      try {
        await activateAccount(payload.id, payload.username);
      } catch (error) {
        console.error('Failed to activate the account scope:', error);
        // The app is now signed in but pointing at the previous account's
        // data. Tell the user rather than letting them write into the wrong
        // account's database.
        Message.error(t('common.accountSwitchFailed'));
      }

      // Fire-and-forget:登录成功后自动从 AIPAAS 取 NewAPI Key 密文并尝试自动建 provider。
      // 失败静默,不阻塞 /guid 跳转。详见 docs/superpowers/specs/2026-09-24-newapi-postlogin-design.md。
      void runNewapiPostLogin(token);
      // Fire-and-forget: ensure the default knowledge-base MCP server exists after login.
      void ensureKnowledgeServerMcp();
    },
    [t]
  );

  const logout = useCallback(async () => {
    const token = readExternalAuth()?.token;
    if (token) {
      try {
        await fetch(LOGOUT_ENDPOINT, {
          method: 'POST',
          headers: { token },
        });
      } catch (error) {
        console.error('Logout request failed:', error);
      }
    }
    // Stop the backend and release the account's data directory.
    //
    // Fire-and-forget on purpose: the main process stops the backend, which
    // can take a moment, and the local session must not stay "signed in"
    // while that happens. The UI flips to signed-out immediately; the
    // backend release follows.
    void ipcBridge.account.clearActive.invoke().catch((error: unknown) => {
      console.error('Failed to clear the account scope:', error);
    });
    setUser(null);
    setStatus('unauthenticated');
    clearAuthCache();
  }, []);

  const notifyTokenExpired = useCallback(
    (_source: TokenExpiredSource) => {
      if (tokenExpiredFiredRef.current) return;
      tokenExpiredFiredRef.current = true;
      Message.warning(t('common.sessionExpired'));
      setTimeout(() => {
        void logout();
      }, 1000);
    },
    [logout, t]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      status,
      completeExternalLogin,
      logout,
      refresh,
      notifyTokenExpired,
    }),
    [completeExternalLogin, logout, notifyTokenExpired, ready, refresh, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
