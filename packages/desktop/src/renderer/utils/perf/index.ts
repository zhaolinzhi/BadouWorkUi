/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Barrel for the renderer-side perf instrumentation layer.
 *
 * Public surface (call sites should import from `@/renderer/utils/perf`):
 *   - `PerfProfiler` — controlled React.Profiler wrapper
 *   - `perfTime` / `perfTimeAsync` / `mark` — inline timing helpers
 *   - `perfLogger` / `flushPerfLogs` — singleton + manual flush hook
 *   - `perfEnabled` / `setPerfEnabledForTest` — toggle for prod and tests
 *   - `PERF_DEBUG_STORAGE_KEY` — the localStorage key used in the field
 */

export { PERF_DEBUG_STORAGE_KEY, perfEnabled, setPerfEnabledForTest } from './perfConfig';
export {
  createPerfLogger,
  flushPerfLogs,
  perfLogger,
  type PerfLogEntry,
  type PerfLogLevel,
  type PerfLogger,
  type PerfLoggerOptions,
} from './perfLogger';
export { mark, perfTime, perfTimeAsync, type PerfMeasureEntry } from './measure';
export { PerfProfiler, type PerfProfilerProps } from './PerfProfiler';
