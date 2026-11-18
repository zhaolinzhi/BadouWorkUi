/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/process/account/accountStore', () => ({
  readActiveAccount: () => ({ userId: 'u1', username: 'Alice', lastActiveAt: 1 }),
  writeActiveAccount: vi.fn(),
  readLegacyAdopted: () => null,
  markLegacyAdopted: vi.fn(),
}));

vi.mock('@/process/utils/utils', () => ({
  getUserDataRoot: () => '/mock/userData',
}));

import { resolveStartupAccountScope } from '@/process/account/startupScope';
import { getActiveScope } from '@/process/account/accountScope';

describe('resolveStartupAccountScope', () => {
  it('resolves the persisted account scope', async () => {
    const scope = await resolveStartupAccountScope();
    expect(scope?.userId).toBe('u1');
    expect(scope?.username).toBe('Alice');
    expect(scope?.dataDir).toContain('accounts');
  });

  it('activates the scope so path helpers resolve to the account', async () => {
    await resolveStartupAccountScope();
    expect(getActiveScope()?.userId).toBe('u1');
  });
});
