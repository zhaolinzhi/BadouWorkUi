/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// A real temp directory standing in for the macOS home directory, so the test
// can create the symlinks `ensureCliSafeSymlink` writes.
let mockHome = '';
let mockUserData = '';

vi.mock('@/common/platform', () => ({
  getPlatformServices: () => ({
    paths: {
      getDataDir: () => mockUserData,
      getHomeDir: () => mockHome,
      getTempDir: () => os.tmpdir(),
      getLogsDir: () => path.join(mockHome, 'logs'),
      isPackaged: () => false,
      needsCliSafeSymlinks: () => true,
    },
  }),
}));

import { getDataPath, getConfigPath, getAccountSymlinkNames } from '@/process/utils/utils';
import { resolveAccountScope, setActiveScope, clearActiveScope } from '@/process/account/accountScope';

describe('CLI-safe symlinks for account directories', () => {
  beforeEach(() => {
    mockHome = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-symlink-home-'));
    mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-symlink-data-'));
    clearActiveScope();
  });

  afterEach(() => {
    clearActiveScope();
    fs.rmSync(mockHome, { recursive: true, force: true });
    fs.rmSync(mockUserData, { recursive: true, force: true });
  });

  it('creates the symlink for an account data directory', () => {
    const scope = resolveAccountScope('u1', 'Alice', mockUserData);
    setActiveScope(scope);

    const dataPath = getDataPath();

    expect(dataPath).not.toBe(scope.dataDir);
    expect(fs.lstatSync(dataPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(dataPath)).toBe(fs.realpathSync(scope.dataDir));
  });

  it('creates the symlink for an account config directory', () => {
    const scope = resolveAccountScope('u1', 'Alice', mockUserData);
    setActiveScope(scope);

    const configPath = getConfigPath();

    expect(fs.lstatSync(configPath).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(configPath)).toBe(fs.realpathSync(scope.configDir));
  });

  it('creates the symlink parent directory when it is missing', () => {
    const scope = resolveAccountScope('u1', 'Alice', mockUserData);
    setActiveScope(scope);

    const names = getAccountSymlinkNames(scope);
    const parent = path.dirname(path.join(mockHome, names.data));
    expect(fs.existsSync(parent)).toBe(false);

    // Resolving the data path creates the symlink, and with it the parent
    // directory the per-account name lives in.
    getDataPath();

    expect(fs.existsSync(parent)).toBe(true);
  });

  it('gives each account its own symlink', () => {
    const a = resolveAccountScope('u1', 'Alice', mockUserData);
    setActiveScope(a);
    const pathA = getDataPath();
    clearActiveScope();

    const b = resolveAccountScope('u2', 'Bob', mockUserData);
    setActiveScope(b);
    const pathB = getDataPath();

    expect(pathA).not.toBe(pathB);
    expect(fs.lstatSync(pathA).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(pathB).isSymbolicLink()).toBe(true);
  });
});
