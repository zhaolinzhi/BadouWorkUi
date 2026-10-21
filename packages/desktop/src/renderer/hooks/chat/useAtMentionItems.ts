/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
import { useKbMentionSearch } from '@/renderer/hooks/kb-chat/useKbMentionSearch';
import { useProjectMentionSearch } from '@/renderer/pages/conversation/explorer/search/useProjectMentionSearch';

export type AtMentionItems = {
  items: FileOrFolderItem[];
  loading: boolean;
  knownKbIds: Set<string>;
};

/**
 * Merge KB + file hits for the `@`-mention dropdown.
 * - KB rows come first, personal before shared.
 * - File hits come after, only when the project search is active.
 * - Every matching item is forwarded to `AtFileMenu`, which constrains the
 *   dropdown visually (`maxHeight: 320; overflow-y: auto`) and lets users
 *   scroll through deeper hits. We deliberately do NOT cap on a magic
 *   number — callers can reach deeper results by scrolling.
 * - `knownKbIds` exposes the set of currently-known KB ids so callers
 *   can filter stale `@kb:<id>` tokens at send time. Note this is
 *   derived from currently visible KB rows only; callers that need
 *   authoritative validation should also read `useKnowledgeBaseList`.
 */
export const useAtMentionItems = ({
  query,
  isOpen,
  limit,
}: {
  query: string;
  isOpen: boolean;
  /** Unused — kept in the signature so existing call sites compile unchanged.
   *  The dropdown is scrollable, so we surface every matching item rather
   *  than truncating with a magic number. */
  limit?: number;
}): AtMentionItems => {
  const kbMention = useKbMentionSearch({ query, isOpen, limit });
  const projectMention = useProjectMentionSearch({ query, isOpen, limit });

  return useMemo<AtMentionItems>(() => {
    if (!isOpen) {
      return { items: [], loading: false, knownKbIds: new Set() };
    }
    const kbItems = kbMention.items;
    const fileItems = projectMention.active ? projectMention.items : [];
    const merged: FileOrFolderItem[] = [];
    const seen = new Set<string>();
    for (const item of [...kbItems, ...fileItems]) {
      const key = item.kind === 'kb' ? `kb:${item.path}` : item.path;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    const knownKbIds = new Set<string>();
    for (const item of kbItems) {
      if (item.kind === 'kb' && item.path.startsWith('kb:')) {
        knownKbIds.add(item.path.slice(3));
      }
    }
    return { items: merged, loading: kbMention.loading || projectMention.loading, knownKbIds };
  }, [
    isOpen,
    kbMention.items,
    kbMention.loading,
    projectMention.active,
    projectMention.items,
    projectMention.loading,
  ]);
};
