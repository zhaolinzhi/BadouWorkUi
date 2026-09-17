/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPerfLogger, type PerfLogger } from '@/renderer/utils/perf/perfLogger';

describe('createPerfLogger', () => {
  let transport: ReturnType<typeof vi.fn>;
  let logger: PerfLogger;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = vi.fn();
    logger = createPerfLogger({
      enabled: () => true,
      flushIntervalMs: 1000,
      flushThreshold: 32,
      maxBufferSize: 256,
      transport,
    });
  });

  afterEach(() => {
    logger.dispose();
    vi.useRealTimers();
  });

  it('flushes on the trailing timer when below the threshold', () => {
    logger.log({ level: 'debug', tag: 't', message: 'a' });
    logger.log({ level: 'debug', tag: 't', message: 'b' });
    expect(transport).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toEqual([
      { level: 'debug', tag: 't', message: 'a' },
      { level: 'debug', tag: 't', message: 'b' },
    ]);
  });

  it('flushes eagerly when the threshold is reached but is throttled to 1 per second', () => {
    // Fire 32 entries — should trigger an immediate flush attempt.
    for (let i = 0; i < 32; i++) {
      logger.log({ level: 'debug', tag: 't', message: String(i) });
    }
    // The first eager flush should have gone through (lastFlushAt was 0,
    // so the gap check passes).
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toHaveLength(32);

    // Subsequent logs before the 1s gap should NOT cause another transport
    // call — they get buffered and a tail timer is scheduled.
    logger.log({ level: 'debug', tag: 't', message: 'late' });
    expect(transport).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1][0]).toEqual([{ level: 'debug', tag: 't', message: 'late' }]);
  });

  it('drops the oldest entries when maxBufferSize is exceeded', () => {
    const localLogger = createPerfLogger({
      enabled: () => true,
      flushIntervalMs: 1_000_000,
      flushThreshold: 10_000,
      maxBufferSize: 4,
      transport,
    });

    for (let i = 0; i < 6; i++) {
      localLogger.log({ level: 'debug', tag: 't', message: String(i) });
    }

    localLogger.flush();
    const batch = transport.mock.calls.at(-1)?.[0] as Array<{ message: string }>;
    expect(batch.map((e) => e.message)).toEqual(['2', '3', '4', '5']);

    localLogger.dispose();
  });

  it('does nothing when disabled', () => {
    const disabledLogger = createPerfLogger({
      enabled: () => false,
      flushIntervalMs: 1000,
      flushThreshold: 1,
      maxBufferSize: 10,
      transport,
    });
    disabledLogger.log({ level: 'debug', tag: 't', message: 'a' });
    disabledLogger.flush();

    expect(transport).not.toHaveBeenCalled();
    disabledLogger.dispose();
  });

  it('manual flush() sends the entire buffer in one transport call', () => {
    logger.log({ level: 'debug', tag: 't', message: 'x' });
    logger.log({ level: 'debug', tag: 't', message: 'y' });

    logger.flush();
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toHaveLength(2);

    // After the manual flush the trailing timer should NOT trigger another
    // transport call.
    vi.advanceTimersByTime(2000);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('swallows transport errors so the host never crashes', () => {
    const throwingTransport = vi.fn(() => {
      throw new Error('boom');
    });
    const safeLogger = createPerfLogger({
      enabled: () => true,
      flushIntervalMs: 1000,
      flushThreshold: 1,
      maxBufferSize: 10,
      transport: throwingTransport,
    });

    safeLogger.log({ level: 'debug', tag: 't', message: 'a' });
    expect(() => {
      vi.advanceTimersByTime(1000);
    }).not.toThrow();
    safeLogger.dispose();
  });

  it('dispose() stops further logging and clears timers', () => {
    logger.log({ level: 'debug', tag: 't', message: 'a' });
    logger.dispose();
    logger.log({ level: 'debug', tag: 't', message: 'b' });

    vi.advanceTimersByTime(2000);
    expect(transport).not.toHaveBeenCalled();
  });
});
