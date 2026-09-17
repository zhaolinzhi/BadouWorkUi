/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PerfProfiler } from '@/renderer/utils/perf';
import { setPerfEnabledForTest } from '@/renderer/utils/perf/perfConfig';

describe('PerfProfiler', () => {
  afterEach(() => {
    setPerfEnabledForTest(null);
  });

  it('renders children when enabled', () => {
    setPerfEnabledForTest(true);
    const { container } = render(
      <PerfProfiler id='demo'>
        <span data-testid='child'>hello</span>
      </PerfProfiler>
    );
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe('hello');
  });

  it('renders children when disabled without mounting a Profiler', () => {
    setPerfEnabledForTest(false);
    const { container } = render(
      <PerfProfiler id='demo'>
        <span data-testid='child'>hello</span>
      </PerfProfiler>
    );
    expect(container.querySelector('[data-testid="child"]')?.textContent).toBe('hello');
  });
});
