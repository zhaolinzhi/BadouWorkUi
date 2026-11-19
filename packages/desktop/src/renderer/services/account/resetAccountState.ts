/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Clearing everything the previous account left behind in the renderer.
 *
 * An account switch restarts the backend against a different data directory,
 * so the renderer's in-memory view of the world — the conversation list, the
 * project tree, the assistants, the providers — is now wrong. This used to be
 * handled with `window.location.reload()`, which threw away the whole page
 * (and showed a blank window while it came back) just to get a clean slate.
 *
 * Instead, every cache that can hold account data registers a reset here, and
 * the switch clears them in one place.
 *
 * The three kinds of state:
 *
 * - **SWR cache** — one `mutate` matcher call clears every key at once.
 * - **Module-level stores** — each exposes its own reset; they are listed in
 *   `STORE_RESETS` below.
 * - **localStorage** — account-scoped keys live in `accountStorageKeys.ts`.
 *
 * A store that is not registered here keeps its previous account's data, so
 * new account-scoped stores must register themselves.
 */

import { configService } from '@/common/config/configService';
import { mutate } from 'swr';

// Module-level stores that hold account data. Each reset drops the cached
// state and detaches the store's listeners, so the next account starts from
// nothing.
import { resetKbInlineAnswerStore } from '@/renderer/utils/kb/kbInlineAnswerStore';
import { resetConversationCommandQueueBackgroundRunner } from '@/renderer/pages/conversation/platforms/useConversationCommandQueue';
import { resetConversationRuntimeViewStore } from '@/renderer/pages/conversation/runtime/conversationRuntimeViewStore';
import { resetConversationTurnClock } from '@/renderer/pages/conversation/utils/conversationTurnClock';
import { resetConversationListSyncStore } from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';
import { resetConversationSendBoxPrefill } from '@/renderer/hooks/chat/useSendBoxDraft';
import { resetSlashCommandCache } from '@/renderer/hooks/chat/useSlashCommands';
import { resetExtensionSettingsTabs } from '@/renderer/hooks/system/useExtensionSettingsTabs';
import { resetCurrentConversationStore } from '@/renderer/pages/conversation/explorer/currentConversationStore';
import { resetCurrentProjectStore } from '@/renderer/pages/conversation/explorer/currentProjectStore';
import { resetExplorerStore } from '@/renderer/pages/conversation/explorer/explorerStore';
import { resetSearchStore } from '@/renderer/pages/conversation/explorer/search/searchStore';
import { resetScmStore } from '@/renderer/pages/conversation/SourceControl/scmStore';
import { resetScmUiStore } from '@/renderer/pages/conversation/SourceControl/scmUiStore';
import { resetTabReloaders } from '@/renderer/pages/conversation/Preview/context/tabReloaderRegistry';

import { EXTERNAL_AUTH_STORAGE_KEY, isAccountStorageKey } from './accountStorageKeys';

/**
 * Resets for the module-level stores that hold account data.
 *
 * Every reset must run: one store left dirty leaks the previous account's
 * data into the next one.
 *
 * `resetConversationListSyncStore` is NOT in this list — it needs to know
 * whether a reload should follow, so it is called separately below.
 */
const STORE_RESETS: ReadonlyArray<() => void> = [
  resetCurrentConversationStore,
  resetCurrentProjectStore,
  resetExplorerStore,
  resetSearchStore,
  resetScmStore,
  resetScmUiStore,
  resetConversationRuntimeViewStore,
  resetConversationCommandQueueBackgroundRunner,
  resetConversationTurnClock,
  resetConversationSendBoxPrefill,
  resetSlashCommandCache,
  resetKbInlineAnswerStore,
  resetTabReloaders,
  resetExtensionSettingsTabs,
];

/**
 * Clear the SWR cache.
 *
 * `mutate` accepts a matcher predicate, so every key — whatever it is — is
 * dropped in one call. Keys registered later re-fetch on their next mount.
 */
async function clearSwrCache(): Promise<void> {
  // `undefined` as the data argument clears the matched entries.
  await mutate(() => true, undefined, { revalidate: false });
}

/**
 * Clear the account-scoped localStorage keys.
 *
 * @param options.keepAuth Whether the signed-in identity (`external_auth`)
 *   must survive. An account switch wants this: the switch happens *after*
 *   the new identity is written, so clearing it would delete the session it
 *   just established and the next renderer reload would sign the user out.
 *   A sign-out does not — there the identity is exactly what must go.
 */
function clearAccountStorage(options: { keepAuth?: boolean } = {}): void {
  if (typeof localStorage === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isAccountStorageKey(key)) continue;
    if (options.keepAuth && key === EXTERNAL_AUTH_STORAGE_KEY) continue;
    keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clear every trace of the previous account from the renderer.
 *
 * Safe to call when there is no previous account — every step is a no-op then.
 *
 * @param options.reload Whether the new account's data should be fetched
 *   right away. An account switch wants this (the backend now serves a
 *   different data directory and the renderer must load from it); a sign-out
 *   does not (there is no account to load yet, and the backend is stopping).
 * @param options.keepAuth Whether the signed-in identity must survive. An
 *   account switch wants this (the identity was just written); a sign-out
 *   does not.
 */
export async function resetAccountState(options: { reload?: boolean; keepAuth?: boolean } = {}): Promise<void> {
  // The stores first: they hold references to the SWR keys and to the
  // conversation list, so clearing them before the cache avoids a subscriber
  // re-populating an entry that is about to be dropped.
  for (const reset of STORE_RESETS) {
    try {
      reset();
    } catch (error) {
      // One broken store must not stop the others from being cleared.
      console.error('Failed to reset an account-scoped store:', error);
    }
  }

  // The conversation list is the one store that must be told to reload: it
  // fetches once on mount and never again, so without an explicit refresh it
  // would sit empty after the switch.
  if (options.reload) {
    resetConversationListSyncStore({ reload: true });
  }

  // The client settings belong to the account's data directory.
  configService.reset();

  clearAccountStorage(options);

  await clearSwrCache();
}

export { EXTERNAL_AUTH_STORAGE_KEY, isAccountStorageKey } from './accountStorageKeys';
