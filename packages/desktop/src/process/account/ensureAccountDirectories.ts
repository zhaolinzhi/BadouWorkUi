/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';

import type { AccountScope } from './accountScope';

/**
 * Create the account's data and config directories.
 *
 * A failure here must abort the sign-in: falling back to the shared
 * directory would write one account's data where another account can read it.
 */
export function ensureAccountDirectories(scope: AccountScope): void {
  fs.mkdirSync(scope.dataDir, { recursive: true });
  fs.mkdirSync(scope.configDir, { recursive: true });
}
