/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useContainerWidth } from '@/renderer/pages/conversation/hooks/useContainerWidth';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}

  trigger(width: number): void {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

const Harness: React.FC = () => {
  const { containerRef, containerWidth } = useContainerWidth();
  return <div ref={containerRef} data-testid='host' data-width={containerWidth} />;
};

describe('useContainerWidth', () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('coalesces per-frame resizes and commits only the settled width', () => {
    render(<Harness />);
    const host = screen.getByTestId('host');
    const observer = MockResizeObserver.instances[0];
    expect(observer).toBeTruthy();

    // Simulate the per-frame width changes of the sider width transition:
    // several callbacks in quick succession, each before the settle delay.
    act(() => {
      observer.trigger(500);
    });
    act(() => {
      vi.advanceTimersByTime(60);
    });
    act(() => {
      observer.trigger(520);
    });
    act(() => {
      vi.advanceTimersByTime(60);
    });
    act(() => {
      observer.trigger(540);
    });

    // Nothing committed mid-flight — the intermediate values never reach React.
    expect(host.dataset.width).toBe('0');

    // Once the width settles, the final value lands in one commit.
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(host.dataset.width).toBe('540');
  });

  it('clears the pending commit on unmount', () => {
    const { unmount } = render(<Harness />);
    const observer = MockResizeObserver.instances[0];

    act(() => {
      observer.trigger(700);
    });
    unmount();

    // Advancing past the settle delay must not throw or touch React state.
    act(() => {
      vi.advanceTimersByTime(300);
    });
  });
});
