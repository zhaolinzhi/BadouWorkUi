/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sider collapsed state, persisted on desktop.
 *
 * Mirrors the persistence pattern of useProjectPanelCollapse:
 *  - Desktop lazily reads localStorage on mount; defaults to `true` (collapsed)
 *    when no value is stored.
 *  - Mobile ignores storage and always collapses, matching the existing
 *    mobile force-collapse behavior in Layout.tsx.
 *  - Persistence writes are wrapped in try/catch — localStorage can be
 *    unavailable (privacy mode, SSR, etc.).
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'aion:sider-collapsed';

const readStoredCollapsed = (): boolean | null => {
  // Returns `null` when nothing is stored (vs. explicitly `'expanded'`).
  // The caller decides the default for the `null` case, so an explicit
  // `'expanded'` value can override the desktop default of `true` (collapsed).
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return raw === 'collapsed';
  } catch {
    return null;
  }
};

const writeStoredCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // ignore — same tolerance as useProjectPanelCollapse
  }
};

type UseSiderCollapsedParams = {
  isMobile: boolean;
};

type UseSiderCollapsedReturn = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

export function useSiderCollapsed({ isMobile }: UseSiderCollapsedParams): UseSiderCollapsedReturn {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (isMobile) return true;
    // Desktop: default to collapsed; honor an explicit stored value if any.
    return readStoredCollapsed() ?? true;
  });

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      if (!isMobile) writeStoredCollapsed(next);
    },
    [isMobile]
  );

  // Re-init when the platform flips: mobile force-collapses and ignores
  // storage; desktop restores from storage so the user's last toggle wins.
  useEffect(() => {
    setCollapsedState(isMobile ? true : (readStoredCollapsed() ?? true));
  }, [isMobile]);

  return { collapsed, setCollapsed };
}
