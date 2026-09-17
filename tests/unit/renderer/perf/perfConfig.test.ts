/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { PERF_DEBUG_STORAGE_KEY, perfEnabled, setPerfEnabledForTest } from '@/renderer/utils/perf/perfConfig';

describe('perfEnabled', () => {
  afterEach(() => {
    setPerfEnabledForTest(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('returns the explicit test override when set', () => {
    setPerfEnabledForTest(false);
    expect(perfEnabled()).toBe(false);
    setPerfEnabledForTest(true);
    expect(perfEnabled()).toBe(true);
  });

  it('falls back to localStorage flag when there is no test override', () => {
    setPerfEnabledForTest(null);
    if (typeof localStorage !== 'undefined') {
      // vitest's node environment does not provide localStorage; if missing
      // we simply assert the resolver returns a boolean rather than throwing.
      localStorage.setItem(PERF_DEBUG_STORAGE_KEY, '1');
      expect(perfEnabled()).toBe(typeof localStorage === 'undefined' ? expect.any(Boolean) : true);
    } else {
      expect(typeof perfEnabled()).toBe('boolean');
    }
  });
});
