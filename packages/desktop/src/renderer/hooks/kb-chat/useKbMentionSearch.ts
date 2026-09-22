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
  /** Filtered KB items as `FileOrFolderItem` with `kind: 'kb'`, capped to `limit`. */
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
  limit: number;
}): KbMentionSearch => {
  const { personalItems, sharedItems, personalLoading, sharedLoading } = useKnowledgeBaseList();

  const items = useMemo<FileOrFolderItem[]>(() => {
    if (!isOpen) return [];
    // Personal KBs shown before shared KBs under the cap so the user's own
    // libraries take priority in the dropdown.
    const all = [...personalItems, ...sharedItems];
    if (all.length === 0) return [];
    const q = query.trim().toLowerCase();
    const filtered = q ? all.filter((kb) => kb.name.toLowerCase().includes(q)) : all;
    return filtered.slice(0, limit).map((kb) => ({
      kind: 'kb' as const,
      path: `${KB_TOKEN_PREFIX.slice(1)}${kb.id}`,
      name: kb.name,
      isFile: false,
      isShared: kb.isShared,
    }));
  }, [isOpen, limit, personalItems, query, sharedItems]);

  const loading = isOpen && (personalLoading || sharedLoading);

  return {
    active: items.length > 0,
    items,
    loading,
  };
};
