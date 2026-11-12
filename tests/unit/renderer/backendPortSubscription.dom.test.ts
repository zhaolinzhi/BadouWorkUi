/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// `vi.mock` factories are hoisted above the module body, so the spy must be
// created with `vi.hoisted` to be available inside the factory.
const { bridgeOn } = vi.hoisted(() => {
  const listeners: ((payload: unknown) => void)[] = [];
  return {
    bridgeOn: vi.fn((_name: string, callback: (payload: unknown) => void) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      };
    }),
    __listeners: listeners,
  };
});

vi.mock('@/common/platform/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/common/platform/bridge')>();
  return { ...actual, bridge: { ...actual.bridge, on: bridgeOn } };
});

import { ACCOUNT_PORT_CHANGED_EVENT } from '@/common/adapter/constant';
import {
  subscribeToBackendPortChanges,
  getBackendPort,
  getBaseUrl,
  __resetBackendPortForTests,
} from '@/common/adapter/httpBridge';

describe('backend port subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetBackendPortForTests();
    Object.defineProperty(window, '__backendPort', {
      value: 4321,
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as Window & { __backendPort?: number }).__backendPort;
  });

  it('follows the port the main process publishes', () => {
    const unsubscribe = subscribeToBackendPortChanges();

    // The event the main process publishes.
    const listener = bridgeOn.mock.calls[0][1] as (payload: unknown) => void;
    listener({ backendPort: 55555 });

    expect(getBackendPort()).toBe(55555);
    expect(getBaseUrl()).toBe('http://127.0.0.1:55555');

    unsubscribe();
  });

  it('subscribes to the event the account bridge publishes', () => {
    subscribeToBackendPortChanges();

    expect(bridgeOn).toHaveBeenCalledWith(ACCOUNT_PORT_CHANGED_EVENT, expect.any(Function));
  });

  it('ignores a payload without a port', () => {
    subscribeToBackendPortChanges();

    const listener = bridgeOn.mock.calls[0][1] as (payload: unknown) => void;
    listener({});
    listener(undefined);

    expect(getBackendPort()).toBe(4321);
  });
});
