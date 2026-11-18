/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import AppLoader from '@/renderer/components/layout/AppLoader';

const indexHtml = readFileSync(path.resolve(process.cwd(), 'packages/desktop/src/renderer/index.html'), 'utf8');

afterEach(() => {
  cleanup();
});

describe('index.html boot splash markup', () => {
  it('ships a splash element for the window to show before React mounts', () => {
    // Without this the window is blank (white) while the bundle loads, and
    // again after every account-switch reload.
    expect(indexHtml).toContain('id="boot-splash"');
  });

  it('keeps the splash outside #root, which createRoot appends to rather than replacing', () => {
    // `createRoot(container)` appends its children; markup inside #root would
    // survive the mount and sit on top of the app forever.
    const rootOpen = indexHtml.indexOf('id="root"');
    const splash = indexHtml.indexOf('id="boot-splash"');
    expect(rootOpen).toBeGreaterThan(-1);
    expect(splash).toBeGreaterThan(-1);
    expect(splash).toBeLessThan(rootOpen);
  });

  it('hides the splash through the data-app-ready attribute the renderer sets', () => {
    // The hand-off is CSS-driven so it is atomic with React's first paint.
    expect(indexHtml).toContain("html[data-app-ready='true'] #boot-splash");
  });

  it('paints an opaque background in both themes so the window never flashes white', () => {
    // A transparent splash leaves the default white page showing through,
    // which is the exact symptom this change is meant to remove.
    expect(indexHtml).toMatch(/#boot-splash\s*\{[^}]*background:\s*#f9fafb/);
    expect(indexHtml).toMatch(/\[data-theme='dark'\]\s*#boot-splash\s*\{[^}]*background:\s*#1a1a1a/);
  });
});

describe('AppLoader', () => {
  it('paints a full-screen backdrop when it stands in for the whole app', () => {
    render(<AppLoader fullScreen />);

    const loader = screen.getByTestId('app-loader-full-screen');
    // An opaque backdrop is what keeps the window from being blank while the
    // boot gate waits.
    expect(loader.className).toContain('bg-1');
  });

  it('leaves the backdrop off by default, so the Suspense fallback does not cover painted content', () => {
    render(<AppLoader />);

    // The Suspense fallback renders inside an already-painted page; painting
    // an opaque full-screen layer over it would hide the surrounding content.
    expect(screen.queryByTestId('app-loader-full-screen')).toBeNull();
  });
});
