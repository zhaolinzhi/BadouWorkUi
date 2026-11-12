/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getBaseUrl, setBackendPort, getBackendPort } from '@/common/adapter/httpBridge';

describe('backend port tracking in the renderer', () => {
  beforeEach(() => {
    // The preload injects the initial port. In the real app this property is
    // frozen by contextBridge, so it can never be reassigned — the renderer
    // needs its own mutable copy.
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

  it('uses the injected port for the base url', () => {
    expect(getBackendPort()).toBe(4321);
    expect(getBaseUrl()).toBe('http://127.0.0.1:4321');
  });

  it('follows the port after the backend is restarted on a new port', () => {
    setBackendPort(9876);

    expect(getBackendPort()).toBe(9876);
    expect(getBaseUrl()).toBe('http://127.0.0.1:9876');
  });

  it('keeps working after the injected port is frozen and cannot be reassigned', () => {
    // This is what the real preload does: contextBridge freezes primitives.
    expect(() => {
      (window as Window & { __backendPort?: number }).__backendPort = 5555;
    }).toThrow(TypeError);
    expect((window as Window & { __backendPort?: number }).__backendPort).toBe(4321);

    setBackendPort(9876);

    expect(getBackendPort()).toBe(9876);
  });

  it('does not report the webui browser mode once a port is known', () => {
    // A falsy port (0) must not flip the bridge into same-origin browser mode.
    setBackendPort(4321);
    expect(getBaseUrl()).toBe('http://127.0.0.1:4321');
  });
});
