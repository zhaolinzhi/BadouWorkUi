/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Debug toggle for the performance instrumentation layer.
 *
 * Resolution order (first non-null wins):
 *   1. setPerfEnabledForTest(value) override — used by vitest suites.
 *   2. NODE_ENV !== 'production' — dev/test builds always on (matches the
 *      pre-existing useTeamRunView pattern).
 *   3. localStorage['aionui.perf-debug'] === '1' — production can be enabled
 *      in the field without rebuild; the user sets the key once in DevTools
 *      and reproduces the slowdown, then sends back the daily log file.
 *
 * Default off in production builds. When off, every consumer is expected to
 * early-return without doing work (`perfLogger.log`, `PerfProfiler`) so the
 * instrumentation has effectively zero runtime cost.
 */

/** localStorage key checked in production builds to opt into perf logs. */
export const PERF_DEBUG_STORAGE_KEY = 'aionui.perf-debug';

let override: boolean | null = null;

/** Test-only override. Pass `null` to clear. */
export const setPerfEnabledForTest = (value: boolean | null): void => {
  override = value;
};

export const perfEnabled = (): boolean => {
  if (override !== null) return override;
  // electron-vite statically replaces `process.env.NODE_ENV` via `define`,
  // so this check folds to a literal at build time.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') return true;
  if (typeof localStorage !== 'undefined' && localStorage.getItem(PERF_DEBUG_STORAGE_KEY) === '1') return true;
  return false;
};
