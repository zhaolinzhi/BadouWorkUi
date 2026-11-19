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

import { resolveAccountScope, setActiveScope, clearActiveScope } from '@/process/account/accountScope';

describe('initStorage account scoping', () => {
  let tmpRoot = '';

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-init-storage-'));
    process.env.DATA_DIR = tmpRoot;
    clearActiveScope();
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    clearActiveScope();
  });

  it('falls back to the shared dirs with no active account', async () => {
    const { getSystemDir } = await import('@/process/utils/initStorage');
    const sysDir = getSystemDir();

    expect(sysDir.cacheDir).toBe(path.join(tmpRoot, 'config'));
    expect(sysDir.workDir).toBe(path.join(tmpRoot, 'aionui'));
  });

  it('resolves the config and work dirs from the active account scope', async () => {
    const scope = resolveAccountScope('u1', 'Alice', tmpRoot);
    setActiveScope(scope);

    const { getSystemDir } = await import('@/process/utils/initStorage');
    const sysDir = getSystemDir();

    expect(sysDir.cacheDir).toBe(scope.configDir);
    expect(sysDir.workDir).toBe(scope.dataDir);
  });

  it('keeps the ProcessConfig.get contract async', async () => {
    const { ProcessConfig } = await import('@/process/utils/initStorage');
    const pending = ProcessConfig.get('language');
    expect(typeof pending.then).toBe('function');
    await expect(pending).resolves.toBeUndefined();
  });

  it('exposes a synchronous getSync on ProcessConfig', async () => {
    const { ProcessConfig } = await import('@/process/utils/initStorage');
    expect(ProcessConfig.getSync('language')).toBeUndefined();
  });
});
