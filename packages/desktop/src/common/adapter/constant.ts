/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export const ADAPTER_BRIDGE_EVENT_KEY = 'office-ai-bridge-adapter';

/**
 * Bridge event carrying the backend's new port.
 *
 * The backend listens on an ephemeral port, so a restart — the account switch
 * restarts it against another account's data directory — moves it. The main
 * process publishes the new port under this name and the renderer's bridge
 * picks it up.
 *
 * The name lives here so the publisher and the subscriber cannot drift apart:
 * `adapter/ipcBridge.ts` and `adapter/httpBridge.ts` import each other, and a
 * shared constant is the only way to keep both sides in step.
 */
export const ACCOUNT_PORT_CHANGED_EVENT = 'account:port-changed';
