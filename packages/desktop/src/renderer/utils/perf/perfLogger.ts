/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Batched, throttled renderer-side log sink that pipes structured entries to
 * the main process via the existing `writeRendererLogBatch` IPC bridge.
 *
 * Why batch:
 *   The perf instrumentation can fire on every React commit during streaming
 *   output. Calling IPC once per entry would amplify the very thing we are
 *   trying to measure. The logger pushes into an in-memory buffer and flushes
 *   at most once per `flushIntervalMs` window.
 *
 * Drop policy:
 *   When the buffer exceeds `maxBufferSize`, the oldest entries are dropped
 *   so we always keep the most recent activity — the data we actually care
 *   about for "why did the click feel slow".
 *
 * Throttle:
 *   When the buffer reaches `flushThreshold`, an early flush is attempted,
 *   but the actual transport call is rate-limited to one per second so a
 *   burst cannot flood the IPC channel.
 *
 * Disabled:
 *   When `enabled()` is false, `log()` is a no-op and no transport is ever
 *   invoked.
 */

import { ipcBridge } from '@/common';
import type { IRendererLogEntry } from '@/common/adapter/ipcBridge';
import { isElectronDesktop } from '@renderer/utils/platform';
import { perfEnabled } from './perfConfig';

export type PerfLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface PerfLogEntry {
  level: PerfLogLevel;
  /** Naming convention: `perf.<surface>.<event>` (e.g. `perf.nav.click`). */
  tag: string;
  /** Short snake_case identifier (e.g. `nav_click`, `refresh_fetch`). */
  message: string;
  data?: Record<string, unknown>;
}

export interface PerfLoggerOptions {
  enabled?: () => boolean;
  flushIntervalMs?: number;
  flushThreshold?: number;
  maxBufferSize?: number;
  transport?: (entries: PerfLogEntry[]) => void;
}

export interface PerfLogger {
  log: (entry: PerfLogEntry) => void;
  flush: () => void;
  dispose: () => void;
}

const DEFAULT_FLUSH_INTERVAL_MS = 1000;
const DEFAULT_FLUSH_THRESHOLD = 32;
const DEFAULT_MAX_BUFFER = 256;
const MIN_FLUSH_GAP_MS = 1000;

const defaultTransport = (entries: PerfLogEntry[]): void => {
  // Fire-and-forget: never await, never throw. The main process console
  // receives the batch via writeRendererLogBatch and forwards it to the
  // electron-log daily file (see configureConsoleLog.ts).
  if (!isElectronDesktop()) return;
  if (!ipcBridge.application?.writeRendererLogBatch) return;
  ipcBridge.application.writeRendererLogBatch
    .invoke(entries as unknown as IRendererLogEntry[])
    .catch((): undefined => undefined);
};

export const createPerfLogger = (options: PerfLoggerOptions = {}): PerfLogger => {
  const enabled = options.enabled ?? perfEnabled;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const flushThreshold = options.flushThreshold ?? DEFAULT_FLUSH_THRESHOLD;
  const maxBufferSize = options.maxBufferSize ?? DEFAULT_MAX_BUFFER;
  const transport = options.transport ?? defaultTransport;

  let buffer: PerfLogEntry[] = [];
  let lastFlushAt = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clearTimer = (): void => {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  const scheduleTailFlush = (delayMs: number): void => {
    if (disposed) return;
    if (pendingTimer !== null) return;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      flush();
    }, delayMs);
  };
  const flush = (): void => {
    clearTimer();
    if (!enabled() || buffer.length === 0) return;

    const elapsed = Date.now() - lastFlushAt;
    if (elapsed < MIN_FLUSH_GAP_MS) {
      // Too soon since last flush — defer to the tail of the gap window.
      scheduleTailFlush(MIN_FLUSH_GAP_MS - elapsed);
      return;
    }

    const batch = buffer;
    buffer = [];
    lastFlushAt = Date.now();
    try {
      transport(batch);
    } catch {
      // Transport must never throw — perf instrumentation must not crash the host.
    }
  };

  const log: PerfLogger['log'] = (entry) => {
    if (!enabled()) return;
    if (disposed) return;

    if (buffer.length >= maxBufferSize) {
      // Drop oldest to keep memory bounded and preserve the most recent activity.
      buffer.shift();
    }
    buffer.push(entry);

    if (buffer.length >= flushThreshold) {
      flush();
    } else if (pendingTimer === null) {
      scheduleTailFlush(flushIntervalMs);
    }
  };

  const dispose: PerfLogger['dispose'] = () => {
    disposed = true;
    clearTimer();
    buffer = [];
  };

  return { log, flush, dispose };
};

/**
 * Shared singleton used by the inline helpers (`mark`, `perfTime`,
 * `perfTimeAsync`). Created lazily so the test-only `setPerfEnabledForTest`
 * override is read on every call (rather than captured at module load).
 */
export const perfLogger: PerfLogger = createPerfLogger();

/** Convenience used by `beforeunload` to flush whatever is still buffered. */
export const flushPerfLogs = (): void => {
  perfLogger.flush();
};
