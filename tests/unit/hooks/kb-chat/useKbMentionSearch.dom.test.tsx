/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();

vi.mock('@/renderer/hooks/knowledge-base/useKnowledgeBaseList', () => ({
  useKnowledgeBaseList: () => {
    const v = list();
    return {
      personalItems: v?.personalItems ?? [],
      sharedItems: v?.sharedItems ?? [],
      personalLoading: v?.personalLoading ?? false,
      sharedLoading: v?.sharedLoading ?? false,
    };
  },
}));

import { useKbMentionSearch } from '@renderer/hooks/kb-chat/useKbMentionSearch';

describe('useKbMentionSearch', () => {
  beforeEach(() => {
    list.mockReset();
  });

  it('returns empty + inactive when no KBs exist', () => {
    list.mockReturnValue({ personalItems: [], sharedItems: [] });
    const { result } = renderHook(() => useKbMentionSearch({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.active).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('returns active when items exist (no query)', () => {
    list.mockReturnValue({
      personalItems: [{ id: '1', name: 'Alpha', isShared: false }],
      sharedItems: [],
    });
    const { result } = renderHook(() => useKbMentionSearch({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.active).toBe(true);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      kind: 'kb',
      path: 'kb:1',
      name: 'Alpha',
      isFile: false,
      isShared: false,
    });
  });

  it('filters by case-insensitive substring on name', () => {
    list.mockReturnValue({
      personalItems: [
        { id: '1', name: 'Alpha docs', isShared: false },
        { id: '2', name: 'Beta notes', isShared: false },
      ],
      sharedItems: [],
    });
    const { result } = renderHook(() => useKbMentionSearch({ query: 'al', isOpen: true, limit: 8 }));
    expect(result.current.items.map((i) => i.path)).toEqual(['kb:1']);
  });

  it('respects the limit', () => {
    list.mockReturnValue({
      personalItems: Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        name: `KB ${i}`,
        isShared: false,
      })),
      sharedItems: [],
    });
    const { result } = renderHook(() => useKbMentionSearch({ query: '', isOpen: true, limit: 5 }));
    expect(result.current.items).toHaveLength(5);
  });

  it('marks shared items', () => {
    list.mockReturnValue({
      personalItems: [],
      sharedItems: [{ id: '9', name: 'Shared', isShared: true }],
    });
    const { result } = renderHook(() => useKbMentionSearch({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.items[0]).toMatchObject({ kind: 'kb', isShared: true, path: 'kb:9' });
  });

  it('combines personal and shared lists', () => {
    list.mockReturnValue({
      personalItems: [{ id: '1', name: 'Personal KB', isShared: false }],
      sharedItems: [{ id: '2', name: 'Shared KB', isShared: true }],
    });
    const { result } = renderHook(() => useKbMentionSearch({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((i) => i.path).sort()).toEqual(['kb:1', 'kb:2']);
  });

  it('returns empty items when menu is closed', () => {
    list.mockReturnValue({
      personalItems: [{ id: '1', name: 'Alpha', isShared: false }],
      sharedItems: [],
    });
    const { result } = renderHook(() => useKbMentionSearch({ query: '', isOpen: false, limit: 8 }));
    expect(result.current.items).toEqual([]);
    expect(result.current.active).toBe(false);
  });
});
