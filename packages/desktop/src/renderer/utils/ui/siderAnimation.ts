/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sider width-transition signalling.
 *
 * The sider (Arco `.arco-layout-sider`) animates its width over 0.2s
 * (`transition: width .2s` in @arco-design/web-react Layout styles). While that
 * runs, every frame reflows both the sider and the main content column. Two
 * classes of work step aside for the duration, keyed off a `body` class:
 *
 *  - row-level padding/margin transitions (layout.css) — layout animations of
 *    their own, multiplied by every conversation row;
 *  - content-height measurements (CollapsibleContent) — forced layouts that an
 *    already-reflowing frame cannot afford.
 *
 * The window is opened by the Layout when `collapsed` flips (desktop only) and
 * closed by a timer slightly longer than Arco's 0.2s transition.
 */

/** `body` class present while the sider width transition is in flight. */
export const SIDER_ANIMATING_CLASS = 'sider-animating';

/**
 * Window length covering Arco's 0.2s width transition with a small buffer for
 * the trailing frames.
 */
export const SIDER_ANIMATION_WINDOW_MS = 220;

/** Whether the sider width transition is currently in flight. */
export const isSiderAnimating = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.body.classList.contains(SIDER_ANIMATING_CLASS);
};
