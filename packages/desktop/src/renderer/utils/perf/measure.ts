/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Inline perf markers and timers. Three ergonomic shapes:
 *
 *   mark(tag, message, data?)          — fire a single point-in-time entry
 *   perfTime(entry, fn)                — sync wrap, returns fn's result
 *   perfTimeAsync(entry, fn)           — async wrap, returns fn's promise
 *
 * Disabled (`perfEnabled() === false`) → every helper is a passthrough; no
 * `performance.now()` is read, no allocation, no IPC. When enabled we also
 * call `console.time`/`console.timeEnd` so DevTools shows a labelled span,
 * and emit a structured `{ durationMs }` entry through `perfLogger` (which
 * batches → main process → daily log file).
 */

import { perfLogger } from './perfLogger';

export interface PerfMeasureEntry {
  tag: string;
  message: string;
  data?: Record<string, unknown>;
}

const consoleLabel = (entry: PerfMeasureEntry): string => `${entry.tag}:${entry.message}`;

export const mark = (tag: string, message: string, data?: Record<string, unknown>): void => {
  perfLogger.log({ level: 'debug', tag, message, data });
};

export const perfTime = <T>(entry: PerfMeasureEntry, fn: () => T): T => {
  const label = consoleLabel(entry);
  const startedAt = performance.now();
  // eslint-disable-next-line no-console -- intentional: devtools visibility
  console.time(label);
  try {
    return fn();
  } finally {
    const durationMs = performance.now() - startedAt;
    // eslint-disable-next-line no-console -- intentional: devtools visibility
    console.timeEnd(label);
    perfLogger.log({
      level: 'debug',
      tag: entry.tag,
      message: entry.message,
      data: { ...entry.data, durationMs },
    });
  }
};

export const perfTimeAsync = async <T>(entry: PerfMeasureEntry, fn: () => Promise<T>): Promise<T> => {
  const label = consoleLabel(entry);
  const startedAt = performance.now();
  // eslint-disable-next-line no-console -- intentional: devtools visibility
  console.time(label);
  try {
    return await fn();
  } finally {
    const durationMs = performance.now() - startedAt;
    // eslint-disable-next-line no-console -- intentional: devtools visibility
    console.timeEnd(label);
    perfLogger.log({
      level: 'debug',
      tag: entry.tag,
      message: entry.message,
      data: { ...entry.data, durationMs },
    });
  }
};
