/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kbList = vi.fn();
vi.mock('@/renderer/hooks/knowledge-base/useKnowledgeBaseList', () => ({
  useKnowledgeBaseList: () => {
    const v = kbList();
    return {
      personalItems: v?.personalItems ?? [],
      sharedItems: v?.sharedItems ?? [],
      personalLoading: v?.personalLoading ?? false,
      sharedLoading: v?.sharedLoading ?? false,
    };
  },
}));

const projectSearch = vi.fn();
vi.mock('@/renderer/pages/conversation/explorer/search/useProjectMentionSearch', () => ({
  useProjectMentionSearch: (p: { query: string; isOpen: boolean; limit: number }) => projectSearch(p),
}));

import { useAtMentionItems } from '@renderer/hooks/chat/useAtMentionItems';

const kb = (id: string, name: string, isShared: boolean) => ({ id, name, isShared });
const file = (path: string) => ({ path, name: path, isFile: true });

describe('useAtMentionItems', () => {
  beforeEach(() => {
    kbList.mockReset();
    projectSearch.mockReset();
  });

  it('returns KB-only when project search is inactive', () => {
    kbList.mockReturnValue({ personalItems: [kb('1', 'A', false)], sharedItems: [] });
    projectSearch.mockReturnValue({ active: false, items: [], loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.items).toMatchObject([{ kind: 'kb', path: 'kb:1' }]);
    expect(result.current.knownKbIds.has('1')).toBe(true);
  });

  it('merges KB and file hits when both active, KB first', () => {
    kbList.mockReturnValue({
      personalItems: [kb('1', 'A', false)],
      sharedItems: [kb('2', 'B', true)],
    });
    projectSearch.mockReturnValue({ active: true, items: [file('x.ts')], loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.items.map((i) => i.path)).toEqual(['kb:1', 'kb:2', 'x.ts']);
  });

  it('personal KBs come before shared', () => {
    kbList.mockReturnValue({
      personalItems: [kb('1', 'Personal', false)],
      sharedItems: [kb('2', 'Shared', true)],
    });
    projectSearch.mockReturnValue({ active: false, items: [], loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.items[0]).toMatchObject({ path: 'kb:1' });
  });

  it('caps total at limit', () => {
    const manyKb = Array.from({ length: 6 }, (_, i) => kb(String(i), `K${i}`, false));
    const manyFiles = Array.from({ length: 6 }, (_, i) => file(`f${i}.ts`));
    kbList.mockReturnValue({ personalItems: manyKb, sharedItems: [] });
    projectSearch.mockReturnValue({ active: true, items: manyFiles, loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.items).toHaveLength(8);
  });

  it('surfaces loading when KB list loading', () => {
    kbList.mockReturnValue({ personalItems: [], sharedItems: [], personalLoading: true, sharedLoading: false });
    projectSearch.mockReturnValue({ active: false, items: [], loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: true, limit: 8 }));
    expect(result.current.loading).toBe(true);
  });

  it('drops KB items when menu closed', () => {
    kbList.mockReturnValue({ personalItems: [kb('1', 'A', false)], sharedItems: [] });
    projectSearch.mockReturnValue({ active: false, items: [], loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: false, limit: 8 }));
    expect(result.current.items).toEqual([]);
    expect(result.current.knownKbIds.size).toBe(0);
  });

  // Regression: when the user has more KBs than `limit`, KB items saturate
  // the dropdown and project file hits no longer fit. Users with a large
  // KB library reported "@ no longer surfaces files". The merge should
  // reserve at least one slot for each side when both are active.
  it('still surfaces project files when KB list exceeds limit', () => {
    const manyKb = Array.from({ length: 12 }, (_, i) => kb(String(i), `K${i}`, false));
    kbList.mockReturnValue({ personalItems: manyKb, sharedItems: [] });
    projectSearch.mockReturnValue({ active: true, items: [file('x.ts'), file('y.ts')], loading: false });
    const { result } = renderHook(() => useAtMentionItems({ query: '', isOpen: true, limit: 8 }));
    const fileHits = result.current.items.filter((i) => i.kind !== 'kb');
    expect(fileHits.length).toBeGreaterThan(0);
  });
});
