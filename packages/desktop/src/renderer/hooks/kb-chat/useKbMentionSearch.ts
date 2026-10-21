/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { useMemo } from 'react';
import { useKnowledgeBaseList } from '@/renderer/hooks/knowledge-base/useKnowledgeBaseList';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
import { KB_TOKEN_PREFIX } from '@/renderer/utils/kb/atKbInsertion';

export type KbMentionSearch = {
  /**
   * True when the user has any KBs to reference AND the menu is open —
   * drives `@`-menu section visibility. Stays false while the menu is closed
   * even if KBs exist; compute presence upstream if you need it regardless
   * of menu state.
   */
  active: boolean;
  /** Filtered KB items as `FileOrFolderItem` with `kind: 'kb'`. Every
   *  matching KB is forwarded to `AtFileMenu`; the dropdown is scrollable
   *  so users reach deeper results by scrolling rather than being
   *  silently truncated. */
  items: FileOrFolderItem[];
  /** True while either list is still loading. */
  loading: boolean;
};

export const useKbMentionSearch = ({
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
}): KbMentionSearch => {
  const { personalItems, sharedItems, personalLoading, sharedLoading } = useKnowledgeBaseList();

  const items = useMemo<FileOrFolderItem[]>(() => {
    if (!isOpen) return [];
    // Personal KBs shown before shared so the user's own libraries take
    // priority in the dropdown.
    const all = [...personalItems, ...sharedItems];
    if (all.length === 0) return [];
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((kb) => kb.name.toLowerCase().includes(q)) : all;
    return filtered.map((kb) => ({
      kind: 'kb' as const,
      path: `${KB_TOKEN_PREFIX.slice(1)}${kb.id}`,
      name: kb.name,
      isFile: false,
      isShared: kb.isShared,
    }));
  }, [isOpen, personalItems, query, sharedItems]);

  const loading = isOpen && (personalLoading || sharedLoading);

  return {
    active: items.length > 0,
    items,
    loading,
  };
};
