import { Message } from '@arco-design/web-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PREVIEW_SCOPE_KEY_PREFIX } from '@/renderer/pages/conversation/Preview/context/previewScope';
import { AIPAAS_BASE_URL } from '@/renderer/api';
import { ensureKnowledgeServerMcp } from '@/renderer/hooks/mcp/ensureDefaultMcpServers';
import { runNewapiPostLogin } from '@/renderer/services/newapi';
import { ipcBridge } from '@/common';
import { resetWsForBackendRestart, setBackendPort } from '@/common/adapter/httpBridge';
import { resetAccountState } from '@/renderer/services/account/resetAccountState';
import { EXTERNAL_AUTH_STORAGE_KEY } from '@/renderer/services/account/accountStorageKeys';

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
 *
 * @returns True when the backend was restarted on a new port.
 */
async function activateAccount(userId: string, username: string): Promise<boolean> {
  const result = await ipcBridge.account.setActive.invoke({ userId, username });
  if (result.restarted) {
    // Drop the old socket FIRST. `window.__backendPort` is installed by the
    // preload with `contextBridge.exposeInMainWorld`, which freezes it — so
    // it cannot be written to, and any attempt to do so throws. Resetting the
    // socket first keeps that from skipping the reset, and the socket has to
    // be dropped anyway because it points at the backend that just stopped.
    resetWsForBackendRestart();
    // The bridge keeps its own mutable copy of the port, because the frozen
    // `window.__backendPort` can only ever hold the value from preload time.
    setBackendPort(result.backendPort);
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
  return result.restarted;
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

  // Whether a session is currently signed in, readable from a callback that
  // must not re-render when it changes.
  //
  // `notifyTokenExpired` needs this: a 401 that arrives after a sign-out is
  // expected, not a session that expired. It is set where the session
  // actually changes — the sign-out and the sign-in — rather than derived
  // from the render state, because the sign-in is applied asynchronously
  // (the switch is queued) and a caller that asks right after the login was
  // requested must still see the session as signed in.
  const signedInRef = useRef(false);

  // Serializes account switches. The deep-link callback can fire twice (the
  // user retries the SSO, or the OS delivers the URL again), and two
  // overlapping switches would each reset the renderer's caches — the second
  // one clearing what the first one just loaded, and the backend restarting
  // twice in a row.
  const accountSwitchQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // The latest `completeExternalLogin`, so the deep-link subscription below
  // can stay mounted for the app's lifetime without re-subscribing on every
  // render.
  const completeExternalLoginRef = useRef<
    ((token: string, payload: { id: string; username: string }) => Promise<void>) | null
  >(null);

  // The deep-link callback that carries the login token.
  //
  // It is handled here rather than on the login page because this provider
  // is mounted for the whole app lifetime: the login page is a lazily-loaded
  // chunk, so a callback that lands while the chunk is still loading would be
  // emitted into the void — the event is delivered straight through IPC with
  // no buffering on either side — and the user would sit on the login page
  // with a valid token and no way forward.
  //
  // The provider also claims a token that arrived before it subscribed, which
  // is the same race from the other side. Both routes deliver the SAME
  // payload, so the token is deduped here: applying it twice would switch the
  // account twice, and the second switch would race a sign-out that happened
  // in between — the backend start would be cancelled and the user would be
  // told the account switch failed.
  useEffect(() => {
    const appliedTokens = new Set<string>();

    const handle = (payload: { token: string; user: { id: string; username: string } }) => {
      if (appliedTokens.has(payload.token)) return;
      appliedTokens.add(payload.token);
      void completeExternalLoginRef.current?.(payload.token, {
        id: payload.user.id,
        username: payload.user.username,
      });
    };

    const unsubscribe = ipcBridge.auth.externalLoginCompleted.on(handle);

    void ipcBridge.auth.claimPending
      .invoke()
      .then((pending) => {
        if (pending) handle(pending);
      })
      .catch(() => {
        /* no pending token — the event above is the normal path */
      });

    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    setStatus('checking');
    const stored = readExternalAuth();
    if (stored) {
      signedInRef.current = true;
      setUser({ id: stored.userId, username: stored.username, token: stored.token });
      setStatus('authenticated');
    } else {
      signedInRef.current = false;
      setUser(null);
      setStatus('unauthenticated');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const performExternalLogin = useCallback(
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

      // Switch the backend to this account's data directory before anything
      // talks to it — the backend may have been serving another account's
      // database.
      let backendRestarted = false;
      try {
        backendRestarted = await activateAccount(payload.id, payload.username);
      } catch (error) {
        console.error('Failed to activate the account scope:', error);
        // The app is now signed in but pointing at the previous account's
        // data. Tell the user rather than letting them write into the wrong
        // account's database.
        Message.error(t('common.accountSwitchFailed'));
      }
      if (backendRestarted) {
        // The backend now serves a different account's data, so everything the
        // renderer cached for the previous account is wrong: the conversation
        // list, the project tree, the assistants, the providers, the settings.
        //
        // Drop that state explicitly instead of reloading the page: a reload
        // tore down the whole renderer and left the window blank while it
        // came back. Every cache that can hold account data registers a reset
        // in `resetAccountState` — a store that is not registered there keeps
        // the previous account's data, so new ones must be added to it.
        //
        // This runs BEFORE the post-login bootstraps below: those populate
        // the provider list and the knowledge-base servers for the new
        // account, and a later cache clear would throw that work away.
        //
        // `reload: true` — the backend now serves the new account's data
        // directory, so the renderer must load from it. The conversation list
        // in particular fetches only once on mount and would otherwise stay
        // empty.
        //
        // `keepAuth: true` — the identity was written a few lines above, and
        // this reset clears the account-scoped localStorage keys. Without
        // this the switch would delete the session it had just established:
        // the renderer keeps working from memory, but the next reload finds
        // no session and bounces the user back to the login page.
        await resetAccountState({ reload: true, keepAuth: true });
      }

      // Fire-and-forget:登录成功后自动从 AIPAAS 取 NewAPI Key 密文并尝试自动建 provider。
      // 失败静默,不阻塞 /guid 跳转。详见 docs/superpowers/specs/2026-09-24-newapi-postlogin-design.md。
      void runNewapiPostLogin(token);
      // Fire-and-forget: ensure the default knowledge-base MCP server exists after login.
      void ensureKnowledgeServerMcp();
    },
    [t]
  );

  const completeExternalLogin = useCallback(
    async (token: string, payload: { id: string; username: string }) => {
      // The session is valid again the moment the login succeeds, so the
      // "token expired" guard is cleared synchronously — before the queued
      // switch below, which may still be waiting its turn.
      tokenExpiredFiredRef.current = false;
      // The session counts as signed in from here on, not from when the
      // queued switch happens to run: a token-expiry report that arrives
      // while the switch is still pending must still be acted on.
      signedInRef.current = true;

      // Queued: a second deep-link callback must not run on top of this one.
      //
      // The queue never wedges: it continues on failure, and the failure is
      // reported rather than swallowed. A switch that cannot complete must
      // not leave the user on the login page with no explanation.
      const run = accountSwitchQueueRef.current.then(
        () => performExternalLogin(token, payload),
        () => performExternalLogin(token, payload)
      );
      accountSwitchQueueRef.current = run.then(
        (): undefined => undefined,
        (): undefined => undefined
      );

      try {
        await run;
      } catch (error) {
        console.error('Failed to complete the account switch:', error);
        Message.error(t('common.accountSwitchFailed'));
      }
    },
    [t]
  );

  // Keep the deep-link subscription pointed at the current implementation.
  // Done in an effect rather than during render: a render may be discarded,
  // and the ref must only ever hold a callback that was actually committed.
  useEffect(() => {
    completeExternalLoginRef.current = completeExternalLogin;
  }, [completeExternalLogin]);

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
    signedInRef.current = false;
    setUser(null);
    setStatus('unauthenticated');
    clearAuthCache();
    // The renderer holds the signed-out account's data in memory — the
    // conversation list, the project tree, the assistants, the providers.
    // Drop it explicitly so none of it is left behind for whoever signs in
    // next; reloading the page used to do this, at the cost of a blank
    // window while the renderer came back.
    await resetAccountState();
  }, []);

  const notifyTokenExpired = useCallback(
    (_source: TokenExpiredSource) => {
      // Already signed out: nothing to expire.
      //
      // Signing out invalidates the token, so a request that was already in
      // flight comes back 401 — and that is expected, the user just signed
      // out on purpose. Reporting it would tell them "登录已过期，请重新登录"
      // on top of the sign-out they just performed, and the second logout it
      // triggers would race the first one's account teardown.
      if (!signedInRef.current) return;
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
