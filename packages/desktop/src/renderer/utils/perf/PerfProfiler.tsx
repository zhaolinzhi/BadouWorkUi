/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wrapper around `React.Profiler` that records every commit to the perf
 * logger. Disabled mode returns the children as-is — no Profiler is mounted
 * at all, so production builds pay no per-commit cost.
 *
 * Tag emitted per commit: `perf.<id>.commit` with `message: 'react_commit'`
 * and data `{ phase, actualDurationMs, baseDurationMs, commitTimeMs }`.
 *
 * Profiler onRender receives a callback every commit; we deliberately do not
 * allocate a closure per render — the function below is stable across renders
 * and looks up the entry shape directly inside the call.
 */

import React from 'react';
import type { ProfilerOnRenderCallback, ReactNode } from 'react';
import { perfEnabled } from './perfConfig';
import { perfLogger } from './perfLogger';

export interface PerfProfilerProps {
  /** Stable, human-readable id — used to label the emitted tag. */
  id: string;
  children: ReactNode;
}

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, commitTime) => {
  perfLogger.log({
    level: 'debug',
    tag: `perf.${id}.commit`,
    message: 'react_commit',
    data: {
      phase,
      actualDurationMs: actualDuration,
      baseDurationMs: baseDuration,
      commitTimeMs: commitTime,
    },
  });
};

export const PerfProfiler: React.FC<PerfProfilerProps> = ({ id, children }) => {
  if (!perfEnabled()) {
    // Zero-cost path: do not mount a React.Profiler at all in production.
    return <>{children}</>;
  }
  return (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  );
};
