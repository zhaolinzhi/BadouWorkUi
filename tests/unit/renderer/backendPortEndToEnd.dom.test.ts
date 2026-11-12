/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type TransportEmitter = {
  emit: (name: string, data: unknown) => unknown;
};

/**
 * A loopback bridge that JSON round-trips every message, mirroring the real
 * Electron IPC transport (adapter/main.ts serializes with JSON.stringify).
 *
 * The main process publishes the new port with `ipcBridge.account.portChanged
 * .emit(...)`; that travels over the bridge and lands in the renderer, where
 * the bridge's own port store has to pick it up.
 */
const loadLoopbackBridge = async () => {
  vi.resetModules();
  const { bridge } = await import('@/common/platform/bridge');
  let incoming: TransportEmitter | undefined;
  const outbound: Array<{ name: string; data: unknown }> = [];

  bridge.adapter({
    emit(name, data) {
      outbound.push({ name, data });
      const wire = JSON.stringify({ name, data });
      const parsed = JSON.parse(wire) as { name: string; data: unknown };
      return incoming?.emit(parsed.name, parsed.data);
    },
    on(emitter) {
      incoming = emitter;
    },
  });

  return { bridge, getIncoming: () => incoming, outbound };
};

describe('backend port end to end', () => {
  beforeEach(() => {
    Object.defineProperty(window, '__backendPort', {
      value: 4321,
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as Window & { __backendPort?: number }).__backendPort;
    vi.restoreAllMocks();
  });

  it('carries the port from the main process to the renderer', async () => {
    const { bridge, outbound } = await loadLoopbackBridge();
    const { subscribeToBackendPortChanges, getBackendPort, getBaseUrl, __resetBackendPortForTests } =
      await import('@/common/adapter/httpBridge');
    __resetBackendPortForTests();

    const unsubscribe = subscribeToBackendPortChanges();

    // What the main process does when the backend restarts on a new port.
    bridge.emit('account:port-changed', { backendPort: 45678 });

    expect(outbound.map((e) => e.name)).toContain('account:port-changed');
    expect(getBackendPort()).toBe(45678);
    expect(getBaseUrl()).toBe('http://127.0.0.1:45678');

    unsubscribe();
  });

  it('uses the same event name the account bridge emitter publishes', async () => {
    const { bridge } = await loadLoopbackBridge();
    const { ipcBridge } = await import('@/common');
    const { subscribeToBackendPortChanges, getBackendPort, __resetBackendPortForTests } =
      await import('@/common/adapter/httpBridge');
    __resetBackendPortForTests();

    const unsubscribe = subscribeToBackendPortChanges();

    // The real main-process call site.
    ipcBridge.account.portChanged.emit({ backendPort: 45678 });

    expect(getBackendPort()).toBe(45678);

    unsubscribe();
  });
});
