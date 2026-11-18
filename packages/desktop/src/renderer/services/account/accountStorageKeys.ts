/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Which localStorage keys hold the signed-in account's data.
 *
 * An account switch must drop these: they belong to the account that is being
 * signed out, and leaving them behind would show the next account the
 * previous one's sidebar state, workspace list and preview panes.
 *
 * The lists are deliberately explicit rather than pattern-based. A catch-all
 * ("clear everything that looks like it might be account data") would either
 * miss a key or take the user's device preferences with it.
 */

/**
 * The localStorage key that holds the signed-in identity (token + user).
 *
 * It lives here rather than in `AuthContext` because both sides need it: the
 * provider writes and reads it, and the account-state reset has to know
 * whether to keep it (an account switch) or drop it (a sign-out).
 */
export const EXTERNAL_AUTH_STORAGE_KEY = 'external_auth';

/**
 * Keys that hold the signed-in account's data. Matched exactly.
 *
 * Deliberately NOT listed: theme, language, font size, sidebar order, the
 * workspace-collapse preference and the other UI settings — they are device
 * preferences, not account settings, and the user expects them to survive a
 * sign-out.
 */
export const ACCOUNT_STORAGE_KEYS: readonly string[] = [
  // The signed-in identity itself.
  EXTERNAL_AUTH_STORAGE_KEY,
  // Sidebar / workspace state that belongs to the account.
  'team-pinned-ids',
  'grouped-history-collapsed-sections',
  'conversation.historySearch.recentKeywords',
  'aionui_workspace_expansion',
  'aionui_workspace_update_time',
  'aionui:recent-workspaces',
];

/**
 * Key prefixes that hold the signed-in account's data.
 *
 * The key continues after the prefix — e.g. `preview-ui:conversation-1`.
 */
export const ACCOUNT_STORAGE_KEY_PREFIXES: readonly string[] = [
  // Per-team pending-permission markers.
  'team-pending-permissions-',
  // Preview panes are scoped to the account's projects.
  'preview-ui:',
];

/**
 * Whether a localStorage key holds account data.
 *
 * @param key The key to test.
 */
export function isAccountStorageKey(key: string): boolean {
  if (ACCOUNT_STORAGE_KEYS.includes(key)) return true;
  return ACCOUNT_STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}
