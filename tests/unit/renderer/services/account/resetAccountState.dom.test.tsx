/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { useSWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isAccountStorageKey, resetAccountState } from '@/renderer/services/account/resetAccountState';
import { configService } from '@/common/config/configService';

beforeEach(() => {
  localStorage.clear();
  configService.reset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  configService.reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isAccountStorageKey', () => {
  it('matches the account-scoped keys', () => {
    expect(isAccountStorageKey('external_auth')).toBe(true);
    expect(isAccountStorageKey('team-pinned-ids')).toBe(true);
    expect(isAccountStorageKey('preview-ui:conversation-1')).toBe(true);
  });

  it('does not match the device preferences that must survive a sign-out', () => {
    // Theme, language and font size belong to the device, not the account.
    expect(isAccountStorageKey('__aionui_theme')).toBe(false);
    expect(isAccountStorageKey('i18nextLng')).toBe(false);
  });

  it('does not match an unrelated key', () => {
    expect(isAccountStorageKey('some-other-key')).toBe(false);
  });
});

describe('resetAccountState', () => {
  it('removes the account-scoped localStorage keys', async () => {
    localStorage.setItem('external_auth', '{"token":"t"}');
    localStorage.setItem('team-pinned-ids', '["a"]');
    localStorage.setItem('__aionui_theme', 'dark');

    await resetAccountState();

    expect(localStorage.getItem('external_auth')).toBeNull();
    expect(localStorage.getItem('team-pinned-ids')).toBeNull();
    // The theme is a device preference — it must survive the switch.
    expect(localStorage.getItem('__aionui_theme')).toBe('dark');
  });

  it('keeps the signed-in identity when keepAuth is set, but drops the other account data', async () => {
    // An account switch writes the new identity and then clears the previous
    // account's state. The identity must survive that reset — it is the
    // session the switch just established, not leftovers from the old one.
    localStorage.setItem('external_auth', '{"token":"t"}');
    localStorage.setItem('team-pinned-ids', '["a"]');
    localStorage.setItem('preview-ui:conversation-1', '{}');
    localStorage.setItem('__aionui_theme', 'dark');

    await resetAccountState({ keepAuth: true });

    expect(localStorage.getItem('external_auth')).toBe('{"token":"t"}');
    // Everything else the previous account left behind still goes.
    expect(localStorage.getItem('team-pinned-ids')).toBeNull();
    expect(localStorage.getItem('preview-ui:conversation-1')).toBeNull();
    expect(localStorage.getItem('__aionui_theme')).toBe('dark');
  });

  it('clears the client settings, which live in the account data directory', async () => {
    configService.setLocal('language', 'zh-CN');
    expect(configService.get('language')).toBe('zh-CN');

    await resetAccountState();

    expect(configService.get('language')).toBeUndefined();
  });

  it('clears the SWR cache so the next mount re-fetches for the new account', async () => {
    // Seed a cached SWR entry, then reset and check its data is gone.
    const { mutate } = await import('swr');
    await mutate('assistants.list', { stale: true }, false);

    let cachedData: unknown = 'unset';
    const Probe = () => {
      const { cache } = useSWRConfig();
      cachedData = (cache.get('assistants.list') as { data?: unknown } | undefined)?.data;
      return null;
    };
    render(<Probe />);
    expect(cachedData).toEqual({ stale: true });

    await resetAccountState();

    render(<Probe />);
    // The previous account's data must not survive the switch.
    expect(cachedData).toBeUndefined();
  });

  it('is safe to call when no account was ever signed in', async () => {
    await expect(resetAccountState()).resolves.toBeUndefined();
  });
});
