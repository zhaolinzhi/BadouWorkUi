/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// A real temp directory: the bridge creates the account's directories, so the
// root has to be writable.
let mockUserData = '';

vi.mock('@/process/utils/utils', () => ({
  getUserDataRoot: () => mockUserData,
}));

vi.mock('@/process/account/accountStore', () => ({
  readActiveAccount: () => null,
  writeActiveAccount: vi.fn(),
  readLegacyAdopted: () => null,
  markLegacyAdopted: vi.fn(),
}));

vi.mock('@/process/account/migrateLegacyAccountData', () => ({
  adoptLegacyDataIfNeeded: vi.fn(async () => ({ adopted: false, reason: 'already-adopted' })),
}));

// `vi.mock` factories are hoisted above the module body, so the spies must be
// created with `vi.hoisted` to be available inside the factory.
const { startBackend, stopBackend, currentDataDirRef } = vi.hoisted(() => {
  const currentDataDirRef = { value: '' };
  return {
    currentDataDirRef,
    // Mirror the real lifecycle manager: it remembers the directory the
    // running backend was started against, and forgets it on stop.
    startBackend: vi.fn(async (dataDir: string) => {
      currentDataDirRef.value = dataDir;
      return 45678;
    }),
    stopBackend: vi.fn(async () => {
      currentDataDirRef.value = '';
    }),
  };
});

vi.mock('@/process/account/backendControl', () => ({
  getCurrentBackendDataDir: () => currentDataDirRef.value,
  startBackendForAccount: startBackend,
  stopBackendForAccount: stopBackend,
}));

import {
  setActiveAccount,
  clearActiveAccount,
  getActiveAccount,
  initAccountBridge,
  __resetAccountBridgeForTests,
} from '@/process/account/accountBridge';
import { getActiveScope } from '@/process/account/accountScope';

describe('accountBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentDataDirRef.value = '';
    __resetAccountBridgeForTests();
    mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-account-bridge-'));
  });

  afterEach(() => {
    fs.rmSync(mockUserData, { recursive: true, force: true });
  });

  it('starts the backend against the account directory on first sign-in', async () => {
    const result = await setActiveAccount('u1', 'Alice');

    expect(startBackend).toHaveBeenCalledTimes(1);
    expect(startBackend.mock.calls[0][0]).toContain('accounts');
    expect(result.restarted).toBe(true);
    expect(result.backendPort).toBe(45678);
  });

  it('sets the active scope after switching', async () => {
    await setActiveAccount('u1', 'Alice');

    expect(getActiveScope()?.userId).toBe('u1');
  });

  it('does not restart the backend for the same account', async () => {
    await setActiveAccount('u1', 'Alice');
    startBackend.mockClear();

    const result = await setActiveAccount('u1', 'Alice');

    expect(startBackend).not.toHaveBeenCalled();
    expect(result.restarted).toBe(false);
  });

  it('restarts the backend for a different account', async () => {
    await setActiveAccount('u1', 'Alice');
    startBackend.mockClear();

    const result = await setActiveAccount('u2', 'Bob');

    expect(stopBackend).toHaveBeenCalled();
    expect(startBackend).toHaveBeenCalledTimes(1);
    expect(result.restarted).toBe(true);
  });

  it('stops the backend and clears the scope on sign-out', async () => {
    await setActiveAccount('u1', 'Alice');
    stopBackend.mockClear();

    await clearActiveAccount();

    expect(stopBackend).toHaveBeenCalled();
    expect(getActiveScope()).toBeNull();
  });

  it('reports the active account', async () => {
    await setActiveAccount('u1', 'Alice');

    expect(getActiveAccount()).toEqual({ userId: 'u1', username: 'Alice' });
  });

  it('reports no active account after sign-out', async () => {
    await setActiveAccount('u1', 'Alice');
    await clearActiveAccount();

    expect(getActiveAccount()).toBeNull();
  });

  it('registers the IPC handlers without throwing', () => {
    expect(() => initAccountBridge()).not.toThrow();
    // Idempotent — a second call is a no-op.
    expect(() => initAccountBridge()).not.toThrow();
  });
});
