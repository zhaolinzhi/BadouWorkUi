/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Publishing the backend port when it changes.
 *
 * The backend listens on an ephemeral port, so a restart — the account switch
 * restarts it against another account's data directory — moves it. Two
 * audiences need to learn the new port:
 *
 * - The main process, which reads `globalThis.__backendPort` for its own
 *   `ipcBridge` calls (the one-shot assistant migration hook, the WebUI
 *   starter).
 * - The renderer, whose `window.__backendPort` is installed by the preload
 *   with `contextBridge.exposeInMainWorld` and is therefore frozen: it can
 *   hold only the value from preload time. The renderer keeps its own mutable
 *   copy and updates it from the `account:port-changed` event.
 */

import { ipcBridge } from '@/common';

/**
 * Record the backend's current port and tell the renderer about it.
 *
 * @param backendPort The port the backend is now listening on.
 */
export function publishBackendPort(backendPort: number): void {
  if (!Number.isFinite(backendPort) || backendPort <= 0) return;

  (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort = backendPort;
  ipcBridge.account.portChanged.emit({ backendPort });
}
