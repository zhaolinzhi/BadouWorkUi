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
 * - Total capped at `limit`.
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
  limit: number;
}): AtMentionItems => {
  const kbMention = useKbMentionSearch({ query, isOpen, limit });
  const projectMention = useProjectMentionSearch({ query, isOpen, limit });

  return useMemo<AtMentionItems>(() => {
    if (!isOpen) {
      return { items: [], loading: false, knownKbIds: new Set() };
    }
    const kbItems = kbMention.items;
    const fileItems = projectMention.active ? projectMention.items : [];
    // Cap each side independently so that a saturated KB list cannot push
    // every project file out of the dropdown. With `limit: 8`, KB and files
    // each get up to `Math.ceil(8/2) = 4` slots; with smaller `limit` values
    // each side still gets at least 1, so neither data source is fully
    // suppressed by the other.
    const perSideCap = Math.max(1, Math.ceil(limit / 2));
    const seen = new Set<string>();
    const pushItem = (item: FileOrFolderItem): boolean => {
      const key = item.kind === 'kb' ? `kb:${item.path}` : item.path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };
    const merged: FileOrFolderItem[] = [];
    const pushCapped = (items: FileOrFolderItem[], cap: number): void => {
      let added = 0;
      for (const item of items) {
        if (added >= cap) break;
        if (!pushItem(item)) continue;
        merged.push(item);
        added += 1;
      }
    };
    pushCapped(kbItems, perSideCap);
    pushCapped(fileItems, perSideCap);
    // Trim to `limit` only if both sides together exceeded it (rare: happens
    // only when one side already returned fewer than its cap).
    if (merged.length > limit) merged.length = limit;
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
    limit,
    projectMention.active,
    projectMention.items,
    projectMention.loading,
  ]);
};
