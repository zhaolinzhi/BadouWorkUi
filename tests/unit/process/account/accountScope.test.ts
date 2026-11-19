/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach } from 'vitest';

import {
  resolveAccountKey,
  resolveAccountScope,
  setActiveScope,
  getActiveScope,
  clearActiveScope,
} from '@/process/account/accountScope';

describe('accountScope', () => {
  beforeEach(() => {
    clearActiveScope();
  });

  describe('resolveAccountKey', () => {
    it('is stable for the same userId', () => {
      expect(resolveAccountKey('user-42')).toBe(resolveAccountKey('user-42'));
    });

    it('differs for different userIds', () => {
      expect(resolveAccountKey('user-42')).not.toBe(resolveAccountKey('user-43'));
    });

    it('returns 16 lowercase hex characters', () => {
      expect(resolveAccountKey('user-42')).toMatch(/^[0-9a-f]{16}$/);
    });

    it('never leaks the raw userId into the key', () => {
      const key = resolveAccountKey('../../etc/passwd');
      expect(key).toMatch(/^[0-9a-f]{16}$/);
      expect(key).not.toContain('passwd');
    });

    it('handles an empty userId without throwing', () => {
      expect(resolveAccountKey('')).toMatch(/^[0-9a-f]{16}$/);
    });

    it('handles unicode userIds', () => {
      expect(resolveAccountKey('用户-张三')).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('resolveAccountScope', () => {
    it('composes data and config dirs under the accounts root', () => {
      const scope = resolveAccountScope('user-42', 'Alice', '/base/userData');
      expect(scope.userId).toBe('user-42');
      expect(scope.username).toBe('Alice');
      expect(scope.key).toBe(resolveAccountKey('user-42'));
      expect(scope.dataDir).toBe(`/base/userData/accounts/${scope.key}/data`);
      expect(scope.configDir).toBe(`/base/userData/accounts/${scope.key}/config`);
    });

    it('produces a dataDir that is not a path traversal', () => {
      const scope = resolveAccountScope('../../etc', 'x', '/base/userData');
      expect(scope.dataDir.startsWith('/base/userData/accounts/')).toBe(true);
      expect(scope.dataDir).not.toContain('..');
    });
  });

  describe('active scope state', () => {
    it('starts with no active scope', () => {
      expect(getActiveScope()).toBeNull();
    });

    it('round-trips the active scope', () => {
      const scope = resolveAccountScope('user-42', 'Alice', '/base/userData');
      setActiveScope(scope);
      expect(getActiveScope()).toEqual(scope);
    });

    it('clears the active scope', () => {
      setActiveScope(resolveAccountScope('user-42', 'Alice', '/base/userData'));
      clearActiveScope();
      expect(getActiveScope()).toBeNull();
    });

    it('setting null clears the scope', () => {
      setActiveScope(resolveAccountScope('user-42', 'Alice', '/base/userData'));
      setActiveScope(null);
      expect(getActiveScope()).toBeNull();
    });
  });
});
