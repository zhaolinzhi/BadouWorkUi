/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { installReactDevTools } from '@/process/startup/devtoolsInstaller';

describe('installReactDevTools', () => {
  it('reports installed when the extension download succeeds', async () => {
    const install = vi.fn().mockResolvedValue(undefined);

    const result = await installReactDevTools({
      isReachable: async () => true,
      install,
      timeoutMs: 1000,
    });

    expect(result).toBe('installed');
  });

  it('skips the download entirely when the CRX host is unreachable', async () => {
    const install = vi.fn();

    const result = await installReactDevTools({
      isReachable: async () => false,
      install,
      timeoutMs: 1000,
    });

    expect(result).toBe('skipped');
  });

  it('never attempts the download when the reachability probe throws', async () => {
    const install = vi.fn();

    const result = await installReactDevTools({
      isReachable: async () => {
        throw new Error('probe failed');
      },
      install,
      timeoutMs: 1000,
    });

    expect(result).toBe('skipped');
  });

  it('reports failed without throwing when the download rejects', async () => {
    const result = await installReactDevTools({
      isReachable: async () => true,
      install: async () => {
        throw new Error('crx download failed');
      },
      timeoutMs: 1000,
    });

    expect(result).toBe('failed');
  });

  it('gives up on a download that hangs past the timeout', async () => {
    vi.useFakeTimers();
    try {
      const pending = installReactDevTools({
        isReachable: async () => true,
        install: () => new Promise<void>(() => {}),
        timeoutMs: 1000,
      });

      await vi.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });
});
