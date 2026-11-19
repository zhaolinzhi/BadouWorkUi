/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const mockUserData = '/mock/userData';

// The non-Electron platform services read the userData root from DATA_DIR
// (see common/platform/NodePlatformServices.ts), so setting it is enough to
// point the path helpers at a fake root — no module mocking needed.
const originalDataDir = process.env.DATA_DIR;

import { getDataPath, getConfigPath, getAccountSymlinkNames } from '@/process/utils/utils';
import { resolveAccountScope, setActiveScope, clearActiveScope } from '@/process/account/accountScope';

describe('account-scoped path resolution', () => {
  beforeEach(() => {
    process.env.DATA_DIR = mockUserData;
    clearActiveScope();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
  });

  it('falls back to the legacy directories with no active account', () => {
    expect(getDataPath()).toBe(`${mockUserData}/aionui`);
    expect(getConfigPath()).toBe(`${mockUserData}/config`);
  });

  it('resolves to the account directories when an account is active', () => {
    const scope = resolveAccountScope('u1', 'Alice', mockUserData);
    setActiveScope(scope);
    expect(getDataPath()).toBe(scope.dataDir);
    expect(getConfigPath()).toBe(scope.configDir);
  });

  it('returns to the legacy directories after the scope is cleared', () => {
    setActiveScope(resolveAccountScope('u1', 'Alice', mockUserData));
    clearActiveScope();
    expect(getDataPath()).toBe(`${mockUserData}/aionui`);
  });

  it('gives each account a distinct data dir', () => {
    const a = resolveAccountScope('u1', 'Alice', mockUserData);
    const b = resolveAccountScope('u2', 'Bob', mockUserData);
    expect(a.dataDir).not.toBe(b.dataDir);
  });

  it('derives per-account symlink names that do not collide', () => {
    const a = resolveAccountScope('u1', 'Alice', mockUserData);
    const b = resolveAccountScope('u2', 'Bob', mockUserData);
    const namesA = getAccountSymlinkNames(a);
    const namesB = getAccountSymlinkNames(b);
    expect(namesA.data).not.toBe(namesB.data);
    expect(namesA.data).toContain(a.key);
  });
});
