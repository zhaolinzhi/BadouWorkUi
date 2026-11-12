/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { setBackendPort, __resetBackendPortForTests } from '@/common/adapter/httpBridge';

describe('configService backend url', () => {
  beforeEach(() => {
    __resetBackendPortForTests();
    // The preload installs the port with contextBridge, which freezes it.
    Object.defineProperty(window, '__backendPort', {
      value: 4321,
      writable: false,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (window as Window & { __backendPort?: number }).__backendPort;
    __resetBackendPortForTests();
    vi.restoreAllMocks();
  });

  it('requests the backend on the injected port', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}') as unknown as Response);

    const { configService } = await import('@/common/config/configService');
    configService.reset();
    await configService.initialize().catch(() => undefined);

    expect(fetchSpy.mock.calls[0][0]).toBe('http://127.0.0.1:4321/api/settings/client');
  });

  it('follows the port when the backend moves', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}') as unknown as Response);

    const { configService } = await import('@/common/config/configService');
    configService.reset();
    setBackendPort(9876);
    await configService.initialize().catch(() => undefined);

    expect(fetchSpy.mock.calls[0][0]).toBe('http://127.0.0.1:9876/api/settings/client');
  });
});
