/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regression: in dev the renderer loads the Vite dev server over HTTP, and
 * Chromium's HTTP cache kept serving a stale module graph. Vite re-bundles the
 * optimized dependencies with new content hashes on every restart, so the
 * cached import of the old chunk 404s, the module graph fails to load and the
 * window stays blank.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

const { clearCache, clearCodeCaches, appendSwitch, defaultSession } = vi.hoisted(() => {
  const clearCache = vi.fn(async () => {});
  const clearCodeCaches = vi.fn(async () => {});
  const appendSwitch = vi.fn();
  const defaultSession = {
    clearCache,
    clearCodeCaches,
  };
  return { clearCache, clearCodeCaches, appendSwitch, defaultSession };
});

vi.mock('electron', () => ({
  session: {
    defaultSession,
  },
  app: {
    isPackaged: false,
    commandLine: {
      appendSwitch,
    },
  },
}));

import { disableRendererHttpCacheInDev } from '@/process/startup/devRendererCache';

describe('dev renderer HTTP cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the cached modules so a stale chunk cannot be served', async () => {
    await disableRendererHttpCacheInDev();

    expect(clearCache).toHaveBeenCalled();
  });

  it('clears the code caches too', async () => {
    await disableRendererHttpCacheInDev();

    expect(clearCodeCaches).toHaveBeenCalled();
  });
});
