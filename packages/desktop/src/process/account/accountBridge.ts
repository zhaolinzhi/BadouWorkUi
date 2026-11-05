/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Account bridge: owns the switch between per-account data directories.
 *
 * Signing in resolves the account's directory and, when it differs from the
 * one the running backend uses, stops the backend and restarts it against the
 * new directory. The backend holds an exclusive lock on its data directory
 * (`<data-dir>/aionui-backend.db.instance.lock`), so the old instance must be
 * fully stopped before a new one can claim a different directory.
 *
 * The handlers are exported as plain functions and registered as IPC providers
 * separately: the logic is worth testing directly, and a main-process
 * `ipcBridge.*.invoke()` never resolves for an Electron-native provider (the
 * adapter only forwards to BrowserWindows, it does not loop back).
 */

import { ipcBridge } from '@/common';

import { resolveAccountScope, setActiveScope, clearActiveScope, getActiveScope } from './accountScope';
import { writeActiveAccount } from './accountStore';
import { adoptLegacyDataIfNeeded } from './migrateLegacyAccountData';
import { ensureAccountDirectories } from './ensureAccountDirectories';
import { getCurrentBackendDataDir, startBackendForAccount, stopBackendForAccount } from './backendControl';
import { getUserDataRoot } from '@/process/utils/utils';
import { stopDesktopWebUI } from '@/process/utils/webuiConfig';

/**
 * Sign in as an account.
 *
 * Switches the active data directory and, when the directory changed, stops
 * the running backend and starts a new one against the account's directory.
 */
export async function setActiveAccount(
  userId: string,
  username: string
): Promise<{
  backendPort: number;
  restarted: boolean;
}> {
  const scope = resolveAccountScope(userId, username, getUserDataRoot());

  // Fail loudly if the account's directories cannot be created. Falling
  // back to the shared directory would write this account's data where
  // another account can read it.
  ensureAccountDirectories(scope);

  // Adopt the legacy shared directories BEFORE the backend opens a database
  // in the account directory — otherwise the backend could read a partially
  // copied database.
  await adoptLegacyDataIfNeeded(scope);

  const currentDataDir = getCurrentBackendDataDir();
  let restarted = false;
  let backendPort = 0;

  if (currentDataDir !== scope.dataDir) {
    // The WebUI reuses the running backend, so it must not outlive it.
    await stopDesktopWebUI();
    await stopBackendForAccount();
    backendPort = await startBackendForAccount(scope.dataDir);
    restarted = true;
  } else {
    backendPort = getRunningBackendPort();
  }

  setActiveScope(scope);
  writeActiveAccount({ userId, username });

  return { backendPort, restarted };
}

/**
 * Sign out.
 *
 * Stops the backend and clears the active scope. `active-account.json` is
 * intentionally left in place: it records the account this machine last
 * used, so signing back in as the same account does not need a backend
 * restart.
 */
export async function clearActiveAccount(): Promise<void> {
  await stopDesktopWebUI();
  await stopBackendForAccount();
  clearActiveScope();
}

/** The account the main process is currently operating as, or null in local mode. */
export function getActiveAccount(): { userId: string; username: string } | null {
  const scope = getActiveScope();
  return scope ? { userId: scope.userId, username: scope.username } : null;
}

let initialized = false;

/**
 * Register the account IPC handlers. Idempotent — calling twice has no effect.
 */
export function initAccountBridge(): void {
  if (initialized) return;
  initialized = true;

  ipcBridge.account.setActive.provider(async ({ userId, username }) => setActiveAccount(userId, username));
  ipcBridge.account.clearActive.provider(async () => clearActiveAccount());
  ipcBridge.account.getActive.provider(async () => getActiveAccount());
}

/** Reset module state. Test-only. */
export function __resetAccountBridgeForTests(): void {
  initialized = false;
}

function getRunningBackendPort(): number {
  return (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort ?? 0;
}
