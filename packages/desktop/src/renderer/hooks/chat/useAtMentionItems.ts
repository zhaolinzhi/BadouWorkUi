/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
import { useKnowledgeBaseList } from '@/renderer/hooks/knowledge-base';
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
 * - Total capped at `limit`.
 * - `knownKbIds` exposes the set of currently-known KB ids so callers
 *   can filter stale `@kb:<id>` tokens at send time.
 */
export const useAtMentionItems = ({ query, isOpen, limit }: { query: string; isOpen: boolean; limit: number }): AtMentionItems => {
  const { personalItems, sharedItems } = useKnowledgeBaseList();
  // Touching the list above ensures we re-derive knownKbIds when KB list changes
  // (e.g. user added a new KB). The actual filtered KB items come from useKbMentionSearch.
  void personalItems;
  void sharedItems;

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
      if (merged.length >= limit) break;
    }
    const knownKbIds = new Set<string>();
    for (const item of kbItems) {
      if (item.kind === 'kb' && item.path.startsWith('kb:')) {
        knownKbIds.add(item.path.slice(3));
      }
    }
    return { items: merged, loading: kbMention.loading || projectMention.loading, knownKbIds };
  }, [isOpen, kbMention.items, kbMention.loading, limit, projectMention.active, projectMention.items, projectMention.loading]);
};
