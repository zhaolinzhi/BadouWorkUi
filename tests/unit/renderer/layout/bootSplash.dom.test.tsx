/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { BootSplashHandoff, isAppReady, markAppReady } from '@/renderer/utils/ui/bootSplash';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-app-ready');
});

describe('boot splash hand-off', () => {
  it('marks the document as ready so the splash CSS hides it', () => {
    expect(isAppReady()).toBe(false);

    markAppReady();

    expect(isAppReady()).toBe(true);
    expect(document.documentElement.getAttribute('data-app-ready')).toBe('true');
  });

  it('reports not-ready before the hand-off, so the splash stays visible', () => {
    // The splash is what covers the window while the bundle loads. If this
    // ever reported ready prematurely, the window would go blank.
    expect(isAppReady()).toBe(false);
  });

  it('is idempotent — a second hand-off keeps the ready state', () => {
    markAppReady();
    markAppReady();

    expect(isAppReady()).toBe(true);
  });

  it('stays ready when the hand-off targets a document without an <html> element', () => {
    // Defensive: `markAppReady` writes to `documentElement`. A detached
    // document has none, and must not throw — a failed hand-off would leave
    // the splash covering a live app forever.
    const detached = document.implementation.createHTMLDocument('detached');

    expect(() => markAppReady(detached)).not.toThrow();
    expect(isAppReady(detached)).toBe(true);
  });
});

describe('BootSplashHandoff', () => {
  it('hides the splash once mounted, after React has committed', () => {
    expect(isAppReady()).toBe(false);

    render(<BootSplashHandoff />);

    expect(isAppReady()).toBe(true);
  });

  it('renders nothing itself', () => {
    // The hand-off is invisible: the component only flips an attribute.
    const { container } = render(<BootSplashHandoff />);

    expect(container.innerHTML).toBe('');
  });
});
