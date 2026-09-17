/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({ theme: 'light' }),
}));

import { CollapsibleContent } from '@/renderer/components/chat/CollapsibleContent';
import { SIDER_ANIMATING_CLASS, SIDER_ANIMATION_WINDOW_MS } from '@/renderer/utils/ui/siderAnimation';

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

  emit(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

let contentHeight = 500;

const renderCollapsible = () => {
  const view = render(<CollapsibleContent maxHeight={240}>long content</CollapsibleContent>);
  const contentEl = view.container.firstElementChild?.firstElementChild as HTMLElement;
  Object.defineProperty(contentEl, 'scrollHeight', { configurable: true, get: () => contentHeight });
  return view;
};

describe('CollapsibleContent sider-animation deferral', () => {
  beforeEach(() => {
    contentHeight = 500;
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.classList.remove(SIDER_ANIMATING_CLASS);
  });

  it('defers the measurement while the sider width transition runs', () => {
    renderCollapsible();
    const observer = MockResizeObserver.instances[0];
    expect(observer).toBeTruthy();

    // Initial measurement: content exceeds maxHeight → the toggle button shows.
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('button')).toBeTruthy();

    // Content shrinks while the sider animates: the resize callback fires but
    // the measurement must not run during the transition window.
    contentHeight = 100;
    document.body.classList.add(SIDER_ANIMATING_CLASS);
    act(() => {
      observer.emit();
    });
    act(() => {
      vi.advanceTimersByTime(SIDER_ANIMATION_WINDOW_MS - 20);
    });
    expect(screen.getByRole('button')).toBeTruthy();

    // Once the window passes, one deferred measurement lands and the button
    // disappears because the content now fits.
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('measures promptly when no sider animation is running', () => {
    renderCollapsible();
    const observer = MockResizeObserver.instances[0];

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('button')).toBeTruthy();

    contentHeight = 100;
    act(() => {
      observer.emit();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByRole('button')).toBeNull();
  });
});
