/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sider width-transition signalling.
 *
 * The sider (Arco `.arco-layout-sider`) animates its width over 0.2s
 * (`transition: width .2s` in @arco-design/web-react Layout styles). The main
 * content column is kept out of that transition (it keeps a stable width and
 * is revealed from under the sider — see Layout.tsx), but the sider's own
 * content still reflows on every frame, and any measurement taken during the
 * transition would force a synchronous layout on top of it. Two classes of
 * work step aside for the duration, keyed off a `body` class:
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

/**
 * Fired on `window` once the sider width transition has finished.
 *
 * Why a subscriber API instead of just polling `isSiderAnimating()`: the
 * measurements that have to be skipped during the transition (see
 * `useAutoScroll`) are driven by `ResizeObserver`, and the observer only fires
 * on an actual size change — by the time the transition ends the size has
 * already settled, so no further callback is coming. Without this event the
 * skipped measurement would simply be lost.
 */
export const SIDER_ANIMATION_END_EVENT = 'aion:sider-animation-end';

/** Notify subscribers that the sider width transition has finished. */
export const notifySiderAnimationEnd = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SIDER_ANIMATION_END_EVENT));
};

/**
 * Subscribe to "the sider width transition finished" events.
 *
 * The subscription is *persistent*, not one-shot: a subscriber usually
 * registers long before the next transition starts (e.g. when the message list
 * mounts), so a one-shot listener would already be gone by the time the event
 * fires. Listeners are expected to be idempotent — check whether there is
 * anything to redo before doing the work.
 */
export const onSiderAnimationEnd = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(SIDER_ANIMATION_END_EVENT, listener);
  return () => window.removeEventListener(SIDER_ANIMATION_END_EVENT, listener);
};
