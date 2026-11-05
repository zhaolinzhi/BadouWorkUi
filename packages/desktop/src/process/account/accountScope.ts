/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Account scope resolution.
 *
 * Each signed-in AIPaaS account gets its own data directory, so two accounts
 * on one machine never share a SQLite database, a config file or a workspace.
 *
 * The directory key is `sha256(userId)` truncated to 16 hex characters. The
 * raw userId is NEVER part of a path — AIPaaS user ids are arbitrary
 * non-empty strings (`externalLoginManager.ts` only checks for emptiness), so
 * using them directly would let a hostile id escape the accounts root.
 *
 * This module is pure: it joins paths and holds the active-scope state. It
 * performs no filesystem I/O, so it is safe to import from anywhere in the
 * main process.
 */

import { createHash } from 'node:crypto';
import path from 'node:path';

export type AccountScope = {
  /** The AIPaaS user id. Stored for display and lookup only — never a path. */
  userId: string;
  username: string;
  /** sha256(userId) truncated to 16 hex chars. The account's directory name. */
  key: string;
  /** Backend `--data-dir` for this account. */
  dataDir: string;
  /** Config directory for this account (replaces the shared `<userData>/config`). */
  configDir: string;
};

/** Length of the truncated sha256 digest used as the directory key. */
const ACCOUNT_KEY_LENGTH = 16;

/** Directory name under `<userData>` that holds one subdirectory per account. */
export const ACCOUNTS_DIR_NAME = 'accounts';

/**
 * Derive the stable directory key for a user id.
 *
 * The digest is truncated to 16 hex characters (64 bits). That is short
 * enough to keep paths readable and long enough that a collision between two
 * real accounts is not a practical concern — and any collision would be
 * caught by `account.json`, which stores the real userId.
 */
export function resolveAccountKey(userId: string): string {
  return createHash('sha256')
    .update(userId, 'utf8')
    .digest('hex')
    .slice(0, ACCOUNT_KEY_LENGTH);
}

/**
 * Resolve the full scope for an account.
 *
 * @param userId The AIPaaS user id.
 * @param username Display name for the account.
 * @param userDataRoot The Electron `userData` directory.
 */
export function resolveAccountScope(userId: string, username: string, userDataRoot: string): AccountScope {
  const key = resolveAccountKey(userId);
  const accountRoot = path.join(userDataRoot, ACCOUNTS_DIR_NAME, key);
  return {
    userId,
    username,
    key,
    dataDir: path.join(accountRoot, 'data'),
    configDir: path.join(accountRoot, 'config'),
  };
}

// ---------------------------------------------------------------------------
// Active scope state
// ---------------------------------------------------------------------------

let activeScope: AccountScope | null = null;

/** The account the main process is currently operating as, or null in local mode. */
export function getActiveScope(): AccountScope | null {
  return activeScope;
}

/** Set (or clear, with null) the active account scope. */
export function setActiveScope(scope: AccountScope | null): void {
  activeScope = scope;
}

/** Clear the active account scope. */
export function clearActiveScope(): void {
  activeScope = null;
}
