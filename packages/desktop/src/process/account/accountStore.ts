/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * On-disk state for account selection.
 *
 * `active-account.json` records the account this machine last used. It is
 * deliberately NOT deleted on logout: it lets the next launch of the *same*
 * account start the backend against the right directory without a restart.
 *
 * `legacy-adopted.json` is the one-shot marker for the legacy directory
 * adoption. It is separate from `active-account.json` precisely because the
 * latter survives logout and therefore cannot double as "has this machine
 * ever had an account" marker.
 */

import fs from 'node:fs';
import path from 'node:path';

import { getUserDataRoot } from '@/process/utils/utils';

export const ACTIVE_ACCOUNT_FILE = 'active-account.json';
export const LEGACY_ADOPTED_FILE = 'legacy-adopted.json';

export type StoredActiveAccount = {
  userId: string;
  username: string;
  lastActiveAt: number;
};

export type LegacyAdoptedMarker = {
  byAccount: string;
  at: number;
};

function writeJsonFile(fileName: string, payload: unknown): void {
  const root = getUserDataRoot();
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, fileName);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

function readJsonFile(fileName: string): unknown {
  try {
    const target = path.join(getUserDataRoot(), fileName);
    if (!fs.existsSync(target)) return null;
    const raw = fs.readFileSync(target, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Read the last-used account, or null when there is none or the file is
 * unreadable. A malformed file must never block startup — it degrades to
 * local mode instead.
 */
export function readActiveAccount(): StoredActiveAccount | null {
  const parsed = readJsonFile(ACTIVE_ACCOUNT_FILE) as Partial<StoredActiveAccount> | null;
  if (!parsed || typeof parsed.userId !== 'string' || !parsed.userId) return null;
  return {
    userId: parsed.userId,
    username: typeof parsed.username === 'string' ? parsed.username : '',
    lastActiveAt: typeof parsed.lastActiveAt === 'number' ? parsed.lastActiveAt : Date.now(),
  };
}

/** Record the account this machine is now using. */
export function writeActiveAccount(account: { userId: string; username: string }): void {
  writeJsonFile(ACTIVE_ACCOUNT_FILE, {
    userId: account.userId,
    username: account.username,
    lastActiveAt: Date.now(),
  });
}

/** Read the legacy-adoption marker, or null when the adoption has not happened. */
export function readLegacyAdopted(): LegacyAdoptedMarker | null {
  const parsed = readJsonFile(LEGACY_ADOPTED_FILE) as Partial<LegacyAdoptedMarker> | null;
  if (!parsed || typeof parsed.byAccount !== 'string' || !parsed.byAccount) return null;
  return {
    byAccount: parsed.byAccount,
    at: typeof parsed.at === 'number' ? parsed.at : Date.now(),
  };
}

/** Mark the legacy directories as adopted by an account. Written once, never removed. */
export function markLegacyAdopted(userId: string): void {
  writeJsonFile(LEGACY_ADOPTED_FILE, { byAccount: userId, at: Date.now() });
}
