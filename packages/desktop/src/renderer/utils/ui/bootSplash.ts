/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Handing the window over from the static boot splash to the React app.
 *
 * `index.html` paints a themed spinner into `#boot-splash` before the React
 * bundle has loaded. Without it the window shows a blank white page for as
 * long as the module graph takes to parse — and again after every
 * `window.location.reload()`, which is what an account switch triggers.
 *
 * The splash is hidden with CSS (`html[data-app-ready='true']`) rather than
 * removed from the DOM, so the hand-off is atomic with React's first painted
 * frame: there is never a moment where neither the splash nor the app is on
 * screen.
 */

import { useEffect } from 'react';

/** The attribute the splash's CSS rule keys off. */
const APP_READY_ATTRIBUTE = 'data-app-ready';

/**
 * Mark the app as painted, which hides the boot splash.
 *
 * Call this after React has committed its first render — not before, or the
 * splash disappears while the app is still blank.
 *
 * @param root The document to mark. Defaults to the ambient document.
 */
export function markAppReady(root: Document = document): void {
  root.documentElement.setAttribute(APP_READY_ATTRIBUTE, 'true');
}

/**
 * Whether the app has been marked as painted.
 *
 * @param root The document to inspect. Defaults to the ambient document.
 */
export function isAppReady(root: Document = document): boolean {
  return root.documentElement.getAttribute(APP_READY_ATTRIBUTE) === 'true';
}

/**
 * Hide the boot splash once React has painted the app.
 *
 * The hand-off lives in an effect rather than a timer: `root.render()` is
 * asynchronous in React's concurrent mode, so a `requestAnimationFrame` after
 * it can fire *before* the first commit — which would hide the splash while
 * the app is still blank, reintroducing the white screen this exists to
 * prevent. An effect runs after the DOM has been committed.
 */
export function BootSplashHandoff(): null {
  useEffect(() => {
    markAppReady();
  }, []);
  return null;
}
