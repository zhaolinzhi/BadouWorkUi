/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolve the account scope to use at startup.
 *
 * The main process cannot read the renderer's `localStorage`, so the last
 * used account is mirrored into `<userData>/active-account.json` at sign-in.
 * Reading it here lets the backend start against the right directory before
 * the renderer has loaded.
 *
 * A missing or malformed file degrades to local mode (no account) rather than
 * failing startup.
 */

import { resolveAccountScope, setActiveScope, type AccountScope } from './accountScope';
import { readActiveAccount } from './accountStore';
import { getUserDataRoot } from '@/process/utils/utils';

export async function resolveStartupAccountScope(): Promise<AccountScope | null> {
  const stored = readActiveAccount();
  if (!stored) return null;
  const scope = resolveAccountScope(stored.userId, stored.username, getUserDataRoot());
  setActiveScope(scope);
  return scope;
}
