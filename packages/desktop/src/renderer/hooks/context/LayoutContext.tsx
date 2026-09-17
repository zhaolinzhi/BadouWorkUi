/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';

export interface LayoutContextValue {
  isMobile: boolean;
  setSiderCollapsed: (value: boolean) => void;
}

/**
 * `siderCollapsed` is published in its own context so a sider toggle does not
 * re-render the 30+ consumers that only read `isMobile` (SendBox, ShadowView
 * per markdown message, model selectors, settings pages, …). Only Titlebar and
 * `useVisibleConversationIds` subscribe here.
 */
export interface SiderCollapsedContextValue {
  siderCollapsed: boolean;
}

export const LayoutContext = React.createContext<LayoutContextValue | null>(null);
export const SiderCollapsedContext = React.createContext<SiderCollapsedContextValue | null>(null);

export function useLayoutContext(): LayoutContextValue | null {
  return React.useContext(LayoutContext);
}

export function useSiderCollapsedContext(): SiderCollapsedContextValue | null {
  return React.useContext(SiderCollapsedContext);
}
