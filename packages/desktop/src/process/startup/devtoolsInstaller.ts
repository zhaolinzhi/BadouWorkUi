/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import net from 'node:net';

const CRX_HOST = 'clients2.google.com';
const CRX_PORT = 443;
const REACHABILITY_TIMEOUT_MS = 3000;
const INSTALL_TIMEOUT_MS = 60000;

export type DevtoolsInstallResult = 'installed' | 'skipped' | 'failed';

export type DevtoolsInstallDeps = {
  /** Whether the Chrome Web Store CRX host can be reached at all. */
  isReachable: () => Promise<boolean>;
  /** Performs the actual extension download / registration. */
  install: () => Promise<void>;
  /** Upper bound for the install step. */
  timeoutMs: number;
};

/**
 * Probe the Chrome Web Store CRX endpoint with a plain TCP connect.
 *
 * Resolves false instead of throwing: an unreachable host is an expected
 * condition on restricted networks, not an error.
 */
export const isCrxHostReachable = (
  host: string = CRX_HOST,
  port: number = CRX_PORT,
  timeoutMs: number = REACHABILITY_TIMEOUT_MS
): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (reachable: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(reachable);
    };
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });

/**
 * Install React Developer Tools in dev mode without ever blocking app startup.
 *
 * The download goes to clients2.google.com. On restricted networks the socket
 * blocks until the OS timeout (~4 minutes per attempt) and the installer
 * retries five times, which used to freeze `bun run dev` for ~20 minutes with
 * no window on screen. Two guards fix that:
 *
 * 1. A cheap reachability probe skips the download entirely when the host is
 *    unreachable.
 * 2. The install itself is time-boxed and never rejects — a failed DevTools
 *    install must not take the app down with it.
 */
export const installReactDevTools = async (deps: DevtoolsInstallDeps): Promise<DevtoolsInstallResult> => {
  let reachable = false;
  try {
    reachable = await deps.isReachable();
  } catch {
    reachable = false;
  }
  if (!reachable) return 'skipped';

  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      deps.install(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('devtools install timed out')), deps.timeoutMs);
      }),
    ]);
    return 'installed';
  } catch {
    return 'failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * Entry point used by the main process: fire-and-forget, never awaited.
 */
export const installReactDevToolsInBackground = (): void => {
  void (async () => {
    const result = await installReactDevTools({
      isReachable: () => isCrxHostReachable(),
      install: async () => {
        const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');
        await installExtension(REACT_DEVELOPER_TOOLS);
      },
      timeoutMs: INSTALL_TIMEOUT_MS,
    });

    if (result === 'installed') {
      console.log('[DevTools] React Developer Tools installed');
    } else if (result === 'skipped') {
      console.warn('[DevTools] Skipped React DevTools install: Chrome Web Store host is unreachable');
    } else {
      console.warn('[DevTools] Failed to install React DevTools');
    }
  })();
};
