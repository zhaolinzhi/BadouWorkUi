/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * One-shot adoption of the pre-account shared directories.
 *
 * Before per-account isolation, every account shared `<userData>/aionui` and
 * `<userData>/config`. The first account to sign in inherits them; later
 * accounts do not. This mirrors the backend's own one-shot adoption
 * (`adopt_system_default_data` in BadouWorkCore, marked by `adopted_by`).
 *
 * The sequence is copy → verify → delete, so a failure mid-way leaves the
 * source intact and the adoption is retried on the next sign-in.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { AccountScope } from './accountScope';
import { markLegacyAdopted, readLegacyAdopted } from './accountStore';
import { getUserDataRoot } from '@/process/utils/utils';

export type AdoptionResult = {
  adopted: boolean;
  reason: 'ok' | 'already-adopted' | 'no-legacy-dir' | 'copy-failed' | 'verify-failed';
};

const LEGACY_DATA_DIR_NAME = 'aionui';
const LEGACY_CONFIG_DIR_NAME = 'config';

function copyDirectoryRecursively(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursively(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

/**
 * Verify that every file in `src` exists in `dest` with the same size.
 *
 * A size check is enough to catch a truncated copy, which is the failure mode
 * that matters here — a full content hash over a multi-hundred-MB database is
 * not worth the startup cost.
 */
function verifyDirectoryFiles(src: string, dest: string): boolean {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(to)) return false;
      if (!verifyDirectoryFiles(from, to)) return false;
    } else if (entry.isFile()) {
      if (!fs.existsSync(to)) return false;
      if (fs.statSync(from).size !== fs.statSync(to).size) return false;
    }
  }
  return true;
}

/**
 * Adopt the legacy shared directories into an account's directories, once.
 *
 * Call this BEFORE starting the backend against the account directory, so the
 * backend never opens a database that is still being copied into.
 */
export async function adoptLegacyDataIfNeeded(scope: AccountScope): Promise<AdoptionResult> {
  if (readLegacyAdopted()) {
    return { adopted: false, reason: 'already-adopted' };
  }

  const root = getUserDataRoot();
  const legacyData = path.join(root, LEGACY_DATA_DIR_NAME);
  const legacyConfig = path.join(root, LEGACY_CONFIG_DIR_NAME);

  const hasLegacyData = fs.existsSync(legacyData);
  const hasLegacyConfig = fs.existsSync(legacyConfig);
  if (!hasLegacyData && !hasLegacyConfig) {
    // Nothing to adopt — but still record that the window has closed, so a
    // later install that drops files into the legacy dir is not silently
    // picked up by some other account.
    markLegacyAdopted(scope.userId);
    return { adopted: false, reason: 'no-legacy-dir' };
  }

  try {
    if (hasLegacyData) {
      copyDirectoryRecursively(legacyData, scope.dataDir);
    }
    if (hasLegacyConfig) {
      copyDirectoryRecursively(legacyConfig, scope.configDir);
    }
  } catch (error) {
    console.error('[Account] Legacy data adoption copy failed:', error);
    return { adopted: false, reason: 'copy-failed' };
  }

  if (hasLegacyData && !verifyDirectoryFiles(legacyData, scope.dataDir)) {
    console.error('[Account] Legacy data adoption verification failed; keeping source directories');
    return { adopted: false, reason: 'verify-failed' };
  }
  if (hasLegacyConfig && !verifyDirectoryFiles(legacyConfig, scope.configDir)) {
    console.error('[Account] Legacy config adoption verification failed; keeping source directories');
    return { adopted: false, reason: 'verify-failed' };
  }

  try {
    if (hasLegacyData) fs.rmSync(legacyData, { recursive: true, force: true });
    if (hasLegacyConfig) fs.rmSync(legacyConfig, { recursive: true, force: true });
  } catch (error) {
    // The copy already succeeded and verified. A failure to remove the
    // source is cosmetic — the marker below stops any second adoption.
    console.warn('[Account] Failed to remove legacy directories after adoption:', error);
  }

  markLegacyAdopted(scope.userId);
  console.info('[Account] Adopted legacy data directories for account %s', scope.userId);
  return { adopted: true, reason: 'ok' };
}
