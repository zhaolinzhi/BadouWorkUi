/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpRoot = '';

vi.mock('@/process/utils/utils', () => ({
  getUserDataRoot: () => tmpRoot,
}));

import { adoptLegacyDataIfNeeded } from '@/process/account/migrateLegacyAccountData';
import { resolveAccountScope } from '@/process/account/accountScope';
import { readLegacyAdopted, LEGACY_ADOPTED_FILE } from '@/process/account/accountStore';

describe('adoptLegacyDataIfNeeded', () => {
  let scope: ReturnType<typeof resolveAccountScope>;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-adopt-'));
    scope = resolveAccountScope('u1', 'Alice', tmpRoot);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('is a no-op when there is no legacy directory', async () => {
    const result = await adoptLegacyDataIfNeeded(scope);
    expect(result.adopted).toBe(false);
    expect(result.reason).toBe('no-legacy-dir');
  });

  it('copies the legacy data dir into the account data dir', async () => {
    const legacyData = path.join(tmpRoot, 'aionui');
    fs.mkdirSync(legacyData, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'aionui-backend.db'), 'fake-db');

    const result = await adoptLegacyDataIfNeeded(scope);

    expect(result.adopted).toBe(true);
    expect(fs.readFileSync(path.join(scope.dataDir, 'aionui-backend.db'), 'utf8')).toBe('fake-db');
  });

  it('copies the legacy config dir into the account config dir', async () => {
    const legacyConfig = path.join(tmpRoot, 'config');
    fs.mkdirSync(legacyConfig, { recursive: true });
    fs.writeFileSync(path.join(legacyConfig, 'aionui-config.txt'), 'fake-config');

    const result = await adoptLegacyDataIfNeeded(scope);

    expect(result.adopted).toBe(true);
    expect(fs.readFileSync(path.join(scope.configDir, 'aionui-config.txt'), 'utf8')).toBe('fake-config');
  });

  it('removes the legacy directories after a verified copy', async () => {
    const legacyData = path.join(tmpRoot, 'aionui');
    const legacyConfig = path.join(tmpRoot, 'config');
    fs.mkdirSync(legacyData, { recursive: true });
    fs.mkdirSync(legacyConfig, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'a.db'), 'x');
    fs.writeFileSync(path.join(legacyConfig, 'c.txt'), 'y');

    await adoptLegacyDataIfNeeded(scope);

    expect(fs.existsSync(legacyData)).toBe(false);
    expect(fs.existsSync(legacyConfig)).toBe(false);
  });

  it('writes the adoption marker', async () => {
    const legacyData = path.join(tmpRoot, 'aionui');
    fs.mkdirSync(legacyData, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'a.db'), 'x');

    await adoptLegacyDataIfNeeded(scope);

    expect(readLegacyAdopted()?.byAccount).toBe('u1');
  });

  it('does not adopt twice', async () => {
    const legacyData = path.join(tmpRoot, 'aionui');
    fs.mkdirSync(legacyData, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'a.db'), 'x');
    await adoptLegacyDataIfNeeded(scope);

    // Recreate the legacy dir to prove the marker prevents a second adoption.
    fs.mkdirSync(legacyData, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'a.db'), 'second');
    const second = await adoptLegacyDataIfNeeded(scope);

    expect(second.adopted).toBe(false);
    expect(second.reason).toBe('already-adopted');
    expect(fs.readFileSync(path.join(scope.dataDir, 'a.db'), 'utf8')).toBe('x');
  });

  it('keeps the source when the copy fails', async () => {
    const legacyData = path.join(tmpRoot, 'aionui');
    fs.mkdirSync(legacyData, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'a.db'), 'x');
    // Block the destination with a regular file so the copy cannot succeed.
    fs.mkdirSync(path.dirname(scope.dataDir), { recursive: true });
    fs.writeFileSync(scope.dataDir, 'blocked');

    const result = await adoptLegacyDataIfNeeded(scope);

    expect(result.adopted).toBe(false);
    expect(result.reason).toBe('copy-failed');
    expect(fs.existsSync(legacyData)).toBe(true);
    expect(fs.existsSync(path.join(tmpRoot, LEGACY_ADOPTED_FILE))).toBe(false);
  });

  it('does not write the marker when the copy fails', async () => {
    const legacyData = path.join(tmpRoot, 'aionui');
    fs.mkdirSync(legacyData, { recursive: true });
    fs.writeFileSync(path.join(legacyData, 'a.db'), 'x');
    fs.mkdirSync(path.dirname(scope.dataDir), { recursive: true });
    fs.writeFileSync(scope.dataDir, 'blocked');

    await adoptLegacyDataIfNeeded(scope);

    expect(readLegacyAdopted()).toBeNull();
  });
});
