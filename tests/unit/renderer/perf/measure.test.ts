/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { setPerfEnabledForTest } from '@/renderer/utils/perf/perfConfig';
import { mark, perfTime, perfTimeAsync } from '@/renderer/utils/perf/measure';

describe('mark / perfTime / perfTimeAsync', () => {
  afterEach(() => {
    setPerfEnabledForTest(null);
  });

  it('mark is a no-op when disabled and undefined when enabled', () => {
    setPerfEnabledForTest(false);
    expect(mark('t', 'm')).toBeUndefined();

    setPerfEnabledForTest(true);
    expect(mark('t', 'm', { x: 1 })).toBeUndefined();
  });

  it('perfTime returns the wrapped fn result (sync)', () => {
    setPerfEnabledForTest(false);
    expect(perfTime({ tag: 't', message: 'm' }, () => 42)).toBe(42);
    setPerfEnabledForTest(true);
    expect(perfTime({ tag: 't', message: 'm' }, () => 'ok')).toBe('ok');
  });

  it('perfTimeAsync awaits and returns the wrapped promise result', async () => {
    setPerfEnabledForTest(false);
    await expect(perfTimeAsync({ tag: 't', message: 'm' }, async () => 'a')).resolves.toBe('a');
    setPerfEnabledForTest(true);
    await expect(perfTimeAsync({ tag: 't', message: 'm' }, async () => 'b')).resolves.toBe('b');
  });

  it('perfTime propagates thrown errors after recording duration', () => {
    setPerfEnabledForTest(true);
    expect(() =>
      perfTime({ tag: 't', message: 'm' }, () => {
        throw new Error('boom');
      })
    ).toThrow('boom');
  });
});
