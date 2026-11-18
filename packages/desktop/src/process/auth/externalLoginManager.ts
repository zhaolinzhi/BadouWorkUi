/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { shell } from 'electron';
import { ipcBridge } from '@/common';
import { EXTERNAL_LOGIN_DEEPLINK_PATH, getExternalLoginUrl } from '@/renderer/api/config';

export interface ExternalLoginLaunchResult {
  success: boolean;
  message?: string;
}

interface ResolvedPayload {
  token: string;
  userId: string;
  username: string;
}

interface ParseResult {
  success: boolean;
  reason?: string;
  value?: ResolvedPayload;
}

function parseDeepLinkParams(params: Record<string, unknown>): ParseResult {
  const token = params.token;
  const userId = params.userId;
  const username = params.username;
  if (typeof token !== 'string' || !token) return { success: false, reason: 'token-missing-or-empty' };
  if (typeof userId !== 'string' || !userId) return { success: false, reason: 'userId-missing' };
  if (typeof username !== 'string' || !username) return { success: false, reason: 'username-missing' };
  return { success: true, value: { token, userId, username } };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

let inFlight: Promise<ExternalLoginLaunchResult> | null = null;

export function startExternalLogin(): Promise<ExternalLoginLaunchResult> {
  if (inFlight) return inFlight;

  const url = getExternalLoginUrl();

  const outcome = new Promise<ExternalLoginLaunchResult>((resolve) => {
    if (!isValidUrl(url)) {
      resolve({ success: false, message: `Invalid URL: ${url}` });
      return;
    }

    shell
      .openExternal(url)
      .then(() => {
        resolve({ success: true });
      })
      .catch((error: Error) => {
        resolve({ success: false, message: error.message });
      });
  });

  inFlight = outcome.finally(() => {
    inFlight = null;
  });

  return outcome;
}

/**
 * The auth payload that arrived but has not been claimed by the renderer yet.
 *
 * The renderer subscribes to `externalLoginCompleted` from AuthProvider's
 * mount effect, which runs after the app's first render. A deep link that
 * lands before that effect runs would be emitted into the void — the event
 * is delivered straight through IPC, with no buffering on either side — and
 * the user would sit on the login page forever with a valid token.
 *
 * Holding the payload here and letting the renderer claim it closes that
 * window: the provider asks for the pending token as soon as it mounts, and
 * gets it whether the event arrived before or after.
 */
let pendingExternalLogin: { token: string; user: { id: string; username: string } } | null = null;

/**
 * Called by `process/utils/deepLink.ts` when an `aionui://auth/callback`
 * URL arrives. Validates the payload, then emits `externalLoginCompleted`
 * to the renderer. The renderer's AuthProvider listener calls
 * AuthContext.completeExternalLogin and navigates to /guid.
 *
 * Returns `{ ok: true }` on success or `{ ok: false, reason }` on a bad
 * payload — the caller (deepLink.ts) can log the reason.
 */
export function handleExternalLoginDeepLink(params: Record<string, string>): { ok: boolean; reason?: string } {
  const parsed = parseDeepLinkParams(params);
  if (!parsed.success || !parsed.value) {
    return { ok: false, reason: parsed.reason };
  }

  const payload = {
    token: parsed.value.token,
    user: { id: parsed.value.userId, username: parsed.value.username },
  };

  // Hold it as well as emitting it: the emitter covers the case where the
  // renderer is already listening, and the held copy covers the case where it
  // is not (the payload is claimed on mount).
  pendingExternalLogin = payload;
  ipcBridge.auth.externalLoginCompleted.emit(payload);

  return { ok: true };
}

/**
 * Claim the pending external-login payload, if any.
 *
 * Called by the renderer when the provider mounts. Returns the payload once
 * — a second call returns null, so a provider that remounts cannot replay
 * an already-consumed token.
 */
export function claimPendingExternalLogin(): { token: string; user: { id: string; username: string } } | null {
  const payload = pendingExternalLogin;
  pendingExternalLogin = null;
  return payload;
}

/**
 * Whether the given deep-link action belongs to this module.
 * Imported by `process/utils/deepLink.ts` to route the callback.
 */
export function isExternalLoginAction(action: string): boolean {
  return action === EXTERNAL_LOGIN_DEEPLINK_PATH;
}

/**
 * Register the IPC handler for `auth:start-external-login`. Idempotent —
 * the caller (initExternalLogin) guards against duplicate registration.
 */
export function registerExternalLoginBridge(): void {
  ipcBridge.auth.startExternalLogin.provider(() => startExternalLogin());
  // The renderer pulls the pending payload when the provider mounts, so a
  // deep link that arrived before it was listening is not lost.
  ipcBridge.auth.claimPending.provider(() => claimPendingExternalLogin());
}
