/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Keep the development renderer from serving stale modules.
 *
 * In development the renderer is loaded from the Vite dev server over HTTP,
 * and Chromium caches the responses. Vite re-bundles its optimized
 * dependencies with new content hashes whenever it restarts, so the cached
 * module graph keeps importing the previous chunk — which no longer exists.
 * The import fails, the module graph never finishes loading, and the window
 * stays blank with nothing in the log to point at the cause.
 *
 * Dropping the caches at startup removes the failure mode. Production is
 * unaffected: it loads the built files from disk, where there is no hash churn
 * to invalidate.
 */

import { app, session } from 'electron';

/**
 * Clear the renderer's HTTP and code caches in development.
 *
 * @returns True when the caches were cleared, false in production.
 */
export async function disableRendererHttpCacheInDev(): Promise<boolean> {
  if (app.isPackaged) return false;

  try {
    // The renderer loads over HTTP from the dev server, so its session is the
    // default one — not the in-app browser's partition.
    await session.defaultSession.clearCache();
    // The code cache holds the compiled module sources; a stale entry there
    // keeps the old module graph alive even after the HTTP cache is gone.
    // An empty `urls` list clears every entry in the cache directory.
    await session.defaultSession.clearCodeCaches({ urls: [] });
    return true;
  } catch (error) {
    console.warn('[AionUi] Failed to clear the renderer caches in development:', error);
    return false;
  }
}
