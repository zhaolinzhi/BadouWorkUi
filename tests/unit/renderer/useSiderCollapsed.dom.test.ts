/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSiderCollapsed } from '@/renderer/hooks/ui/useSiderCollapsed';

const STORAGE_KEY = 'aion:sider-collapsed';

describe('useSiderCollapsed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('desktop with no stored value defaults to collapsed', () => {
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));
    expect(result.current.collapsed).toBe(true);
  });

  it('desktop reads stored "collapsed" value', () => {
    localStorage.setItem(STORAGE_KEY, 'collapsed');
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));
    expect(result.current.collapsed).toBe(true);
  });

  it('desktop reads stored "expanded" value', () => {
    localStorage.setItem(STORAGE_KEY, 'expanded');
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));
    expect(result.current.collapsed).toBe(false);
  });

  it('mobile with no stored value is collapsed', () => {
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: true }));
    expect(result.current.collapsed).toBe(true);
  });

  it('mobile ignores stored "expanded" value', () => {
    localStorage.setItem(STORAGE_KEY, 'expanded');
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: true }));
    expect(result.current.collapsed).toBe(true);
  });

  it('desktop setCollapsed(false) updates state and writes "expanded"', () => {
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));
    expect(result.current.collapsed).toBe(true);

    act(() => {
      result.current.setCollapsed(false);
    });

    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('expanded');
  });

  it('desktop setCollapsed(true) updates state and writes "collapsed"', () => {
    localStorage.setItem(STORAGE_KEY, 'expanded');
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));
    expect(result.current.collapsed).toBe(false);

    act(() => {
      result.current.setCollapsed(true);
    });

    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('collapsed');
  });

  it('mobile setCollapsed updates state but does not write localStorage', () => {
    const { result } = renderHook(() => useSiderCollapsed({ isMobile: true }));

    act(() => {
      result.current.setCollapsed(false);
    });

    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('re-init when isMobile flips false -> true collapses', () => {
    localStorage.setItem(STORAGE_KEY, 'expanded');
    const { result, rerender } = renderHook(({ isMobile }) => useSiderCollapsed({ isMobile }), {
      initialProps: { isMobile: false },
    });
    expect(result.current.collapsed).toBe(false);

    rerender({ isMobile: true });
    expect(result.current.collapsed).toBe(true);
  });

  it('re-init when isMobile flips true -> false restores from storage', () => {
    localStorage.setItem(STORAGE_KEY, 'expanded');
    const { result, rerender } = renderHook(({ isMobile }) => useSiderCollapsed({ isMobile }), {
      initialProps: { isMobile: true },
    });
    expect(result.current.collapsed).toBe(true);

    rerender({ isMobile: false });
    expect(result.current.collapsed).toBe(false);
  });

  it('localStorage read throwing falls back to default on desktop', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('security error');
    });

    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));

    expect(result.current.collapsed).toBe(true);
    expect(getItemSpy).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('localStorage write throwing does not crash and state still updates', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useSiderCollapsed({ isMobile: false }));

    expect(() => {
      act(() => {
        result.current.setCollapsed(false);
      });
    }).not.toThrow();

    expect(result.current.collapsed).toBe(false);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, 'expanded');
  });
});
