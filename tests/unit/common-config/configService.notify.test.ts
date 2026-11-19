/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configService } from '@/common/config/configService';

/**
 * A minimal `/api/settings/client` response body: the service unwraps a
 * `data` envelope when the content type is JSON.
 */
function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

beforeEach(() => {
  configService.reset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  configService.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('configService — the initial load notifies subscribers', () => {
  it('notifies a subscriber that mounted before the initial fetch finished', async () => {
    // The app no longer blocks its first paint on the config fetch, so a
    // consumer can mount while the cache is still empty. Without a
    // notification it would keep rendering the stale value forever.
    const seen: unknown[] = [];
    configService.subscribe('language', (value) => seen.push(value));

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { language: 'zh-CN' } }));

    await configService.initialize();

    expect(seen).toEqual(['zh-CN']);
    expect(configService.get('language')).toBe('zh-CN');
  });

  it('notifies every subscribed key, not just the ones in the response', async () => {
    const seenLanguage: unknown[] = [];
    const seenActiveId: unknown[] = [];
    configService.subscribe('language', (value) => seenLanguage.push(value));
    configService.subscribe('theme.activeId', (value) => seenActiveId.push(value));

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { language: 'en-US' } }));

    await configService.initialize();

    // `theme.activeId` was not in the payload, but its subscriber still has to
    // be told, or it keeps a value the cache no longer holds.
    expect(seenLanguage).toEqual(['en-US']);
    expect(seenActiveId).toEqual([undefined]);
  });

  it('notifies only once when initialize is called twice', async () => {
    const seen: unknown[] = [];
    configService.subscribe('language', (value) => seen.push(value));

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { language: 'en-US' } }));

    await configService.initialize();
    await configService.initialize();

    // `initialize` is idempotent: the second call reuses the in-flight
    // promise rather than re-fetching, so it must not re-notify.
    expect(seen).toEqual(['en-US']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not notify when the initial fetch fails', async () => {
    const seen: unknown[] = [];
    configService.subscribe('language', (value) => seen.push(value));

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      text: async () => 'boom',
    } as unknown as Response);

    await expect(configService.initialize()).rejects.toThrow(/500/);

    // The cache was never populated, so there is nothing new to announce.
    expect(seen).toEqual([]);
  });

  it('still notifies on a later write', async () => {
    const seen: unknown[] = [];
    configService.subscribe('language', (value) => seen.push(value));

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { language: 'en-US' } }));
    await configService.initialize();

    vi.mocked(fetch).mockResolvedValue(jsonResponse(undefined));
    await configService.set('language', 'ja-JP');

    expect(seen).toEqual(['en-US', 'ja-JP']);
  });
});
