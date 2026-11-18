/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const originalDataDir = process.env.DATA_DIR;

vi.mock('@process/services/database/runLegacyDatabaseMigrations', () => ({
  runLegacyDatabaseMigrations: async () => ({
    skipped: true,
    migrated: false,
    handoffRepair: { repairedColumns: [] },
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  application: { systemInfo: { provider: () => {} } },
}));

// `vi.mock` factories are hoisted above the module body, so the spies must be
// created with `vi.hoisted` to be available inside the factory.
const { startBackend, stopBackend, currentDataDirRef, startedDirs } = vi.hoisted(() => {
  const currentDataDirRef = { value: '' };
  const startedDirs: { dataDir: string; workDir: string; cacheDir: string }[] = [];
  return {
    currentDataDirRef,
    startedDirs,
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

vi.mock('@/process/account/accountStore', () => ({
  readActiveAccount: () => null,
  writeActiveAccount: vi.fn(),
  readLegacyAdopted: () => null,
  markLegacyAdopted: vi.fn(),
}));

vi.mock('@/process/account/migrateLegacyAccountData', () => ({
  adoptLegacyDataIfNeeded: vi.fn(async () => ({ adopted: false, reason: 'already-adopted' })),
}));

import { setActiveAccount } from '@/process/account/accountBridge';
import { resolveAccountScope, clearActiveScope } from '@/process/account/accountScope';

/**
 * The directories the backend is actually launched with.
 *
 * `index.ts` starts the backend with `getSystemDir()`, whose work/cache dirs
 * are resolved from the active account scope. This helper reproduces that
 * lookup at the moment the backend would start, so the test can assert the
 * backend was pointed at the NEW account's tree.
 */
async function readBackendDirs(dataDir: string): Promise<{ dataDir: string; workDir: string; cacheDir: string }> {
  const { getSystemDir } = await import('@/process/utils/initStorage');
  const sysDir = getSystemDir();
  return { dataDir, workDir: sysDir.workDir, cacheDir: sysDir.cacheDir };
}

describe('account switch gives the backend the new account directories', () => {
  let tmpRoot = '';

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-account-dirs-'));
    process.env.DATA_DIR = tmpRoot;
    clearActiveScope();
    vi.clearAllMocks();
    currentDataDirRef.value = '';
    startedDirs.length = 0;
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    clearActiveScope();
  });

  it('starts the first account against its own directories', async () => {
    const alice = resolveAccountScope('u1', 'Alice', tmpRoot);

    startBackend.mockImplementationOnce(async (dataDir: string) => {
      startedDirs.push(await readBackendDirs(dataDir));
      currentDataDirRef.value = dataDir;
      return 45678;
    });

    await setActiveAccount('u1', 'Alice');

    expect(startedDirs).toHaveLength(1);
    expect(startedDirs[0].dataDir).toBe(alice.dataDir);
    expect(startedDirs[0].workDir).toBe(alice.dataDir);
    expect(startedDirs[0].cacheDir).toBe(alice.configDir);
  });

  it("starts the second account against its own directories, not the first account's", async () => {
    const alice = resolveAccountScope('u1', 'Alice', tmpRoot);
    const bob = resolveAccountScope('u2', 'Bob', tmpRoot);

    startBackend.mockImplementation(async (dataDir: string) => {
      startedDirs.push(await readBackendDirs(dataDir));
      currentDataDirRef.value = dataDir;
      return 45678;
    });

    await setActiveAccount('u1', 'Alice');
    await setActiveAccount('u2', 'Bob');

    expect(startedDirs).toHaveLength(2);
    const [first, second] = startedDirs;
    expect(first.workDir).toBe(alice.dataDir);
    expect(second.workDir).toBe(bob.dataDir);
    expect(second.cacheDir).toBe(bob.configDir);
    // The second account must not write into the first account's tree.
    expect(second.workDir).not.toBe(alice.dataDir);
    expect(second.cacheDir).not.toBe(alice.configDir);
  });
});
