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

import {
  ACTIVE_ACCOUNT_FILE,
  LEGACY_ADOPTED_FILE,
  readActiveAccount,
  writeActiveAccount,
  readLegacyAdopted,
  markLegacyAdopted,
} from '@/process/account/accountStore';

describe('accountStore', () => {
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aionui-account-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe('active account', () => {
    it('returns null when no file exists', () => {
      expect(readActiveAccount()).toBeNull();
    });

    it('round-trips the account', () => {
      writeActiveAccount({ userId: 'u1', username: 'Alice' });
      expect(readActiveAccount()).toEqual({
        userId: 'u1',
        username: 'Alice',
        lastActiveAt: expect.any(Number),
      });
    });

    it('returns null for a malformed file rather than throwing', () => {
      fs.writeFileSync(path.join(tmpRoot, ACTIVE_ACCOUNT_FILE), 'not json');
      expect(readActiveAccount()).toBeNull();
    });

    it('returns null when userId is missing', () => {
      fs.writeFileSync(path.join(tmpRoot, ACTIVE_ACCOUNT_FILE), JSON.stringify({ username: 'Alice' }));
      expect(readActiveAccount()).toBeNull();
    });

    it('creates the userData root if it does not exist', () => {
      tmpRoot = path.join(tmpRoot, 'nested', 'userData');
      writeActiveAccount({ userId: 'u1', username: 'Alice' });
      expect(readActiveAccount()?.userId).toBe('u1');
    });
  });

  describe('legacy adoption marker', () => {
    it('is absent on a fresh install', () => {
      expect(readLegacyAdopted()).toBeNull();
    });

    it('round-trips the marker', () => {
      markLegacyAdopted('u1');
      expect(readLegacyAdopted()).toEqual({ byAccount: 'u1', at: expect.any(Number) });
    });

    it('returns null for a malformed marker', () => {
      fs.writeFileSync(path.join(tmpRoot, LEGACY_ADOPTED_FILE), '{');
      expect(readLegacyAdopted()).toBeNull();
    });
  });
});
